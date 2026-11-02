const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),P=require('./proposal-engine.js'),C=require('./domain.js'),{server}=require('./server.cjs');
const expected=[['passivo','proposta_passivo_bancario.html'],['revisional','proposta_acao_revisional.html'],['superendividamento','proposta_superendividamento.html'],['holding','proposta_holding.html']];
test('four supplied templates stay intact and each has exactly seven slides',()=>{
 for(const [kind,path] of expected){assert.equal(P.TEMPLATES[kind],path);const html=fs.readFileSync('templates/'+path,'utf8');assert.equal((html.match(/<section class="slide(?: cover)?"/g)||[]).length,7,path);for(const marker of ['data-t="CLIENTE_NOME"','data-t="PARCELA_VALOR"','data-field="ESCOPO"','/*DADOS_INICIO*/','/*DADOS_FIM*/'])assert.ok(html.includes(marker),path+' missing '+marker);}
});
test('installment calculator adjusts the last fraction instead of falsifying the fee',()=>{
 assert.deepEqual(P.installments(10001,3),{count:3,amount:3333,last:3335,down:0,adjusted:true});
 assert.equal(P.toWords(360000),'três mil e seiscentos reais');
 assert.equal(P.toWords(101),'um real e um centavo');
});
test('template metadata derives only from verified CRM values and protects empty assumptions',()=>{
 const p={amount:360000,created:'2026-11-02',validUntil:'2026-11-17',scope:'Análise documental',terms:{down:0,count:6,unit:60000,successPercent:20,successBase:'Economia obtida'},visual:{template:'passivo',diagnosis:'Diagnóstico fictício',chartJson:''}};
 const cfg={responsible:'Dra. Exemplo',oab:'MG 123456',primary:'#112244',secondary:'#998866',payment:'Cartão ou boleto'};
 const opts={proposal:p,client:{name:'Cliente Exemplo'},office:{name:'Escritório Exemplo'},settings:cfg,debts:[{kind:'Crédito rotativo',amount:125000},{kind:'Financiamento',amount:50000}]};
 const model=P.buildValues(opts);
 assert.equal(model.kind,'passivo');assert.equal(model.data.PARCELAS_QTD,'6');assert.equal(model.data.PARCELA_VALOR,'R$ 600,00');
 assert.equal(model.data.HONORARIO_INICIAL_EXTENSO,'três mil e seiscentos reais');
 assert.equal(model.chart.composicao.length,2);assert.equal(model.chart.cenarios.length,0);
 assert.equal(model.data.DATA_PROPOSTA,'02/11/2026');
 assert.throws(()=>P.buildValues({...opts,settings:{oab:''}}),/Configure o advogado/);
 assert.throws(()=>P.buildValues({...opts,proposal:{...p,terms:null}}),/êxito/);
});
test('proposal template metadata is persisted without changing original proposal stage',()=>{
 let state={schema:1,clients:[],debts:[],opportunities:[],meetings:[],proposals:[],contracts:[],installments:[],cases:[],tasks:[],audit:[]};
 let o=C.execute(state,'gestor','client',{name:'Pessoa Exemplo',source:'Site',area:'Passivo bancário',owner:'secretaria',next:'Diagnóstico',due:'2026-11-02'},'2026-11-02');state=o.state;
 const p=C.execute(state,'gestor','proposal',{oppId:o.result.id,scope:'Análise documental',validUntil:'2026-11-17',down:0,count:3,unit:500,successPercent:0,successBase:'Não previsto',visual:{template:'holding',diagnosis:'Mapeamento de bens',stepsText:'Revisão | Até 15 dias',nextText:'Assinar contrato'}},'2026-11-02');
 assert.equal(p.result.visual.template,'holding');assert.equal(p.result.visual.steps[0].title,'Revisão');
 assert.equal(p.state.opportunities[0].stage,'proposta');assert.equal(p.state.proposals.length,1);
});
test('proposal assets are public templates only and traversal cannot read private files',async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 try{for(const [,name] of expected){const r=await fetch(base+'/templates/'+name);assert.equal(r.status,200,name);assert.match(r.headers.get('content-type'),/text\/html/);}
 for(const name of ['proposal-engine.js','proposal-settings.js']){const r=await fetch(base+'/'+name);assert.equal(r.status,200,name);assert.match(r.headers.get('content-type'),/javascript/);}
 assert.equal((await fetch(base+'/templates/malicioso.html')).status,404);
 assert.equal((await fetch(base+'/templates/../schema.sql')).status,404);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('gráficos descartam HTML potencialmente executável em rótulos',()=>{
 const input={composicao:[{l:'Cartão <img src=x onerror=alert(1)>',v:42},{l:'Financiamento',v:58}],cenarios:[{l:'<svg onload=alert(1)>',v:12}]};
 const charts=P.chartFor('passivo',input,[]);
 assert.equal(charts.composicao.length,2);
 assert.doesNotMatch(charts.composicao[0].l,/[<>&"'\x60]/);
 assert.doesNotMatch(charts.cenarios[0].l,/[<>&"'\x60]/);
});
