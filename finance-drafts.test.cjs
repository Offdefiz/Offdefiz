'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const b=require('./finance-drafts.cjs');
test('recorrência mensal preserva dia-âncora em fevereiro e após fevereiro',()=>{
 const d=b.recurringDrafts({amountCents:14990,startDate:'2026-01-31',cycles:3});
 assert.deepEqual(d.map(x=>x.dueDate),['2026-01-31','2026-02-28','2026-03-31']);
 assert.ok(d.every(x=>x.paymentStatus==='not_charged'&&x.requiresReview===true));
 assert.deepEqual(b.recurringDrafts({amountCents:1250,startDate:'2028-01-31',cycles:2}).map(x=>x.dueDate),['2028-01-31','2028-02-29']);
});
test('acordo distribui centavos sem inventar recebimento',()=>{
 const items=b.agreementDrafts({balanceCents:1000,installments:3,firstDue:'2026-11-30'});
 assert.deepEqual(items.map(x=>x.amountCents),[333,333,334]);
 assert.deepEqual(items.map(x=>x.dueDate),['2026-11-30','2026-12-30','2027-01-30']);
 assert.equal(items.reduce((s,x)=>s+x.amountCents,0),1000);
 assert.ok(items.every(x=>x.paymentStatus==='not_charged'));
});
test('êxito é estimativa que exige aprovação profissional',()=>{
 assert.deepEqual(b.successFeeEstimate({economicBenefitCents:10005,rateBasisPoints:1500}),{
  amountCents:1501,type:'success_fee_estimate',requiresReview:true,paymentStatus:'not_charged'
 });
 assert.throws(()=>b.successFeeEstimate({economicBenefitCents:100,rateBasisPoints:10001}),/Percentual/);
});
test('vencimento não vira atraso para pagamento confirmado e rejeita datas inválidas',()=>{
 assert.equal(b.overdueDays({dueDate:'2026-10-01',asOf:'2026-10-04',status:'not_charged'}),3);
 assert.equal(b.overdueDays({dueDate:'2026-10-01',asOf:'2026-10-04',status:'confirmed_paid'}),0);
 assert.equal(b.overdueDays({dueDate:'2026-10-01',asOf:'2026-10-04',status:'reversed'}),3);
 assert.throws(()=>b.dueDate('2026-02-30'),/inexistente/);
 assert.throws(()=>b.agreementDrafts({balanceCents:2,installments:3,firstDue:'2026-11-01'}),/Parcelamento/);
});
