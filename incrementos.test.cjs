const test=require('node:test'),assert=require('node:assert/strict'),C=require('./domain.js');
const day='2026-10-29';
function fixture(){let state={schema:1,clients:[],debts:[],opportunities:[],meetings:[],proposals:[],contracts:[],installments:[],cases:[],tasks:[],audit:[]};const r=C.execute(state,'gestor','client',{name:'Pessoa Exemplo Teste',source:'Indicação',area:'Passivo bancário',owner:'especialista',next:'Diagnóstico',due:day},day);return {state:r.state,id:r.result.id};}
function run(f,a,p){const r=C.execute(f.state,'gestor',a,p,day);f.state=r.state;return r.result;}
const terms={down:100.01,count:3,unit:300,successPercent:10,successBase:'Economia obtida',scope:'Escopo fictício',validUntil:'2026-11-10'};
test('proposta calcula fixo, preserva condições por versão e não soma êxito como receita',()=>{const f=fixture();const p=run(f,'proposal',{oppId:f.id,...terms});assert.equal(p.amount,100001);assert.equal(C.metrics(f.state,day).received,0);run(f,'proposal',{oppId:f.id,...terms,down:200,count:4,unit:200});assert.deepEqual(f.state.proposals[0].terms,{down:10001,count:3,unit:30000,successPercent:10,successBase:'Economia obtida'});assert.equal(C.latest(f.state,f.id).amount,100000);});
test('contrato não altera condições aceitas e gera exatamente parcelas propostas',()=>{const f=fixture(),p=run(f,'proposal',{oppId:f.id,...terms});run(f,'proposal',{oppId:f.id,id:p.id,operation:'send'});run(f,'proposal',{oppId:f.id,id:p.id,operation:'accept'});assert.equal(f.state.opportunities[0].stage,'assinatura');assert.throws(()=>run(f,'contract',{oppId:f.id,signed:true,down:1,count:3,firstDue:day}),/entrada deve/);const c=run(f,'contract',{oppId:f.id,signed:true,firstDue:'2026-10-31'});assert.equal(c.terms.successPercent,10);assert.deepEqual(f.state.installments.map(x=>x.amount),[10001,30000,30000,30000]);assert.equal(f.state.installments.reduce((n,x)=>n+x.amount,0),c.amount);});
test('condições incoerentes ou não finitas não alteram a proposta',()=>{const f=fixture();for(const data of [{count:-1},{unit:0},{down:NaN},{successPercent:101},{successBase:'Não previsto'},{count:0,unit:1}])assert.throws(()=>run(f,'proposal',{oppId:f.id,...terms,...data}));assert.equal(f.state.proposals.length,0);});
test('retorno após proposta sincroniza tarefa e sinaliza gestor sem mensagens',()=>{const f=fixture(),p=run(f,'proposal',{oppId:f.id,...terms});run(f,'proposal',{oppId:f.id,id:p.id,operation:'send'});const contact={oppId:f.id,outcome:'sem_resposta',note:'Contato fictício sem resposta',next:'Telefonar no retorno combinado',due:'2026-11-02',owner:'secretaria',stage:'negociacao'};run(f,'followup',contact);run(f,'followup',contact);assert.equal(f.state.opportunities[0].escalated,true);assert.equal(f.state.opportunities[0].contacts.length,2);assert.equal(f.state.tasks.filter(x=>!x.done&&x.kind==='followup').length,1);assert.equal(f.state.tasks.find(x=>!x.done).due,'2026-11-02');run(f,'followup',{...contact,outcome:'objecao',note:'Cliente fictício pediu outra condição'});assert.equal(f.state.opportunities[0].escalated,false);assert.equal(f.state.opportunities[0].unanswered,0);});
test('nutrição exige próximo contato e retorno não pode pular para ganho',()=>{const f=fixture(),p={oppId:f.id,outcome:'data',note:'Voltar depois',next:'Retomar',owner:'secretaria',due:'2026-11-04',stage:'nutricao'};run(f,'followup',p);assert.equal(f.state.opportunities[0].stage,'nutricao');assert.throws(()=>run(f,'followup',{...p,due:''}),/data válida/);assert.throws(()=>run(f,'followup',{...p,stage:'contratado'}),/fluxo/);});
test('reagendamento preserva histórico, precisa de nova confirmação e recusa conflito',()=>{const f=fixture(),m=run(f,'meeting',{oppId:f.id,date:day,time:'14:00',owner:'especialista',subject:'Diagnóstico'});run(f,'meeting',{id:m.id,status:'confirmada'});const m2=run(f,'meeting',{id:m.id,operation:'reschedule',date:day,time:'15:00'});assert.equal(f.state.meetings[0].status,'reagendada');assert.equal(m2.previousId,m.id);assert.equal(m2.status,'agendada');assert.throws(()=>run(f,'meeting',{id:m.id,operation:'reschedule',date:day,time:'16:00'}),/não pode/);const m3=run(f,'meeting',{oppId:f.id,date:day,time:'16:00',owner:'especialista',subject:'Diagnóstico'});assert.throws(()=>run(f,'meeting',{id:m3.id,operation:'reschedule',date:day,time:'15:00'}),/Já existe/);});
test('fechamento agendado exige proposta apresentada e aceite segue para assinatura',()=>{const f=fixture(),p=run(f,'proposal',{oppId:f.id,...terms});run(f,'proposal',{oppId:f.id,id:p.id,operation:'send'});run(f,'meeting',{oppId:f.id,date:day,time:'17:00',owner:'especialista',subject:'Fechamento'});assert.equal(f.state.opportunities[0].stage,'fechamento');run(f,'proposal',{oppId:f.id,id:p.id,operation:'accept'});assert.equal(f.state.opportunities[0].stage,'assinatura');assert.throws(()=>run(f,'followup',{oppId:f.id,outcome:'data',note:'Teste',owner:'especialista',next:'Retomar',due:day,stage:'nutricao'}),/aceita/);});

