/* Partelís commercial attribution. No customer-case, message or card data. */
(function(w){
 'use strict';
 const PIXEL='DBU8DEBC77UB463C5FDG',KEY='pt_tt_pending',HASHES='pt_tt_hashes',SEEN='pt_tt_events';
 let ready=false,currentView=null,lastView='',polling=false,attempts=0,timer=null;
 const allowed=()=>ready&&w.PartelisCookies?.allowed('marketing')===true;
 const read=key=>{try{return JSON.parse(w.sessionStorage.getItem(key)||'null');}catch{return null;}};
 const write=(key,value)=>{try{w.sessionStorage.setItem(key,JSON.stringify(value));}catch{}};
 const remove=key=>{try{w.sessionStorage.removeItem(key);}catch{}};
 const sha=async value=>Array.from(new Uint8Array(await w.crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(b=>b.toString(16).padStart(2,'0')).join('');
 function product(p){return {contents:[{content_id:p.id,content_type:'product',content_name:'Partelís '+p.name,quantity:1,price:p.price}],value:p.price,currency:'BRL'};}
 function track(name,params={},eventId){
  if(!allowed())return false;
  const sent=read(SEEN)||[];
  if(eventId&&sent.includes(eventId))return false;
  if(eventId)w.ttq.track(name,params,{event_id:eventId});else w.ttq.track(name,params);
  if(eventId)write(SEEN,[...sent,eventId].slice(-100));
  return true;
 }
 function view(p){
  currentView=p;
  if(!allowed()||lastView===p.id)return;
  if(track('ViewContent',p.id==='partelis'?{contents:[{content_id:'partelis',content_type:'product_group',content_name:'Planos Partelís'}],currency:'BRL'}:product(p)))lastView=p.id;
 }
 async function identify(input={}){
  if(!allowed()||!w.crypto?.subtle)return false;
  try{
   const data={};
   const email=String(input.email||'').trim().toLowerCase();
   if(/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))data.email=await sha(email);
   let phone=String(input.phone||'').replace(/\D/g,'');
   if(phone.length===10||phone.length===11)phone='55'+phone;
   if(/^55\d{10,11}$/.test(phone))data.phone_number=await sha(phone);
   let external=read('pt_tt_external');
   if(!external){external=w.crypto.randomUUID();write('pt_tt_external',external);}
   data.external_id=await sha(external);
   if(!allowed())return false;
   w.ttq.identify(data);write(HASHES,data);return true;
  }catch{return false;}
 }
 function rememberOrder(requestId){
  if(!/^[a-f0-9-]{36}$/i.test(requestId))return;
  write(KEY,{request_id:requestId,created_at:Date.now()});attempts=0;
 }
 async function checkOrder(){
  if(!allowed()||polling||attempts>=12)return;
  const pending=read(KEY);
  if(!pending||Date.now()-pending.created_at>7*86400000){remove(KEY);return;}
  polling=true;attempts++;
  try{
   const response=await w.fetch('/api/public/checkout/status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({request_id:pending.request_id})});
   if(!response.ok)return;
   const order=await response.json();
   if(!allowed())return;
   if(order.status==='paid'){
    const hashes=read(HASHES);if(hashes)w.ttq.identify(hashes);
    const params=product(order.plan);
    track('Purchase',params,'purchase:'+order.id);
    if(order.registered)track('CompleteRegistration',params,'registration:'+order.id);
    else timer=w.setTimeout(checkOrder,15000);
   }else if(['waiting','creating','in_analysis'].includes(order.status))timer=w.setTimeout(checkOrder,15000);
   else remove(KEY);
  }catch{}finally{polling=false;}
 }
 w.PartelisMarketing=Object.freeze({track,product,view,identify,rememberOrder,checkOrder});
 w.addEventListener('DOMContentLoaded',()=>{
  w.PartelisCookies.whenAllowed('marketing',()=>{
    if(!w.ttq?._i?.[PIXEL]){
    const w=window,d=document,t='ttq';
    w.TiktokAnalyticsObject=t;
    const ttq=w[t]=w[t]||[];
    ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"];
    ttq.setAndDefer=function(target,method){target[method]=function(){target.push([method].concat(Array.prototype.slice.call(arguments,0)));};};
    for(let i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
    ttq.instance=function(id){const instance=ttq._i[id]||[];for(let i=0;i<ttq.methods.length;i++)ttq.setAndDefer(instance,ttq.methods[i]);return instance;};
    ttq.load=function(id,options){
      const url="https://analytics.tiktok.com/i18n/pixel/events.js";
      ttq._i=ttq._i||{};ttq._i[id]=[];ttq._i[id]._u=url;
      ttq._t=ttq._t||{};ttq._t[id]=+new Date;
      ttq._o=ttq._o||{};ttq._o[id]=options||{};
      const script=d.createElement('script');
      script.type='text/javascript';script.async=true;
      script.src=url+'?sdkid='+id+'&lib='+t;
      d.head.appendChild(script);
    };
    if(!ttq._i?.DBU8DEBC77UB463C5FDG){
      ttq.load('DBU8DEBC77UB463C5FDG');
      ttq.page();
    }else ttq.grantConsent();

    }else w.ttq.grantConsent();
    ready=true;
    if(currentView)view(currentView);
    checkOrder();
    return ()=>{
      ready=false;w.clearTimeout(timer);w.ttq.revokeConsent();
      remove(HASHES);remove('pt_tt_external');
    };
  });
 },{once:true});
})(window);
