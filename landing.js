'use strict';
const form=document.querySelector('#sales-form');
if(location.pathname==='/contratar'||location.pathname==='/contato')window.addEventListener('DOMContentLoaded',()=>document.querySelector('#contato').scrollIntoView({behavior:'auto'}));
document.querySelectorAll('[data-plan]').forEach(link=>link.addEventListener('click',()=>{const message=document.querySelector('#message');message.value='Tenho interesse no plano '+link.dataset.plan+' da Black Friday.';}));
form.addEventListener('submit',async event=>{
  event.preventDefault();
  const button=document.querySelector('#submit-lead'),status=document.querySelector('#form-status');
  status.textContent='';status.classList.remove('error');button.disabled=true;button.textContent='Enviando...';
  const data=Object.fromEntries(new FormData(form));data.consent=document.querySelector('#consent').checked;
  try{
    const response=await fetch('/api/public/leads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    const payload=await response.json();
    if(!response.ok)throw Error(payload.error||'Não foi possível registrar. Tente novamente.');
    form.reset();status.textContent='Condição solicitada. Entraremos em contato pelo e-mail informado.';
  }catch(e){status.classList.add('error');status.textContent=e.message}
  finally{button.disabled=false;button.textContent='Reservar minha condição'}
});
// The LED animation can be paused without changing the offer link.
const ticker=document.querySelector('.bf-banner'),toggle=document.querySelector('.ticker-toggle');
if(ticker&&toggle)toggle.addEventListener('click',()=>{
  const paused=ticker.classList.toggle('is-paused');
  toggle.setAttribute('aria-pressed',String(paused));
  toggle.setAttribute('aria-label',paused?'Retomar letreiro':'Pausar letreiro');
  toggle.textContent=paused?'▶':'Ⅱ';
});


// TikTok Pixel — activated only by marketing consent on the public landing page.
window.addEventListener('DOMContentLoaded',()=>{
  window.PartelisCookies.whenAllowed('marketing',()=>{
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
    return ()=>ttq.revokeConsent();
  });
},{once:true});
