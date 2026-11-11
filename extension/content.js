(()=>{
 'use strict';
 const button=document.createElement('button');
 button.textContent='Criar card no Partelís';
 button.style.cssText='position:fixed;bottom:24px;right:32px;z-index:2147483647;background:#30145f;color:white;padding:14px 20px;border:0;border-radius:12px;cursor:pointer;font:600 15px system-ui;box-shadow:0 4px 16px #0004';
 button.onclick=()=>{
  const main=document.querySelector('#main');
  const header=main?.querySelector('header');
  if(!header){alert('Abra uma conversa individual antes de criar um card.');return;}
  const title=header.querySelector('[title]');
  const name=(title?.getAttribute('title')||'').slice(0,150);
  // Only visible header data; never read history or WhatsApp internal stores.
  const candidate=name.match(/^\+?[\d\s().-]{10,25}$/)?.[0]||'';
  const selected=window.getSelection();
  const note=selected?.anchorNode&&main.contains(selected.anchorNode)?selected.toString().slice(0,2000):'';
  const payload={name,phone:candidate,note,captureId:crypto.randomUUID()};
  window.open('https://partelis.com.br/capturar-whatsapp#'+encodeURIComponent(JSON.stringify(payload)),'_blank','noopener,noreferrer');
 };
 document.body.append(button);
})();
