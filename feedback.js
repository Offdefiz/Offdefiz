(()=>{'use strict';
function open(){
 const d=document.createElement('dialog');
 d.className='crm-feedback-dialog';
 d.setAttribute('aria-label','Enviar feedback para o Partelís');
 d.innerHTML='<form id="crm-feedback-form"><div class="crm-dialog-head"><div><span class="crm-kicker">CENTRAL DE AJUDA</span><h2>Enviar feedback</h2><p>Seu relato chega ao time Partelís com a página de origem.</p></div><button type="button" class="crm-icon-btn" data-feedback-close aria-label="Fechar">×</button></div><div class="crm-form-field"><label for="crm-feedback-kind">Qual é o assunto?</label><select id="crm-feedback-kind" name="kind"><option value="bug">Relatar um problema</option><option value="idea">Sugerir uma melhoria</option><option value="usability">Experiência e usabilidade</option></select></div><div class="crm-form-field"><label for="crm-feedback-message">Conte o que aconteceu</label><textarea id="crm-feedback-message" name="message" required minlength="8" maxlength="3000" rows="6" placeholder="O que você tentou fazer? O que esperava acontecer?"></textarea><small>Evite incluir dados pessoais ou documentos de clientes.</small></div><p class="crm-form-status" role="status"></p><div class="crm-dialog-actions"><button type="button" class="btn" data-feedback-close>Cancelar</button><button type="submit" class="btn primary">Enviar feedback</button></div></form>';
 document.body.append(d);
 d.querySelectorAll('[data-feedback-close]').forEach(b=>b.onclick=()=>d.close());
 d.addEventListener('close',()=>d.remove(),{once:true});
 d.querySelector('form').onsubmit=async ev=>{ev.preventDefault();const btn=d.querySelector('[type=submit]'),msg=d.querySelector('[name=message]').value.trim(),status=d.querySelector('[role=status]');if(msg.length<8){status.textContent='Descreva com pelo menos oito caracteres.';return;}btn.disabled=true;status.textContent='Enviando…';try{if(!window.CLOUD)throw Error('Envie feedback após entrar em uma conta de teste.');const r=await fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:d.querySelector('[name=kind]').value,message:msg,page:location.pathname})}),data=await r.json();if(!r.ok)throw Error(data.error||'Não foi possível enviar.');d.close();document.dispatchEvent(new CustomEvent('crm-notice',{detail:{message:'Feedback recebido. Obrigado por contribuir!'}}));}catch(error){status.textContent=error.message;}finally{btn.disabled=false;}};
 d.showModal();
}
window.PartelisFeedback={open};
})();