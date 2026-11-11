'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const K=require('./legal-service-catalog.js'),C=require('./domain.js'),P=require('./proposal-engine.js');
const {server}=require('./server.cjs');
function empty(){return {schema:1,clients:[],debts:[],opportunities:[],meetings:[],proposals:[],contracts:[],installments:[],cases:[],tasks:[],audit:[]};}
test('catálogo cobre todas as 14 áreas, em cada uma com serviços verificáveis e sem honorários automáticos',()=>{
 assert.equal(Object.keys(K.AREA_NAMES).length,14);
 assert.ok(K.SERVICES.length>=70);
 assert.equal(new Set(K.SERVICES.map(x=>x.id)).size,K.SERVICES.length);
 for(const code of Object.keys(K.AREA_NAMES)){
  assert.ok(K.list(code).length>=3,code);
  for(const item of K.list(code)){
   assert.equal(item.areaCode,code);
   assert.ok(item.scope.length>45);
   assert.ok(item.intake.length>0&&item.documents.length>0&&item.steps.length>0);
   assert.equal(item.reviewRequired,true);
   assert.equal(typeof item.agreementPossible,'boolean');
   assert.ok(!Object.hasOwn(item,'price')&&!Object.hasOwn(item,'legalDeadline'));
  }
 }
});
test('aliases e fallback: criminal, cível, nicho customizado e ausência de serviço',()=>{
 assert.equal(K.matchArea('Criminal'),'penal');
 assert.equal(K.matchArea('Família e Sucessões'),'familia_sucessoes');
 assert.equal(K.matchArea('Holding'),'empresarial_societario');
 assert.equal(K.matchArea('LGPD'),'digital_dados');
 assert.equal(K.matchArea('cível'),'civel');
 assert.equal(K.matchArea('Área customizada'),'outra');
 assert.equal(K.context(null,'Área customizada').areaName,'Outra');
 assert.equal(K.context(null,'Penal').title,'Serviço jurídico a definir');
});
test('rascunho de serviço não promete resultado, deixa prazos indefinidos e distingue propostas de negociação',()=>{
 const criminal=K.draft('penal.acao_penal','Penal');
 assert.match(criminal.scope,/defesa|Defesa|análise|Análise/);
 assert.match(criminal.stepsText,/A definir com o advogado/);
 assert.equal(criminal.agreementPossible,false);
 const acordo=K.draft('trabalhista.acordo_extrajudicial','Trabalhista');
 assert.equal(acordo.agreementPossible,true);
 assert.ok(acordo.warnings.some(x=>/garantido/.test(x)));
});
test('regra de negócio persiste serviço por versão, compatível com propostas antigas e bloqueia área incorreta',()=>{
 const day='2026-11-11';let state=empty();
 let result=C.execute(state,'gestor','client',{name:'Pessoa Exemplo',source:'Indicação',area:'Penal',owner:'especialista',next:'Entrevista',due:day},day);
 state=result.state;const oid=result.result.id;
 const payload={oppId:oid,scope:'Defesa delimitada a atos expressos',validUntil:'2026-11-25',down:0,count:2,unit:800,successPercent:0,successBase:'Não previsto',visual:{template:'passivo',serviceId:'penal.acao_penal',stepsText:'Conferência de autos | A definir'}};
 assert.throws(()=>C.execute(state,'gestor','proposal',{...payload,visual:{...payload.visual,serviceId:'bancario.revisional'}},day),/não pertence à área/);
 assert.throws(()=>C.execute(state,'gestor','proposal',{...payload,visual:{...payload.visual,serviceId:'penal.inexistente'}},day),/inválido/);
 result=C.execute(state,'gestor','proposal',payload,day);state=result.state;
 assert.equal(result.result.visual.template,'generico');
 assert.equal(result.result.visual.serviceId,'penal.acao_penal');
 assert.equal(result.result.visual.serviceName,'Defesa em ação penal');
 assert.equal(result.result.visual.areaName,'Penal');
 assert.equal(result.result.visual.catalogVersion,K.VERSION);
 const model=P.buildValues({proposal:{...result.result,area:'Penal'},client:{name:'Pessoa Exemplo'},office:{name:'Advocacia Exemplo'},settings:{responsible:'Dra. Exemplo',oab:'MG 999',payment:'A combinar'},debts:[]});
 assert.equal(model.kind,'generico');
 assert.equal(model.data.SERVICO_NOME,'Defesa em ação penal');
 assert.deepEqual(model.chart,{});
 assert.equal(model.data.AREA_NOME,'Penal');
 const legacy=C.execute(state,'gestor','proposal',{oppId:oid,scope:'Revisão sem catálogo',amount:1800,validUntil:'2026-11-25',visual:{template:'holding'}},day);
 assert.equal(legacy.result.visual.template,'holding');
 const corporate=C.execute(empty(),'gestor','client',{name:'Empresa Exemplo',source:'Indicação',area:'Empresarial e Societário',owner:'especialista',next:'Reunião',due:day},day);const corporateP=C.execute(corporate.state,'gestor','proposal',{oppId:corporate.result.id,scope:'Contrato empresarial',amount:1500,validUntil:'2026-11-25',visual:{serviceId:'empresarial_societario.contratos',template:'holding'}},day);assert.equal(corporateP.result.visual.template,'generico');
 assert.equal(state.proposals[0].visual.serviceId,'penal.acao_penal');
});
test('apresentação multiárea tem 7 páginas, tokens seguros e não contém indicadores bancários fictícios',()=>{
 const html=fs.readFileSync('templates/proposta_multiarea.html','utf8');
 assert.equal((html.match(/<section class="slide(?: cover)?"/g)||[]).length,7);
 for(const marker of ['/*DADOS_INICIO*/','/*DADOS_FIM*/','data-t="SERVICO_NOME"','data-field="ESCOPO"','data-field="ETAPAS"','data-field="PROXIMOS_PASSOS"'])
  assert.ok(html.includes(marker),marker);
 assert.ok(!html.includes('Economia estimada')&&!html.includes('Desconto garantido'));
 assert.equal(P.TEMPLATES.generico,'proposta_multiarea.html');
});
test('servidor publica somente catálogo e modelo permitidos, sem expor diretórios indiscriminadamente',async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 try{
  for(const endpoint of ['/legal-service-catalog.js','/templates/proposta_multiarea.html']){
   const r=await fetch(base+endpoint);assert.equal(r.status,200,endpoint);
  }
  assert.equal((await fetch(base+'/templates/proposta_arbitraria.html')).status,404);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
