/* Partelís — gerenciador de cookies do site comercial. Controla o consentimento de ferramentas opcionais. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root&&root.document){root.PartelisCookies=api;api.init(root);}
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const VERSION='2026-11-17.2',NAME='pt_cookie_consent',DAYS=180,MAX_AGE=DAYS*86400;
 const categories=['analytics','marketing'];
 let memory=null,listeners=[],registrations=[],win=null,doc=null,nodes=null;
 function normalize(v,now=Date.now()){
  if(!v||typeof v!=='object'||Array.isArray(v)||v.version!==VERSION
   ||typeof v.analytics!=='boolean'||typeof v.marketing!=='boolean'
   ||!Number.isFinite(v.updatedAt)||v.updatedAt>now+300000||v.updatedAt<=now-MAX_AGE*1000)return null;
  return Object.freeze({version:VERSION,necessary:true,analytics:v.analytics,marketing:v.marketing,updatedAt:v.updatedAt});
 }
 function parseCookie(raw,now=Date.now()){
  if(typeof raw!=='string')return null;
  for(const part of raw.split(';')){
   const i=part.indexOf('=');
   if(i<0||part.slice(0,i).trim()!==NAME)continue;
   try{return normalize(JSON.parse(decodeURIComponent(part.slice(i+1))),now);}
   catch{return null;}
  }
  return null;
 }
 const record=(prefs,now=Date.now())=>normalize({version:VERSION,analytics:prefs?.analytics===true,marketing:prefs?.marketing===true,updatedAt:now},now);
 const serialize=(prefs,secure=true)=>NAME+'='+encodeURIComponent(JSON.stringify(record(prefs)))+'; Max-Age='+MAX_AGE+'; Path=/; SameSite=Lax'+(secure?'; Secure':'');
 const stored=()=>memory||parseCookie(doc?.cookie||'');
 const preference=()=>stored()||Object.freeze({necessary:true,analytics:false,marketing:false});
 const allowed=cat=>cat==='necessary'||(categories.includes(cat)&&stored()?.[cat]===true);
 function notify(){
  const p=preference();
  listeners.slice().forEach(fn=>{try{fn(p)}catch{}});
  if(win)win.dispatchEvent(new win.CustomEvent('partelis-cookies-changed',{detail:p}));
  registrations.forEach(item=>{
   if(allowed(item.category)&&!item.active){
    try{const result=item.activate();item.cleanup=typeof result==='function'?result:null;item.active=true;}catch{item.active=false;}
   }else if(!allowed(item.category)&&item.active){
    try{item.cleanup?.();}catch{}
    item.active=false;item.cleanup=null;
   }
  });
 }
 function whenAllowed(category,activate){
  if(!categories.includes(category)||typeof activate!=='function')throw Error('Categoria opcional ou função inválida.');
  const item={category,activate,cleanup:null,active:false};registrations.push(item);
  if(allowed(category)){try{const result=activate();item.cleanup=typeof result==='function'?result:null;item.active=true;}catch{}}
  return ()=>{registrations=registrations.filter(x=>x!==item);if(item.active){try{item.cleanup?.();}catch{}item.active=false;}};
 }
 function choose(prefs){
  if(!doc||!win)return null;
  const previous=preference(),v=record(prefs);
  doc.cookie=serialize(v,win.location.protocol==='https:');memory=v;
  if(nodes)nodes.banner.hidden=true;
  notify();
  if((previous.analytics&&!v.analytics)||(previous.marketing&&!v.marketing))win.location.reload();
  return v;
 }
 function openPreferences(){
  if(!nodes)return;
  nodes.banner.hidden=false;
  nodes.accept.focus();
 }
 function render(){
  if(doc.getElementById('pt-cookie-banner'))return;
  const wrapper=doc.createElement('div');
  wrapper.innerHTML=[
   '<aside id="pt-cookie-banner" class="pt-cookie-banner" role="region" aria-labelledby="pt-cookie-title" aria-describedby="pt-cookie-desc" hidden>',
   '<div class="pt-cookie-copy"><h2 id="pt-cookie-title">Cookies</h2>',
   '<p id="pt-cookie-desc">Usamos cookies para o funcionamento do site e, se você aceitar, para medir visitas e campanhas. <a href="/cookies">Saiba mais</a></p></div>',
   '<div class="pt-cookie-actions"><button type="button" class="pt-cookie-button pt-cookie-primary" data-cookie-action="accept">Aceitar cookies</button>',
   '<button type="button" class="pt-cookie-button pt-cookie-secondary" data-cookie-action="reject">Não aceitar</button></div></aside>'
  ].join('');
  while(wrapper.firstElementChild)doc.body.appendChild(wrapper.firstElementChild);
  nodes={banner:doc.getElementById('pt-cookie-banner'),accept:doc.querySelector('[data-cookie-action="accept"]')};
  doc.addEventListener('click',event=>{
   const button=event.target.closest?.('[data-cookie-action],[data-cookie-settings]');
   if(!button)return;
   if(button.hasAttribute('data-cookie-settings')){event.preventDefault();openPreferences();return;}
   if(button.dataset.cookieAction==='accept')choose({analytics:true,marketing:true});
   if(button.dataset.cookieAction==='reject')choose({analytics:false,marketing:false});
  });
  nodes.banner.hidden=!!stored();
 }
 function init(root){
  if(win)return;win=root;doc=root.document;
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',render,{once:true});
  else render();
  doc.addEventListener('visibilitychange',()=>{
   if(doc.visibilityState==='visible'){
    memory=null;const current=stored();if(nodes)nodes.banner.hidden=!!current;notify();
   }
  });
 }
 return Object.freeze({VERSION,NAME,DAYS,parseCookie,record,serialize,preference,allowed,whenAllowed,choose,openPreferences,init,
  onChange(fn){if(typeof fn!=='function')throw Error('Função inválida.');listeners.push(fn);return ()=>{listeners=listeners.filter(x=>x!==fn);};}});
});