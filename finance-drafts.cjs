'use strict';
// Cálculos puros e preliminares. Nunca geram cobrança, confirmam recebimentos ou alteram contratos.
function validDate(s) {
 if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))throw Error('Data deve estar em AAAA-MM-DD.');
 const d=new Date(s+'T12:00:00Z');
 if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==s)throw Error('Data inexistente.');
 return d;
}
function positiveCents(n) {
 if(!Number.isSafeInteger(n)||n<1)throw Error('Valor precisa ser um inteiro positivo de centavos.');
 return n;
}
function dueDate(reference,offset=0,dayOfMonth) {
 const first=validDate(reference);
 if(!Number.isSafeInteger(offset)||offset<0||offset>120)throw Error('Deslocamento mensal inválido.');
 const day=dayOfMonth===undefined?first.getUTCDate():dayOfMonth;
 if(!Number.isSafeInteger(day)||day<1||day>31)throw Error('Dia de vencimento inválido.');
 const firstOfMonth=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+offset,1));
 const lastDay=new Date(Date.UTC(firstOfMonth.getUTCFullYear(),firstOfMonth.getUTCMonth()+1,0)).getUTCDate();
 return firstOfMonth.getUTCFullYear()+'-'+String(firstOfMonth.getUTCMonth()+1).padStart(2,'0')+'-'+String(Math.min(day,lastDay)).padStart(2,'0');
}
function recurringDrafts({amountCents,startDate,cycles,dayOfMonth}) {
 positiveCents(amountCents);validDate(startDate);
 if(!Number.isSafeInteger(cycles)||cycles<1||cycles>120)throw Error('Quantidade de competências inválida.');
 return Array.from({length:cycles},(_,i)=>({
  sequence:i+1,dueDate:dueDate(startDate,i,dayOfMonth),amountCents,
  type:'recurring_draft',paymentStatus:'not_charged',requiresReview:true
 }));
}
function agreementDrafts({balanceCents,installments,firstDue}) {
 positiveCents(balanceCents);validDate(firstDue);
 if(!Number.isSafeInteger(installments)||installments<1||installments>120||installments>balanceCents)throw Error('Parcelamento inválido.');
 const base=Math.floor(balanceCents/installments);
 return Array.from({length:installments},(_,i)=>({
  sequence:i+1,dueDate:dueDate(firstDue,i),amountCents:i===installments-1?balanceCents-base*(installments-1):base,
  type:'agreement_draft',paymentStatus:'not_charged',requiresReview:true
 }));
}
function successFeeEstimate({economicBenefitCents,rateBasisPoints}) {
 if(!Number.isSafeInteger(economicBenefitCents)||economicBenefitCents<0)throw Error('Base econômica inválida.');
 if(!Number.isSafeInteger(rateBasisPoints)||rateBasisPoints<0||rateBasisPoints>10000)throw Error('Percentual inválido.');
 const cents=Number((BigInt(economicBenefitCents)*BigInt(rateBasisPoints)+5000n)/10000n);
 if(!Number.isSafeInteger(cents))throw Error('Valor fora do limite de precisão.');
 return {amountCents:cents,type:'success_fee_estimate',requiresReview:true,paymentStatus:'not_charged'};
}
function overdueDays({dueDate:due,asOf,status}) {
 const a=validDate(due),b=validDate(asOf);
 if(status==='confirmed_paid'||status==='reversed')return 0;
 const diff=Math.floor((b.getTime()-a.getTime())/86400000);
 return Math.max(0,diff);
}
module.exports={dueDate,recurringDrafts,agreementDrafts,successFeeEstimate,overdueDays};
