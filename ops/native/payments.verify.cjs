'use strict';
// Executar somente em banco descartável, nunca no banco de produção.
const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {pool}=require('./db.cjs'),{repo}=require('./payments.cjs');
(async()=>{
 if(!/verify|test/.test(process.env.PGDATABASE||''))throw Error('Use um banco descartável de verificação.');
 const id=randomUUID(),request_id=randomUUID(),p={id,request_id,plan:'solo',method:'pix',amount:5900,firm:'Verificação pagamentos',name:'Pessoa Verificação',email:'verificacao-'+id+'@example.com'};
 const a=await repo.reserve(p),b=await repo.reserve({...p,id:randomUUID()});assert.equal(a.id,b.id);
 await repo.attach(id,{checkout_id:'CHEC_'+randomUUID(),url:'https://pagamento.pagbank.com.br/pagamento?code=verify',expires_at:new Date(Date.now()+60000).toISOString()});
 const paid={status:'paid',provider_order_id:'ORDE_'+randomUUID(),charge_id:'CHAR_'+randomUUID()};
 await Promise.all([repo.apply(id,paid),repo.apply(id,paid)]);
 let result=await repo.find(id);assert.equal(result.status,'paid');assert.ok(result.lead_id);
 assert.equal(Number((await pool.query('SELECT count(*) AS n FROM cj_sales_leads WHERE id=$1',[result.lead_id])).rows[0].n),1);
 assert.equal(Number((await pool.query('SELECT count(*) AS n FROM cj_payment_audit WHERE payment_id=$1',[id])).rows[0].n),1);
 await repo.apply(id,{...paid,status:'waiting'});await repo.expire(id);assert.equal((await repo.find(id)).status,'paid');
 await repo.apply(id,{...paid,status:'refunded'});await repo.apply(id,paid);assert.equal((await repo.find(id)).status,'refunded');
 console.log('PagBank PostgreSQL: idempotência, captura, solicitação única, atraso e estorno verificados.');
})().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>pool.end());
