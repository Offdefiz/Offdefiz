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

