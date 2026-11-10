'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {cnjDigits}=require('./lib/legal-core.cjs');
const {DataJudProvider,DjenProvider,AggregatorProvider,hasDeadlineIndicator}=require('./lib/process-providers.cjs');
const base='0000001'+'2026'+'8'+'13'+'0001';
const cnj=base.slice(0,7)+cnjDigits(base)+base.slice(7);
test('DataJud consulta alias fixo no host oficial com APIKey e somente o CNJ informado',async()=>{
 let called=0;
 const client=async(url,opts)=>{
  called++;
  assert.equal(url,'https://api-publica.datajud.cnj.jus.br/api_publica_tjmg/_search');
  assert.equal(opts.headers.Authorization,'APIKey chave-ficticia-local');
  assert.equal(JSON.parse(opts.body).query.match.numeroProcesso,cnj);
  return {ok:true,json:async()=>({hits:{hits:[{_source:{numeroProcesso:cnj,tribunal:'TJMG',
   nivelSigilo:0,grau:'G1',classe:{codigo:7,nome:'Procedimento'},
   assuntos:[{codigo:100}],orgaoJulgador:{nome:'Vara fictícia'},movimentos:[
    {nome:'Intimação publicada',dataHora:'2026-11-10T14:00:00Z',codigo:123},
    {nome:'Conclusão ao magistrado',dataHora:'2026-11-09T11:00:00Z',codigo:234}
   ]}}]}})};
 };
 const p=new DataJudProvider({httpClient:client,key:'chave-ficticia-local'});
 const r=await p.searchByNumber(cnj,{tribunalAlias:'tjmg'});
 assert.equal(called,1);assert.equal(r.found,true);assert.equal(r.processClass.codigo,7);
 assert.equal(r.movements[0].needsHumanReview,true);
 assert.equal(r.movements[0].isFatal,false);
 assert.equal(r.movements[1].needsHumanReview,false);
});
test('DataJud não consulta sem chave, não permite host arbitrário nem exibe segredo',async()=>{
 assert.throws(()=>new DataJudProvider({base:'https://example.com',key:'x'}),/Host/);
 await assert.rejects(()=>new DataJudProvider().searchByNumber(cnj,{tribunalAlias:'tjmg'}),/não configurado/);
 await assert.rejects(()=>new DataJudProvider({httpClient:async()=>{},key:'x'})
  .searchByNumber(cnj,{tribunalAlias:'https://evil.com'}),/alias inválido/);
 const p=new DataJudProvider({httpClient:async()=>({ok:true,json:async()=>({hits:{hits:[
  {_source:{numeroProcesso:cnj,nivelSigilo:2,movimentos:[{nome:'Conteúdo sigiloso',dataHora:'2026-11-10'}]}}
 ]}})}),key:'test'});
 const result=await p.searchByNumber(cnj,{tribunalAlias:'tjmg'});
 assert.equal(result.restricted,true);assert.equal(result.movements.length,0);
 assert.equal(JSON.stringify(result).includes('Conteúdo sigiloso'),false);
});
test('DJEN consulta simulada e sugere revisão humana sem criar prazo',async()=>{
 const p=new DjenProvider({adapter:{
  searchByNumber:async()=>[{identifier:'hash-ficticio-1',date:'2026-11-10',
    processNumber:cnj,summary:'Intimação fictícia'}],
  searchByOab:async()=>[{identifier:'hash-ficticio-2',date:'2026-11-10',summary:'Publicação'}]
 }});
 const r=await p.searchByNumber(cnj);
 assert.equal(r.length,1);assert.equal(r[0].reviewStatus,'pending_human_review');
 assert.equal(r[0].isFatal,false);
 assert.equal((await p.searchByOab({number:'12345',state:'MG'})).length,1);
 await assert.rejects(()=>p.searchByOab({number:'xxx',state:'MG'}),/OAB/);
 await assert.rejects(()=>new DjenProvider().searchByNumber(cnj),/não configurado/);
});
test('agregador permanece plugável e fontes não disparam rede ou jobs automaticamente',async()=>{
 const adapter=new AggregatorProvider({searchByNumber:async()=>({found:true,movements:[]})});
 const result=await adapter.searchByNumber(cnj);
 assert.equal(result.productionEnabled,false);assert.equal(result.source,'aggregator');
 assert.equal(hasDeadlineIndicator('Audiência designada para amanhã'),true);
 assert.equal(hasDeadlineIndicator('Conclusão ao relator'),false);
 assert.equal((await new DataJudProvider().monitor()).enabled,false);
});
