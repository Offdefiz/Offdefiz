'use strict';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pretty={new:'Novo',contacted:'Contatado',demo:'Demonstração',proposal:'Proposta',approved:'Aprovado',rejected:'Recusado',active:'Ativo',suspended:'Suspenso',pending_activation:'Aguardando ativação'};
let current={leads:[],tenants:[]},lastSecret='';
async function api(method,path,data){
  const response=await fetch('/api/admin/commercial/'+path,{method,headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined,cache:'no-store'});
  const content=await response.json();if(!response.ok)throw Error(content.error||'Falha na operação.');return content;
}
function msg(text,err=false){$('#notice').textContent=text;$('#notice').classList.toggle('error',err)}
function reveal(data){lastSecret=data.activation_url;$('#invite-url').textContent=lastSecret;$('#invite-output').hidden=false;$('#invite-output').scrollIntoView({block:'center'});msg('Convite criado. Copie e entregue ao destinatário por canal privado.')}
function render(){
  const {leads,tenants}=current;
  $('#stats').innerHTML=[['Escritórios',tenants.length],['Aguardando ativação',tenants.filter(t=>t.status==='pending_activation').length],['Solicitações novas',leads.filter(l=>l.status==='new').length],['Usuários ativados',tenants.reduce((s,t)=>s+Number(t.activated||0),0)]].map(([name,count])=>'<div class="metric"><small>'+esc(name)+'</small><strong>'+Number(count)+'</strong></div>').join('');
  $('#leads').innerHTML='<table><thead><tr><th>Escritório / responsável</th><th>Solicitação</th><th>Contato</th><th>Etapa</th><th>Ação</th></tr></thead><tbody>'+
    (leads.map(l=>'<tr><td><strong>'+esc(l.firm_name)+'</strong><small>'+esc(l.contact_name)+'</small></td><td><span class="pill">'+esc(l.plan_interest)+'</span><small>'+esc(l.message)+'</small></td><td><span>'+esc(l.email)+'</span><small>'+esc(l.phone)+'</small></td><td><select data-lead-status="'+esc(l.id)+'" '+(l.status==='approved'?'disabled':'')+'>'+['new','contacted','demo','proposal','rejected'].map(v=>'<option value="'+v+'" '+(l.status===v?'selected':'')+'>'+pretty[v]+'</option>').join('')+'</select></td><td>'+(l.status==='approved'?'<span class="pill">Criado</span>':l.has_payment?'<span class="pill">Ver pagamentos</span>':'<button class="rowbtn primary" data-provision="'+esc(l.id)+'">Aprovar</button>')+'</td></tr>').join('')||'<tr><td colspan="5">Nenhuma solicitação recebida.</td></tr>')+'</tbody></table>';
  const options=tenants.map(t=>'<option value="'+esc(t.workspace_id)+'">'+esc(t.name)+'</option>').join('');
  $('#member-workspace').innerHTML=options;$('#reissue-workspace').innerHTML=options;$('#recovery-workspace').innerHTML=options;
  $('#tenants').innerHTML='<table><thead><tr><th>Escritório</th><th>Plano</th><th>Usuários</th><th>Contas</th><th>Situação</th></tr></thead><tbody>'+
    (tenants.map(t=>'<tr><td><strong>'+esc(t.name)+'</strong><small>'+esc(t.workspace_id)+'</small></td><td>'+esc(({solo:'Solo',escritorio:'Escritório',equipe:'Equipe',trial:'Avaliação',beta:'Beta tester'})[t.plan]||t.plan)+(t.renewal_due_at?'<small>Renovação '+esc(new Date(t.renewal_due_at).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'}))+'</small>':'')+'</td><td>'+Number(t.activated||0)+' de '+Number(t.users||0)+' ativados</td><td><small>'+esc((t.emails||[]).join(', '))+'</small></td><td><select data-workspace-status="'+esc(t.workspace_id)+'">'+['pending_activation','active','suspended'].map(v=>'<option value="'+v+'" '+(t.status===v?'selected':'')+'>'+pretty[v]+'</option>').join('')+'</select></td></tr>').join('')||'<tr><td colspan="5">Nenhum ambiente cadastrado.</td></tr>')+'</tbody></table>';
  document.querySelectorAll('[data-provision]').forEach(b=>b.addEventListener('click',async()=>{
    const lead=leads.find(l=>l.id===b.dataset.provision);if(!lead||!confirm('Criar ambiente isolado para '+lead.firm_name+'?'))return;
    b.disabled=true;try{const data=await api('POST','provision',{lead_id:lead.id,plan:'trial'});reveal(data);await refresh()}catch(e){msg(e.message,true)}finally{b.disabled=false}
  }));
  document.querySelectorAll('[data-lead-status]').forEach(sel=>sel.addEventListener('change',async()=>{
    try{await api('POST','lead-status',{id:sel.dataset.leadStatus,status:sel.value});await refresh()}catch(e){msg(e.message,true)}
  }));
  document.querySelectorAll('[data-workspace-status]').forEach(sel=>sel.addEventListener('change',async()=>{
    const t=tenants.find(t=>t.workspace_id===sel.dataset.workspaceStatus);
    if(sel.value==='suspended'&&!confirm('Suspender o acesso de todos os usuários de '+t.name+'?')){sel.value=t.status;return}
    try{await api('POST','tenant-status',{workspace_id:t.workspace_id,status:sel.value});await refresh()}catch(e){msg(e.message,true);sel.value=t.status}
  }));
}
async function refresh(){try{current=await api('GET','list');render();await renderPayments()}catch(e){msg('Não foi possível carregar: '+e.message,true)}}
async function bindForm(id,endpoint){
  const form=$('#'+id);
  form.addEventListener('submit',async e=>{
    e.preventDefault();const button=form.querySelector('button[type=submit]');button.disabled=true;
    try{const data=Object.fromEntries(new FormData(form));const result=await api('POST',endpoint,data);reveal(result);form.reset();await refresh()}catch(err){msg(err.message,true)}finally{button.disabled=false}
  })
}
$('#refresh').addEventListener('click',refresh);
$('#copy-invite').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(lastSecret);msg('Link copiado.')}catch{msg('Selecione e copie o link exibido.',true)}});
$('#dismiss-invite').addEventListener('click',()=>{lastSecret='';$('#invite-url').textContent='';$('#invite-output').hidden=true});
bindForm('create-workspace','provision');
bindForm('invite-member','invite-member');
bindForm('reissue','reissue-invite');
$('#assisted-recovery').addEventListener('submit',async e=>{
  e.preventDefault();const form=e.target,button=form.querySelector('button[type=submit]');
  if(!confirm('Você verificou a identidade deste usuário por canal independente?'))return;
  button.disabled=true;
  try{const data=Object.fromEntries(new FormData(form));data.identity_verified=$('#recovery-verified').checked;
    const result=await api('POST','assisted-recovery',data);reveal(result);form.reset();await refresh();
  }catch(err){msg(err.message,true)}finally{button.disabled=false}
});
refresh();

const paymentLabels={creating:'Criando checkout',waiting:'Aguardando pagamento',paid:'Pago',in_analysis:'Em análise',declined:'Recusado',canceled:'Cancelado',refunded:'Estornado',expired:'Expirado'};
const emailLabels={pending:'Convite pendente',sending:'Envio em andamento',sent:'Convite aceito pelo provedor de e-mail',failed:'Falha no envio · acesso criado',unconfigured:'Envio automático não configurado · acesso criado'};
const planNames={solo:'Solo',escritorio:'Escritório',equipe:'Equipe'};
let payments=[];
function showPayments(){
 const query=$('#payment-search').value.trim().toLowerCase();
 const filtered=payments.filter(p=>!query||[p.email,p.firm,p.name,p.id,p.manual_reference,p.provider_order_id].some(v=>String(v||'').toLowerCase().includes(query)));
 $('#payments').innerHTML='<table><thead><tr><th>Escritório / e-mail</th><th>Plano / valor</th><th>Situação</th><th>Referência</th><th>Ação</th></tr></thead><tbody>'+
 (filtered.map(p=>{
  const eligible=!p.approved_at&&(p.status==='paid'||(p.source==='payment_link'&&p.status==='waiting'));
  const action=eligible?'<button type="button" class="rowbtn primary" data-payment="'+esc(p.id)+'">'+(p.status==='paid'?'Liberar acesso':'Confirmar pagamento e liberar')+'</button>':
    p.approved_at&&p.status==='paid'?'<button type="button" class="rowbtn" data-resend="'+esc(p.id)+'">Reenviar convite</button>':'—';
  return '<tr><td><strong>'+esc(p.firm)+'</strong><small>'+esc(p.name)+' · '+esc(p.email)+'</small></td><td>'+esc(planNames[p.plan]||p.plan)+'<small>'+esc(new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(p.amount/100))+' · '+(p.method==='pix'?'Pix':'Cartão')+'</small></td><td>'+esc(paymentLabels[p.status]||p.status)+(p.approved_at?'<small>'+esc(emailLabels[p.email_state]||'Acesso liberado')+'</small>':'')+'</td><td><small>'+esc(p.manual_reference||p.provider_order_id||p.id)+'</small></td><td>'+action+'</td></tr>';
 }).join('')||'<tr><td colspan="5">Nenhum pedido encontrado.</td></tr>')+'</tbody></table>';
}
async function renderPayments(){
 try{({payments}=await api('GET','payments'));showPayments()}catch{$('#payments').textContent='Não foi possível carregar os pagamentos.';}
}
$('#payment-search').addEventListener('input',showPayments);
function paymentResult(result){
 if(result.activation_url)reveal(result);
 if(result.already){msg('O acesso deste pedido já foi criado.');return;}
 if(result.email_state==='sent'){msg('Acesso criado. Convite enviado ao provedor de e-mail.');return;}
 msg(emailLabels[result.email_state]||'Acesso criado.',true);
}
let selectedPayment=null;
$('#payments').addEventListener('click',async e=>{
 const button=e.target.closest('button[data-payment], button[data-resend]');if(!button)return;
 const id=button.dataset.payment||button.dataset.resend,p=payments.find(p=>p.id===id);if(!p)return;
 if(button.dataset.resend){
  button.disabled=true;
  try{paymentResult(await api('POST','resend-payment-invite',{id}));await refresh()}catch(e){msg(e.message,true)}finally{button.disabled=false}
  return;
 }
 selectedPayment=p;
 const form=$('#confirm-payment');form.reset();
 const manual=p.source==='payment_link';
 $('#manual-confirm-fields').hidden=!manual;
 form.elements.reference.required=manual;form.elements.payment_email.required=manual;
 $('#payment-target').textContent=p.firm+' · '+p.email+' · '+planNames[p.plan]+' · '+new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(p.amount/100);
 $('#payment-modal').showModal();
});
$('#cancel-payment').addEventListener('click',()=>$('#payment-modal').close());
$('#confirm-payment').addEventListener('submit',async e=>{
 e.preventDefault();
 const form=e.currentTarget,button=form.querySelector('[type=submit]'),dialog=$('#payment-modal');
 if(!selectedPayment)return;
 button.disabled=true;$('#payment-error').textContent='';
 try{
  const result=await api('POST','confirm-payment',{id:selectedPayment.id,...Object.fromEntries(new FormData(form))});
  dialog.close();paymentResult(result);await refresh();
 }catch(err){$('#payment-error').textContent=err.message}finally{button.disabled=false;}
});
