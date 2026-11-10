'use strict';
// Adaptadores isolados: não importam server/db, não executam requisições por conta própria.
// Uso comercial e jobs desabilitados até revisão de termos CNJ e aprovação profissional.
const {cnjValid}=require('./legal-core.cjs');
const normalize=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
 .toLowerCase().replace(/\s+/g,' ').trim();
const indicators=['intimacao','citacao','publicacao','audiencia designada'];
class ProcessDataProvider{
 async searchByNumber(){throw Error('Provedor não configurado.');}
 async syncMovements(number,opts){const result=await this.searchByNumber(number,opts);
  return {movements:result?.movements||[],source:result?.source||'unknown',syncOnly:true};}
 async monitor(){throw Error('Monitoramento não configurado.');}
}
class DataJudProvider extends ProcessDataProvider{
 constructor({httpClient,key,base='https://api-publica.datajud.cnj.jus.br'}={}){
  super();this.httpClient=httpClient;this.key=key;this.base=base;
  if(base!=='https://api-publica.datajud.cnj.jus.br')throw Error('Host DataJud fora da lista permitida.');
 }
 async searchByNumber(number,{tribunalAlias}={}){
  const n=String(number||'').replace(/\D/g,'');
  if(!cnjValid(n))throw Error('Número CNJ inválido.');
  if(!/^[a-z0-9-]{2,24}$/.test(String(tribunalAlias||'')))throw Error('Tribunal ou alias inválido.');
  if(!this.httpClient||!this.key)throw Error('Provedor DataJud não configurado.');
  const endpoint=this.base+'/api_publica_'+tribunalAlias+'/_search';
  const resp=await this.httpClient(endpoint,{method:'POST',headers:{
   'Content-Type':'application/json','Authorization':'APIKey '+this.key
  },body:JSON.stringify({query:{match:{numeroProcesso:n}},size:5})});
  if(!resp?.ok)throw Error('Consulta DataJud indisponível ('+String(resp?.status||'sem resposta')+').');
  const payload=await resp.json();
  const source=(payload?.hits?.hits||[]).map(h=>h._source).find(x=>x?.numeroProcesso===n);
  if(!source)return {found:false,source:'datajud',number:n,movements:[]};
  if(Number(source.nivelSigilo||0)>0)return {found:false,restricted:true,source:'datajud',number:n,movements:[]};
  const movements=(Array.isArray(source.movimentos)?source.movimentos:[])
   .filter(x=>typeof x.nome==='string'&&typeof x.dataHora==='string'&&/^\d{4}-\d{2}-\d{2}/.test(x.dataHora))
   .map(x=>({date:x.dataHora.slice(0,10),description:x.nome,
    tpuCode:x.codigo===undefined?null:String(x.codigo),origin:'synchronized',
    needsHumanReview:hasDeadlineIndicator(x.nome),isFatal:false}));
  return {found:true,source:'datajud',number:n,
   tribunal:source.tribunal||null,degree:source.grau||null,
   processClass:source.classe||null,subjects:source.assuntos||[],
   judicialBody:source.orgaoJulgador||null,movements};
 }
 async monitor(){return {enabled:false,reason:'Job de monitoramento ainda não habilitado.'};}
}
function hasDeadlineIndicator(description,keywords=indicators){
 const clean=normalize(description);
 return keywords.some(word=>clean.includes(normalize(word)));
}
class DjenProvider extends ProcessDataProvider{
 constructor({adapter}={}){super();this.adapter=adapter;}
 async searchByNumber(number){
  if(!cnjValid(number))throw Error('Número CNJ inválido.');
  if(typeof this.adapter?.searchByNumber!=='function')throw Error('DJEN não configurado.');
  return this.sanitize(await this.adapter.searchByNumber(number));
 }
 async searchByOab({number,state}={}){
  if(!/^\d{1,10}$/.test(String(number||''))||!/^[A-Z]{2}$/.test(String(state||'')))
   throw Error('Inscrição OAB inválida.');
  if(typeof this.adapter?.searchByOab!=='function')throw Error('DJEN não configurado.');
  return this.sanitize(await this.adapter.searchByOab({number,state}));
 }
 sanitize(input){
  if(!Array.isArray(input))throw Error('Resposta DJEN inválida.');
  return input.map(x=>{
   if(!x||typeof x!=='object'||typeof x.identifier!=='string'||typeof x.date!=='string')
    throw Error('Publicação com formato inválido.');
   return {identifier:x.identifier,date:x.date,source:'djen',
    processNumber:x.processNumber||null,summary:String(x.summary||'').slice(0,2000),
    needsHumanReview:true,reviewStatus:'pending_human_review',isFatal:false};
  });
 }
 async monitor(){return {enabled:false,reason:'Fila e credenciais DJEN não homologadas.'};}
}
class AggregatorProvider extends ProcessDataProvider{
 constructor(adapter){super();this.adapter=adapter;}
 async searchByNumber(number){
  if(!cnjValid(number))throw Error('Número CNJ inválido.');
  if(typeof this.adapter?.searchByNumber!=='function')throw Error('Agregador não configurado.');
  const result=await this.adapter.searchByNumber(number);
  if(!result||typeof result!=='object')throw Error('Resposta do agregador inválida.');
  return {...result,source:'aggregator',productionEnabled:false};
 }
}
module.exports={ProcessDataProvider,DataJudProvider,DjenProvider,AggregatorProvider,hasDeadlineIndicator};