test('recall cria uma escalada única, recomenda revisão após terceira tentativa e fecha escalada com resposta',()=>{const f=fixture(),p={oppId:f.id,outcome:'sem_resposta',note:'Sem retorno fictício',next:'Tentar outro canal',owner:'secretaria',due:'2026-11-02',stage:'triagem'};run(f,'followup',p);assert.equal(f.state.tasks.filter(t=>t.kind==='escalation').length,0);run(f,'followup',p);assert.equal(f.state.tasks.filter(t=>t.kind==='escalation'&&!t.done).length,1);assert.equal(f.state.tasks.find(t=>t.kind==='escalation').owner,'gestor');run(f,'followup',p);assert.equal(f.state.tasks.filter(t=>t.kind==='escalation'&&!t.done).length,1);assert.match(f.state.opportunities[0].recallRecommendation,/Avaliar pausa/);run(f,'followup',{...p,outcome:'objecao',note:'Cliente respondeu'});assert.equal(f.state.tasks.filter(t=>t.kind==='escalation'&&!t.done).length,0);assert.equal(f.state.opportunities[0].recallRecommendation,null);});

const vm=require('node:vm'),fs=require('node:fs');
const ui=fs.readFileSync(require('node:path').join(__dirname,'app.js'),'utf8');
function isolated(name,next,context){
 const a=ui.indexOf('function '+name+'('),b=ui.indexOf('function '+next+'(',a+10);
 assert.ok(a>=0&&b>a,'UI functions found: '+name);
 return vm.runInNewContext('('+ui.slice(a,b).trim()+')',context);
}
function ctrl(value=''){const events={};return {value,textContent:'',innerHTML:'',focus(){},addEventListener(type,fn){events[type]=fn;},fire(type){assert.ok(events[type]);events[type]();}};}
test('UI: registrar retorno exige resultado explícito e adapta próxima ação à objeção e falta de resposta',()=>{
 const result=ctrl(''),choice=ctrl(),next=ctrl('Apresentar proposta V1');
 const d={querySelector:k=>({'#f-outcome':result,'#f-nextChoice':choice,'#f-next':next})[k]};
 let body='';
 const o={id:'ficticio',stage:'proposta',next:next.value,due:'2026-11-02',owner:'especialista'};
 const sandbox={opp:()=>o,C:{latest:()=>({status:'apresentada'}),stages:{proposta:'Proposta',nutricao:'Recall',negociacao:'Negociação'}},name:()=> 'Pessoa fictícia',hidden:()=>'',select:(label,key,opts)=>{if(key==='outcome')assert.equal(opts[0][0],'');return ''},textarea:()=>'',field:()=>'',form:(title,subtitle,markup)=>{body=markup;return d},e:v=>String(v),mutate:()=>{}};
 isolated('followup','reschedule',sandbox)('ficticio');
 assert.match(body,/Próxima ação sugerida/);
 result.value='objecao';result.fire('change');
 assert.match(next.value,/Reavaliar honorários/);
 choice.value='Encaminhar para recall futuro';choice.fire('change');
 assert.equal(next.value,'Encaminhar para recall futuro');
 result.value='sem_resposta';result.fire('change');
 assert.equal(next.value,'Realizar nova tentativa de contato');
});
test('UI: simulador mantém precificação orientativa e valida margem',()=>{
 const fields={hours:ctrl('20'),hourCost:ctrl('150'),expenses:ctrl('0'),margin:ctrl('30'),contracts:ctrl('1'),risk:ctrl('1'),complexity:ctrl('1'),priceResult:ctrl()};
 const form=ctrl(),d={querySelector:k=>k==='#pricingForm'?form:fields[k.slice(3)]};
 const sandbox={field:()=>'',select:()=>'',dialog:()=>d,C:{money:cents=>String(cents)}};
 isolated('pricingInterview','newContract',sandbox)();
 assert.match(fields.priceResult.textContent,/428571/);
 fields.margin.value='100';form.fire('input');
 assert.equal(fields.priceResult.textContent,'Revise os parâmetros.');
});
test('UI: proposta imprimível tem comando visível e conteúdo escapado',()=>{
 let printed='',opened=false;
 const p={version:2,scope:'<script>alert(1)</script>',amount:120000,terms:null,validUntil:'2026-11-02'};
 const sandbox={C:{latest:()=>p,money:cents=>String(cents)},state:{},client:()=>({name:'Cliente fictício'}),opp:()=>({}),window:{open:()=>{opened=true;return {document:{write:s=>{printed=s},close(){}},focus(){}}}},notify:()=>{},termsText:()=>'',fmt:()=>'',e:v=>String(v).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))};
 isolated('printProposal','pricingInterview',sandbox)('id');
 assert.ok(opened);
 assert.match(printed,/Imprimir ou salvar como PDF/);
 assert.match(printed,/window.print\(\)/);
 assert.ok(!printed.includes('<script>alert'));
 assert.match(printed,/&lt;script&gt;/);
});
test('UI: recomendações de recall e honorários aparecem na ficha',()=>{
 assert.match(ui,/o\.recallRecommendation\?'/);
 assert.match(ui,/Honorários propostos/);
});
