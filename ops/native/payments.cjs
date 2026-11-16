'use strict';
const {pool,transaction}=require('./db.cjs');
const repo={
 async reserve(p){const {rows:[order]}=await pool.query(`INSERT INTO cj_payment_orders(id,request_id,plan,method,amount,firm,name,email,source,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(request_id) DO UPDATE SET request_id=excluded.request_id RETURNING *`,[p.id,p.request_id,p.plan,p.method,p.amount,p.firm,p.name,p.email,p.source||'gateway',p.status||'creating']);return order;},
 async attach(id,p){await pool.query("UPDATE cj_payment_orders SET checkout_id=$2,url=$3,expires_at=$4,status=CASE WHEN status='creating' THEN 'waiting' ELSE status END,updated_at=now() WHERE id=$1",[id,p.checkout_id,p.url,p.expires_at]);},
 async find(id){return (await pool.query('SELECT * FROM cj_payment_orders WHERE id=$1',[id])).rows[0];},
 async expire(id){await pool.query("UPDATE cj_payment_orders SET status='expired',updated_at=now() WHERE id=$1 AND status IN ('creating','waiting')",[id]);},
 async apply(id,p){return transaction(async client=>{
  const {rows:[order]}=await client.query('SELECT * FROM cj_payment_orders WHERE id=$1 FOR UPDATE',[id]);
  if(!order)return;
  // Atrasos/reenvios não rebaixam um pagamento capturado; estorno é explícito.
  if(order.status==='refunded'&&p.status!=='refunded'||order.status==='paid'&&!['paid','refunded'].includes(p.status))return;
  if(order.status===p.status&&order.provider_order_id===p.provider_order_id)return;
  let lead=order.lead_id;
  if(p.status==='paid'&&!lead){
   const {rows:[created]}=await client.query(`INSERT INTO cj_sales_leads(firm_name,contact_name,email,plan_interest,message) VALUES($1,$2,$3,'contratar',$4) RETURNING id`,[order.firm,order.name,order.email,'Pagamento PagBank confirmado · plano '+order.plan+' · pedido '+id+' · '+(order.amount/100).toFixed(2)+' BRL. Acesso mensal com renovação manual.']);lead=created.id;
  }
  await client.query("UPDATE cj_payment_orders SET status=$2,provider_order_id=$3,charge_id=coalesce($4,charge_id),lead_id=$5,paid_at=CASE WHEN $2='paid' THEN coalesce(paid_at,now()) ELSE paid_at END,updated_at=now() WHERE id=$1",[id,p.status,p.provider_order_id,p.charge_id,lead]);
  await client.query('INSERT INTO cj_payment_audit(payment_id,status) VALUES($1,$2)',[id,p.status]);
 });},
 async listing(){return (await pool.query(`SELECT id,plan,method,amount,firm,name,email,status,checkout_id,provider_order_id,paid_at,created_at,lead_id  ,source,manual_reference,workspace_id,email_state,approved_at,invite_expires_at FROM cj_payment_orders
 ORDER BY (status='paid' AND approved_at IS NULL) DESC, created_at DESC LIMIT 300`)).rows;}
};
module.exports={repo};
