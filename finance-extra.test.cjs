'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),C=require('./domain.js');
const DAY='2026-11-04';
const fixture=()=>({schema:1,clients:[],debts:[],opportunities:[],meetings:[],proposals:[],contracts:[],installments:[],cases:[],tasks:[],audit:[]});
const create=(s,requestId='4f63b0f2-6c39-44cb-ad9b-cfb11b39b703')=>C.execute(s,'financeiro','financeExtra',{operation:'create',kind:'mensalidade',amount:199.90,due:'2026-11-30',months:4,description:'Honorários mensais fictícios',requestId},DAY).state;
test('mensalidade faz 4 lançamentos, inclusive ajuste de fevereiro',()=>{
 const s=create(fixture());assert.equal(s.financeExtras.length,4);
 assert.deepEqual(s.financeExtras.map(x=>x.due),['2026-11-30','2026-12-30','2027-01-30','2027-02-28']);
 assert.equal(s.financeExtras[0].amount,19990);
});
test('requisição repetida não cria cobranças duplicadas',()=>{
 const one=create(fixture()),again=create(one);
 assert.equal(again.financeExtras.length,4);assert.equal(again.financeExtras[0].requestId,one.financeExtras[0].requestId);
});
test('é vedado financeiro para secretaria e pagamento no futuro',()=>{
 const s=fixture(),payload={operation:'create',kind:'acordo',amount:800,due:'2026-12-10',description:'Acordo fictício',requestId:'e9a7513f-a76f-4e91-9216-b9b8a9de8e6b'};
 assert.throws(()=>C.execute(s,'secretaria','financeExtra',payload,DAY),/perfil/);
 const state=C.execute(s,'gestor','financeExtra',payload,DAY).state;
 assert.throws(()=>C.execute(state,'financeiro','financeExtra',{operation:'pay',id:state.financeExtras[0].id,paidAt:'2026-11-05'},DAY),/futuro/);
});
test('baixa manual e estorno exigem justificativa, com auditoria',()=>{
 const s=create(fixture()),id=s.financeExtras[0].id;
 const paid=C.execute(s,'financeiro','financeExtra',{operation:'pay',id,paidAt:'2026-11-04'},DAY).state;
 assert.equal(paid.financeExtras[0].paidAt,DAY);
 assert.throws(()=>C.execute(paid,'financeiro','financeExtra',{operation:'undo',id},DAY),/Motivo/);
 const undone=C.execute(paid,'financeiro','financeExtra',{operation:'undo',id,reason:'Erro de lançamento'},DAY).state;
 assert.equal(undone.financeExtras[0].paidAt,null);assert.equal(undone.financeExtras[0].reversalReason,'Erro de lançamento');
 assert.equal(undone.audit[0].action,'financeExtra');
});
test('dados históricos sem financeExtras continuam compatíveis',()=>{
 const state=C.validate(fixture());assert.equal(state.financeExtras,undefined);
 const m=C.metrics(state,DAY);assert.equal(m.received,0);
});