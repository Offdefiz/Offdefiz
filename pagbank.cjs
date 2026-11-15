'use strict';
const {randomUUID,createHash,timingSafeEqual}=require('node:crypto');
const {PLANS}=require('./checkout.cjs');
const fail=(status,message)=>Object.assign(new Error(message),{status});
const checkoutId=v=>typeof v==='string'&&/^CHEC_[a-f0-9-]{20,64}$/i.test(v);
const orderId=v=>typeof v==='string'&&/^ORDE_[a-f0-9-]{20,64}$/i.test(v);
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
function configured(env=process.env){
 try{const u=new URL(env.PUBLIC_APP_URL);return env.PARTELIS_PAGBANK_ENABLED==='true'&&!!env.PARTELIS_PAGBANK_TOKEN?.trim()&&u.protocol==='https:'&&!u.username&&!u.password&&u.pathname==='/'&&!u.search&&!u.hash;}catch{return false;}
}
function validPayUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&['pagamento.pagbank.com.br','pagamento.pagseguro.uol.com.br'].includes(u.hostname)?u.href:null;}catch{return null;}}
function validate(input){
 if(!Object.hasOwn(PLANS,input.plan)||!['pix','card'].includes(input.method))throw fail(400,'Escolha um plano e uma forma de pagamento válidos.');
 const clean=(v,max)=>typeof v==='string'?v.trim().slice(0,max+1):'';
 const firm=clean(input.firm_name,120),name=clean(input.contact_name,100),email=clean(input.email,254).toLowerCase();
 if(firm.length<2||firm.length>120||name.length<2||name.length>100||email.length>254||!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)||input.consent!==true||!uuid(input.request_id))throw fail(400,'Confira o escritório, responsável, e-mail e aceite das condições.');
 return {plan:input.plan,method:input.method,firm,name,email,request_id:input.request_id,amount:PLANS[input.plan].price*100};
}
function payload(order,env=process.env){
 const origin=new URL(env.PUBLIC_APP_URL).origin,notify=origin+'/api/public/payments/pagbank';
 if(notify.length>100)throw fail(503,'Endereço de notificação indisponível.');
 return {reference_id:order.id,customer_modifiable:true,items:[{reference_id:order.plan,name:'Partelís '+PLANS[order.plan].name+' · 1 mês de acesso',quantity:1,unit_amount:order.amount}],payment_methods:[{type:order.method==='pix'?'PIX':'CREDIT_CARD'}],payment_methods_configs:order.method==='card'?[{type:'CREDIT_CARD',config_options:[{option:'INSTALLMENTS_LIMIT',value:'1'}]}]:[],soft_descriptor:'PARTELIS',redirect_url:origin+'/contratar?retorno=1',return_url:origin+'/contratar?retorno=1',notification_urls:[notify],payment_notification_urls:[notify]};
}
function authentic(raw,header,token){
 if(typeof header!=='string'||! /^[a-f0-9]{64}$/i.test(header)||!token)return false;
 const expected=createHash('sha256').update(token+'-').update(raw).digest();
 return timingSafeEqual(expected,Buffer.from(header,'hex'));
}
async function api(path,{method='GET',body,key,env=process.env,fetcher=fetch}={}){
 if(!/^\/(checkouts|orders)(?:\/[A-Z]+_[a-f0-9-]{20,64})?$/i.test(path))throw fail(400,'Recurso de pagamento inválido.');
 if(!configured(env))throw fail(503,'Pagamento online temporariamente indisponível.');
 let response;
 try{response=await fetcher('https://api.pagseguro.com'+path,{method,redirect:'error',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+env.PARTELIS_PAGBANK_TOKEN.trim(),Accept:'application/json',...(body?{'Content-Type':'application/json'}:{}),...(key?{'x-idempotency-key':key}:{})},body:body?JSON.stringify(body):undefined});}catch{throw fail(503,'O PagBank não respondeu. Tente novamente em instantes.');}
 if(!response.ok)throw fail(503,'O PagBank não disponibilizou o pagamento. Fale com a equipe Partelís.');
 try{return await response.json();}catch{throw fail(503,'Resposta de pagamento indisponível.');}
}
// Somente dados consultados na API autenticada podem alterar o status local.
function verifiedPayment(order,data){
 if(!orderId(data.id)||data.reference_id!==order.id)throw fail(409,'O pagamento não corresponde a esta contratação.');
 const items=Array.isArray(data.items)?data.items:[];
 if(items.length!==1||items[0].reference_id!==order.plan||items[0].quantity!==1||items[0].unit_amount!==order.amount)throw fail(409,'Itens de pagamento divergentes.');
 const charges=Array.isArray(data.charges)?data.charges:[];
 const paid=charges.find(c=>c.status==='PAID'&&c.amount?.currency==='BRL'&&c.amount.value===order.amount&&c.amount.summary?.paid===order.amount&&!c.amount.summary?.refunded);
 if(paid)return {status:'paid',provider_order_id:data.id,charge_id:paid.id};
 const refunded=charges.some(c=>c.amount?.summary?.refunded>0);
 return {status:refunded?'refunded':charges.some(c=>c.status==='IN_ANALYSIS')?'in_analysis':charges.some(c=>c.status==='WAITING')?'waiting':charges.some(c=>c.status==='CANCELED')?'canceled':charges.some(c=>c.status==='DECLINED')?'declined':'waiting',provider_order_id:data.id,charge_id:null};
}
function service({repo,env=process.env,fetcher=fetch}){
 const call=(path,options={})=>api(path,{...options,env,fetcher});
 async function start(input){
  if(!configured(env))throw fail(503,'Pagamento online temporariamente indisponível.');
  const p=validate(input),order=await repo.reserve({...p,id:randomUUID(),status:'creating'});
  if(order.plan!==p.plan||order.method!==p.method||order.email!==p.email||order.firm!==p.firm||order.name!==p.name)throw fail(409,'Os dados mudaram. Atualize a página e tente novamente.');
  if(order.url&&validPayUrl(order.url)&&Date.parse(order.expires_at)>Date.now()&&order.status==='waiting')return {url:order.url};
  if(order.status!=='creating')throw fail(409,'Esta contratação já foi utilizada ou expirou. Atualize a página.');
  const data=await call('/checkouts',{method:'POST',body:payload(order,env),key:order.id});
  const url=validPayUrl(data.links?.find(l=>l.rel==='PAY')?.href);
  if(!checkoutId(data.id)||!url||data.reference_id!==order.id)throw fail(503,'Não foi possível confirmar o checkout do PagBank.');
  await repo.attach(order.id,{checkout_id:data.id,url,expires_at:data.expiration_date||new Date(Date.now()+7200000).toISOString()});
  return {url};
 }
 async function webhook(raw,headers){
  if(!configured(env))throw fail(503,'Recebimento de pagamentos indisponível.');
  if(!authentic(raw,headers['x-authenticity-token'],env.PARTELIS_PAGBANK_TOKEN.trim()))throw fail(401,'Notificação não autenticada.');
  let event;try{event=JSON.parse(raw.toString('utf8'));}catch{throw fail(400,'Notificação inválida.');}
  if(!uuid(event.reference_id))return {ok:true};
  const order=await repo.find(event.reference_id);if(!order)return {ok:true};
  if(orderId(event.id)){
   const data=await call('/orders/'+event.id),payment=verifiedPayment(order,data);
   await repo.apply(order.id,payment);
  }else if(checkoutId(event.id)&&event.id===order.checkout_id){
   const data=await call('/checkouts/'+event.id);
   if(data.id===order.checkout_id&&data.reference_id===order.id&&data.status==='EXPIRED')await repo.expire(order.id);
  }
  return {ok:true};
 }
 return {start,webhook};
}
module.exports={configured,validPayUrl,validate,payload,authentic,api,verifiedPayment,service};
