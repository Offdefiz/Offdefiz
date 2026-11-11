/* Partelís — gerenciador de cookies do site comercial. Não instala trackers. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root&&root.document){root.PartelisCookies=api;api.init(root);}
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const VERSION='2026-11-11.1',NAME='pt_cookie_consent',DAYS=180,MAX_AGE=DAYS*86400;
 const categories=['analytics','marketing'];
 let memory=null,listeners=[],registrations=[],win=null,doc=null,nodes=null,returnFocus=null;
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
 function sync(v){if(nodes){nodes.analytics.checked=!!v.analytics;nodes.marketing.checked=!!v.marketing;}}
 function choose(prefs){
  if(!doc||!win)return null;
  const previous=preference(),v=record(prefs);
  doc.cookie=serialize(v,win.location.protocol==='https:');memory=v;
  if(nodes){nodes.banner.hidden=true;sync(v);if(nodes.dialog.open)nodes.dialog.close();}
  notify();
  if((previous.analytics&&!v.analytics)||(previous.marketing&&!v.marketing))win.location.reload();
  return v;
 }
 function openPreferences(){
  if(!nodes)return;
  returnFocus=doc.activeElement instanceof win.HTMLElement?doc.activeElement:null;
  sync(preference());if(!nodes.dialog.open)nodes.dialog.showModal();nodes.close.focus();
 }
 function render(){
  if(doc.getElementById('pt-cookie-banner'))return;
  const wrapper=doc.createElement('div');
  wrapper.innerHTML=[
   '<aside id="pt-cookie-banner" class="pt-cookie-banner" role="region" aria-labelledby="pt-cookie-title" aria-describedby="pt-cookie-desc" hidden>',
   '<div class="pt-cookie-symbol" aria-hidden="true"><span></span><span></span></div>',
   '<div class="pt-cookie-copy"><p class="pt-cookie-eyebrow">PRIVACIDADE NO PARTELÍS</p><h2 id="pt-cookie-title">Você no controle dos cookies.</h2>',
   '<p id="pt-cookie-desc">Usamos cookies essenciais para preferências e acesso seguro. Atualmente não utilizamos rastreadores de análise ou publicidade no site comercial. Você pode escolher e alterar suas opções quando quiser.</p>',
   '<a href="/cookies">Conheça nossa Política de Cookies</a></div>',
   '<div class="pt-cookie-actions"><button type="button" class="pt-cookie-button pt-cookie-primary" data-cookie-action="accept">Aceitar todos</button>',
   '<button type="button" class="pt-cookie-button pt-cookie-secondary" data-cookie-action="reject">Rejeitar opcionais</button>',
   '<button type="button" class="pt-cookie-button pt-cookie-text" data-cookie-action="customize">Personalizar</button></div></aside>',
   '<dialog id="pt-cookie-dialog" class="pt-cookie-dialog" aria-labelledby="pt-cookie-dialog-title" aria-describedby="pt-cookie-dialog-desc">',
   '<div class="pt-cookie-modal-head"><span class="pt-cookie-eyebrow">CENTRAL DE PRIVACIDADE</span><button type="button" class="pt-cookie-close" aria-label="Fechar preferências" data-cookie-action="close">×</button></div>',
   '<h2 id="pt-cookie-dialog-title">Preferências de cookies</h2>',
   '<p id="pt-cookie-dialog-desc">Escolha por finalidade. Nenhum rastreador opcional está instalado. Se novas ferramentas forem ativadas no futuro, solicitaremos uma nova decisão.</p>',
   '<div class="pt-cookie-category"><div><strong>Essenciais</strong><p>Guardam sua escolha e mantêm a sessão quando você entra na plataforma.</p></div><span class="pt-cookie-always">Sempre ativos</span></div>',
   '<label class="pt-cookie-category" for="pt-cookie-analytics"><span><strong>Análise de uso</strong><small>Para conhecer visitas e desempenho. Nenhuma ferramenta instalada atualmente.</small></span><input id="pt-cookie-analytics" type="checkbox"></label>',
   '<label class="pt-cookie-category" for="pt-cookie-marketing"><span><strong>Marketing</strong><small>Para medir campanhas. Nenhum pixel publicitário instalado atualmente.</small></span><input id="pt-cookie-marketing" type="checkbox"></label>',
   '<p class="pt-cookie-footnote">Essas escolhas não habilitam ferramentas ainda inexistentes. Antes de ativar novos fornecedores, atualizaremos a política e pediremos seu consentimento novamente. Leia a <a href="/cookies">Política de Cookies</a> e o <a href="/privacidade">Aviso de Privacidade</a>.</p>',
   '<div class="pt-cookie-modal-actions"><button type="button" class="pt-cookie-button pt-cookie-secondary" data-cookie-action="reject">Rejeitar opcionais</button>',
   '<button type="button" class="pt-cookie-button pt-cookie-primary" data-cookie-action="save">Salvar preferências</button></div></dialog>'
  ].join('');
  while(wrapper.firstElementChild)doc.body.appendChild(wrapper.firstElementChild);
  nodes={banner:doc.getElementById('pt-cookie-banner'),dialog:doc.getElementById('pt-cookie-dialog'),
   close:doc.querySelector('.pt-cookie-close'),analytics:doc.getElementById('pt-cookie-analytics'),marketing:doc.getElementById('pt-cookie-marketing')};
  doc.addEventListener('click',event=>{
   const button=event.target.closest?.('[data-cookie-action],[data-cookie-settings]');
   if(!button)return;
   if(button.hasAttribute('data-cookie-settings')){event.preventDefault();openPreferences();return;}
   const action=button.dataset.cookieAction;
   if(action==='accept')choose({analytics:true,marketing:true});
   if(action==='reject')choose({analytics:false,marketing:false});
   if(action==='customize')openPreferences();
   if(action==='save')choose({analytics:nodes.analytics.checked,marketing:nodes.marketing.checked});
   if(action==='close')nodes.dialog.close();
  });
  nodes.dialog.addEventListener('close',()=>{if(returnFocus?.isConnected)returnFocus.focus();returnFocus=null;});
  const current=stored();if(current)sync(current);else nodes.banner.hidden=false;
 }
 function init(root){
  if(win)return;win=root;doc=root.document;
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',render,{once:true});
  else render();
  doc.addEventListener('visibilitychange',()=>{
   if(doc.visibilityState==='visible'){
    memory=null;const current=stored();if(nodes){nodes.banner.hidden=!!current;sync(preference());}notify();
   }
  });
 }
 return Object.freeze({VERSION,NAME,DAYS,parseCookie,record,serialize,preference,allowed,whenAllowed,choose,openPreferences,init,
  onChange(fn){if(typeof fn!=='function')throw Error('Função inválida.');listeners.push(fn);return ()=>{listeners=listeners.filter(x=>x!==fn);};}});
});