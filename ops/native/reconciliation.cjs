'use strict';
const {randomUUID}=require('node:crypto');
const {pool,transaction,fail}=require('./db.cjs');
const {token,digest}=require('./auth.cjs');
const {provisionWorkspace,newInvite}=require('./commercial.cjs');
const {validate}=require('../../pagbank.cjs');
const emailer=require('../../invite-email.cjs');
const {repo}=require('./payments.cjs');

async function start(input,url){
 const p=validate(input);
 const order=await repo.reserve({...p,id:randomUUID(),source:'payment_link',status:'waiting'});
 if(order.source!=='payment_link'||['plan','method','email','name','firm','amount'].some(k=>order[k]!==p[k]))
  throw fail(409,'Os dados mudaram. Atualize a página e tente novamente.');
 if(order.status!=='waiting'||order.approved_at)throw fail(409,'Este pedido já foi concluído. Atualize a página.');
 return {url};
}
function reference(value){
 const v=String(value||'').trim().toUpperCase();
 if(!/^[A-Z0-9][A-Z0-9_.-]{5,119}$/.test(v))throw fail(400,'Informe o código da transação aprovada no PagBank.');
 return v;
}
function service({send=emailer.sendInvite,env=process.env}={}){
 const ready=()=>emailer.configured(env);
 const makeSecret=version=>ready()?emailer.inviteToken(version,env):token();
 async function deliver(order,secret){
  const url='https://partelis.com.br/ativar#token_hash='+secret;
  if(order.email_state==='unconfigured')return {email_state:'unconfigured',activation_url:url};
  let state='failed';
  try{if(await send({email:order.email,url,version:order.invite_version},{env}))state='sent';}catch{}
  await pool.query('UPDATE cj_payment_orders SET email_state=$2 WHERE id=$1 AND invite_version=$3',
   [order.id,state,order.invite_version]);
  return {email_state:state,...(state==='failed'?{activation_url:url}:{})};
 }
 async function run(input,actor,retry=false){
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(input.id||''))
   throw fail(400,'Pedido inválido.');
  let job;
  try{job=await transaction(async client=>{
   const {rows:[order]}=await client.query('SELECT * FROM cj_payment_orders WHERE id=$1 FOR UPDATE',[input.id]);
   if(!order)throw fail(404,'Pedido não encontrado.');
   if(retry){
    if(order.status!=='paid'||!order.workspace_id||!order.approved_at)throw fail(409,'Este pedido ainda não foi liberado ou não está pago.');
    if(order.email_state==='sending'&&Date.now()-new Date(order.email_attempt_at)<30000)
     throw fail(409,'O envio já está em andamento. Atualize em instantes.');
    const {rows:[user]}=await client.query(
     'SELECT u.id,u.password_hash,i.token_hash FROM native_users u JOIN cj_memberships m ON m.user_id=u.id LEFT JOIN native_invites i ON i.user_id=u.id WHERE m.workspace_id=$1 AND u.email=$2 FOR UPDATE OF u',
     [order.workspace_id,order.email]);
    if(!user||user.password_hash)throw fail(409,'O destinatário já criou a senha ou não possui mais acesso neste escritório.');
    let version=order.invite_version,secret=version&&ready()?makeSecret(version):null,expires=order.invite_expires_at;
    if(!secret||!expires||new Date(expires).getTime()-Date.now()<24*3600000||digest(secret)!==user.token_hash||order.email_state==='sent'){
     version=randomUUID();secret=makeSecret(version);
     await newInvite(client,user.id,secret);expires=new Date(Date.now()+48*3600000);
    }
    const state=ready()?'sending':'unconfigured';
    await client.query('UPDATE cj_payment_orders SET email_state=$2,invite_version=$3,invite_expires_at=$4,email_attempt_at=now() WHERE id=$1',[order.id,state,version,expires]);
    await client.query('INSERT INTO cj_payment_audit(payment_id,status) VALUES($1,$2)',[order.id,'invite_reissued']);
    return {order:{...order,email_state:state,invite_version:version},secret};
   }
   if(order.approved_at)return {already:true,order};
   let ref=null;
   if(order.source==='payment_link'){
    if(order.status!=='waiting')throw fail(409,'Este pedido não está aguardando conciliação.');
    ref=reference(input.reference);
    // A confirmação humana é específica deste cadastro, e a referência não pode liberar duas compras.
    if(String(input.payment_email||'').trim().toLowerCase()!==order.email)
     throw fail(409,'O e-mail informado não corresponde ao cadastro deste pedido.');
    const previous=await client.query('SELECT id FROM cj_payment_orders WHERE upper(provider_order_id)=$1 OR upper(charge_id)=$1 OR manual_reference=$1',[ref]);
    if(previous.rowCount)throw fail(409,'Esta transação já foi usada em outro pedido.');
   }else if(order.status!=='paid'){
    throw fail(409,'Aguarde a confirmação do PagBank antes de liberar.');
   }
   const version=randomUUID(),secret=makeSecret(version),state=ready()?'sending':'unconfigured';
   const {workspace_id}=await provisionWorkspace(client,{
    name:order.firm,email:order.email,selectedPlan:order.plan,secret,actorId:actor,
    renewalDue:new Date((order.paid_at?new Date(order.paid_at).getTime():Date.now())+30*86400000)
   });
   if(order.lead_id)await client.query("UPDATE cj_sales_leads SET status='approved',workspace_id=$2,updated_at=now() WHERE id=$1",[order.lead_id,workspace_id]);
   await client.query("UPDATE cj_payment_orders SET status='paid',paid_at=coalesce(paid_at,now()),manual_reference=$2,approved_at=now(),approved_by=$3,workspace_id=$4,invite_version=$5,invite_expires_at=now()+interval '48 hours',email_state=$6,email_attempt_at=now(),updated_at=now() WHERE id=$1",
    [order.id,ref,actor,workspace_id,version,state]);
   await client.query('INSERT INTO cj_payment_audit(payment_id,status) VALUES($1,$2)',[order.id,ref?'manual_payment_confirmed':'access_approved']);
   return {order:{...order,workspace_id,email_state:state,invite_version:version},secret};
  });}catch(e){if(e.code==='23505'&&e.constraint==='cj_payment_orders_manual_reference_unique')throw fail(409,'Esta transação já foi usada em outro pedido.');throw e;}
  if(job.already)return {workspace_id:job.order.workspace_id,email_state:job.order.email_state,already:true};
  return {workspace_id:job.order.workspace_id,...await deliver(job.order,job.secret)};
 }
 return {approve:(input,actor)=>run(input,actor),resend:(input,actor)=>run(input,actor,true)};
}
module.exports={start,service,reference};
