(async()=>{
 'use strict';
 const form=document.querySelector('#capture'),status=document.querySelector('#status'),save=document.querySelector('#save'),C=window.Partelis;
 let data,initial={},captureId;
 try{initial=JSON.parse(decodeURIComponent(location.hash.slice(1)));}catch{}
 history.replaceState(null,'','/capturar-whatsapp');
 captureId=/^[a-zA-Z0-9-]{16,80}$/.test(initial.captureId||'')?initial.captureId:crypto.randomUUID();
 for(const key of ['name','phone','note'])if(typeof initial[key]==='string')form.elements[key].value=initial[key].slice(0,key==='note'?2000:150);
 form.elements.due.value=C.today();
 const normalize=v=>{const n=String(v||'').replace(/\D/g,'');return n.length===10||n.length===11?'55'+n:n;};
 async function request(url,p){const r=await fetch(url,{method:p?'POST':'GET',headers:p?{'Content-Type':'application/json'}:{},body:p?JSON.stringify(p):undefined});const d=await r.json();if(!r.ok)throw new Error(d.error||'Não foi possível concluir.');return d;}
 function match(){
  if(!data)return;
  const phone=normalize(form.elements.phone.value),matches=data.data.clients.filter(c=>phone&&normalize(c.phone)===phone);
  const client=matches[0],cards=client?data.data.opportunities.filter(o=>o.clientId===client.id&&!['contratado','perdido'].includes(o.stage)):[];
  document.querySelector('#match').textContent=matches.length>1?'Telefone duplicado: revise os cadastros antes de continuar.':client?'Cliente cadastrado: '+client.name+' · '+cards.length+' card(s) aberto(s).':'Novo cadastro básico de cliente será criado junto com o card.';
 }
 async function connect(){save.disabled=true;try{
  data=await request('/api/state');
  document.querySelector('#workspace').textContent='Escritório: '+(data.theme?.name||'Seu escritório')+' · '+data.user.email;
  if(!C.can(data.user.role,'whatsappCapture'))throw new Error('Seu perfil não pode criar atendimentos.');
  const select=form.elements.owner;select.replaceChildren();for(const [value,label]of Object.entries(C.roles)){const o=document.createElement('option');o.value=value;o.textContent=label;select.append(o);}select.value=data.user.role;
  try{const areas=await request('/api/legal/areas');document.querySelector('#areas').replaceChildren(...areas.items.filter(a=>a.active).map(a=>{const o=document.createElement('option');o.value=a.name;return o;}));}catch{}
  status.textContent='Conectado. Confira os dados antes de salvar.';save.disabled=false;match();
 }catch(e){status.textContent=e.message;}}
 form.elements.phone.addEventListener('input',match);
 document.querySelector('#reload').onclick=connect;
 form.onsubmit=async e=>{e.preventDefault();save.disabled=true;try{
  const p=Object.fromEntries(new FormData(form));p.newOpportunity=form.elements.newOpportunity.checked;p.captureId=captureId;
  const out=await request('/api/action',{revision:data.revision,action:'whatsappCapture',data:p});
  data.data=out.state;data.revision=out.revision;
  status.textContent='Card disponível: '+out.result.id+'. Abra o Kanban para continuar.';match();
 }catch(e){status.textContent=e.message+' Se houver atualização simultânea, atualize a conexão e tente novamente.';}finally{save.disabled=false;}};
 await connect();
})();
