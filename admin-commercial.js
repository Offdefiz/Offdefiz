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
    (leads.map(l=>'<tr><td><strong>'+esc(l.firm_name)+'</strong><small>'+esc(l.contact_name)+'</small></td><td><span class="pill">'+esc(l.plan_interest)+'</span><small>'+esc(l.message)+'</small></td><td><span>'+esc(l.email)+'</span><small>'+esc(l.phone)+'</small></td><td><select data-lead-status="'+esc(l.id)+'" '+(l.status==='approved'?'disabled':'')+'>'+['new','contacted','demo','proposal','rejected'].map(v=>'<option value="'+v+'" '+(l.status===v?'selected':'')+'>'+pretty[v]+'</option>').join('')+'</select></td><td>'+(l.status==='approved'?'<span class="pill">Criado</span>':'<button class="rowbtn primary" data-provision="'+esc(l.id)+'">Aprovar</button>')+'</td></tr>').join('')||'<tr><td colspan="5">Nenhuma solicitação recebida.</td></tr>')+'</tbody></table>';
  const options=tenants.map(t=>'<option value="'+esc(t.workspace_id)+'">'+esc(t.name)+'</option>').join('');
  $('#member-workspace').innerHTML=options;$('#reissue-workspace').innerHTML=options;
  $('#tenants').innerHTML='<table><thead><tr><th>Escritório</th><th>Plano</th><th>Usuários</th><th>Contas</th><th>Situação</th></tr></thead><tbody>'+
    (tenants.map(t=>'<tr><td><strong>'+esc(t.name)+'</strong><small>'+esc(t.workspace_id)+'</small></td><td>'+esc(t.plan)+'</td><td>'+Number(t.activated||0)+' de '+Number(t.users||0)+' ativados</td><td><small>'+esc((t.emails||[]).join(', '))+'</small></td><td><select data-workspace-status="'+esc(t.workspace_id)+'">'+['pending_activation','active','suspended'].map(v=>'<option value="'+v+'" '+(t.status===v?'selected':'')+'>'+pretty[v]+'</option>').join('')+'</select></td></tr>').join('')||'<tr><td colspan="5">Nenhum ambiente cadastrado.</td></tr>')+'</tbody></table>';
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
async function refresh(){try{current=await api('GET','list');render()}catch(e){msg('Não foi possível carregar: '+e.message,true)}}
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
refresh();
