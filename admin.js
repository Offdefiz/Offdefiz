(async()=>{'use strict';
const root=document.querySelector('#content'),notice=document.querySelector('#notice');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0);
const date=s=>s?String(s).slice(0,10):'—';
let tab='overview',data={},users=null;
const stageOptions=['lead','contacted','demo','proposal','won','lost'];
const taskStatuses=['backlog','doing','review','done'];
const priorities=['P0','P1','P2','P3'];
async function api(route,payload){
 const r=await fetch('/api/admin/'+route,{method:payload?'POST':'GET',credentials:'same-origin',headers:payload?{'Content-Type':'application/json'}:{},body:payload?JSON.stringify(payload):undefined});
 const out=await r.json();if(!r.ok)throw Error(out.error||'Falha no serviço administrativo.');return out;
}
function message(value){notice.textContent=value||'';}
async function refresh(){try{data=await api('dashboard');message('');render();}catch(e){root.replaceChildren();const p=document.createElement('p');p.textContent=e.message+' A migração privada de operações precisa ser homologada antes de ativar este painel.';root.append(p);}}
function options(list,selected){return list.map(v=>'<option value="'+esc(v)+'" '+(selected===v?'selected':'')+'>'+esc(v)+'</option>').join('');}
function showMetrics(){
 const m=data.metrics||{},deals=data.deals||[];
 const cells=[
 ['Escritórios com acesso',m.workspacesWithAccess??0],
 ['Usuários cadastrados',m.activeUsers??0],
 ['Online (últimos 2 min)',m.onlineUsers??0],
 ['Beta testers identificados',m.betaTesters??0],
 ['Pagantes confirmados',m.payingWorkspacesVerified??0],
 ['Sugestões pendentes',m.feedbackPending??0],
 ['Tarefas abertas',m.tasksOpen??0]
 ];
 root.innerHTML='<div class="grid">'+cells.map(([title,value])=>'<div class="panel"><small>'+title+'</small><div class="metric">'+esc(value)+'</div></div>').join('')+'</div>'+
 '<section class="panel"><h2>Indicadores financeiros sem estimativas artificiais</h2><div class="metric">'+money(deals.filter(d=>d.stage==='won').reduce((sum,d)=>sum+Number(d.value||0),0))+'</div><p>Valor nominal de oportunidades marcadas como ganhas no CRM. Não representa pagamentos recebidos.</p><small>Pagantes confirmados: apenas assinaturas ativas validadas por provedor; planos cadastrados manualmente não contam como receita realizada.</small></section>';
}
function showTenants(){
 const memberships=data.memberships||[],tenants=data.tenants||[],subs=data.subscriptions||[];
 const ids=[...new Set([...memberships.map(m=>m.workspace_id),...tenants.map(t=>t.workspace_id)])];
 const states=['invited','activated','training','active','paused'];
 root.innerHTML='<div class="panel"><h2>Escritórios, acesso e onboarding</h2><p>O status de onboarding é separado de recebimentos e não concede acesso ao cliente final.</p>'+
 '<input id="tenant-search" type="search" placeholder="Buscar escritório" aria-label="Buscar escritório" style="margin:10px 0;max-width:420px">'+
 '<table><thead><tr><th>Escritório</th><th>Usuários</th><th>Plano</th><th>Acesso</th><th>Assinatura</th><th>Onboarding</th></tr></thead><tbody>'+
 ids.map(id=>{const t=tenants.find(x=>x.workspace_id===id)||{},sub=subs.find(x=>x.workspace_id===id)||{};return '<tr data-tenant-row><td>'+esc(t.name||'Escritório '+id.slice(0,8))+'</td><td>'+memberships.filter(x=>x.workspace_id===id).length+'</td><td>'+esc(t.plan||'não configurado')+'</td><td>'+esc(t.status||'vínculo ativo')+'</td><td>'+esc(sub.status||'não registrada')+'</td><td><select data-onboarding="'+esc(id)+'">'+options(states,t.onboarding_status||'invited')+'</select></td></tr>';}).join('')+'</tbody></table></div>';
 root.querySelector('#tenant-search').addEventListener('input',e=>{const q=e.target.value.toLocaleLowerCase('pt-BR');root.querySelectorAll('[data-tenant-row]').forEach(row=>{row.hidden=!row.textContent.toLocaleLowerCase('pt-BR').includes(q);});});
 root.querySelectorAll('[data-onboarding]').forEach(el=>el.addEventListener('change',async()=>{try{await api('onboarding',{workspace_id:el.dataset.onboarding,status:el.value});await refresh();message('Onboarding atualizado.');}catch(e){message(e.message);}}));
}
function showCRM(){
 const deals=data.deals||[],interactions=data.interactions||[];
 root.innerHTML='<div class="panel"><h2>Nova oportunidade comercial</h2><form id="newdeal"><input name="name" placeholder="Nome do escritório" required maxlength="100"><input name="contact" placeholder="Contato profissional" maxlength="120"><input name="value" type="number" min="0" step=".01" placeholder="R$"><input name="next_action" placeholder="Próxima ação" required maxlength="200"><input name="next_date" type="date" required><button>Adicionar</button></form></div>'+
 '<div class="panel"><h2>Pipeline da Partelís</h2><table><thead><tr><th>Escritório</th><th>Etapa</th><th>Valor declarado</th><th>Próxima ação</th></tr></thead><tbody>'+
 deals.map(d=>'<tr><td>'+esc(d.name)+'</td><td><select data-stage="'+esc(d.id)+'">'+options(stageOptions,d.stage)+'</select></td><td>'+money(d.value)+'</td><td>'+esc(d.next_action)+' · '+esc(date(d.next_date))+'</td></tr>').join('')+'</tbody></table></div>'+
 '<div class="panel"><h2>Histórico de relacionamento</h2><p>Registre apenas informações profissionais necessárias à operação comercial, sem documentos ou dados bancários de terceiros.</p>'+
 (deals.length?'<form id="newinteraction"><select name="deal_id" required aria-label="Oportunidade">'+deals.map(d=>'<option value="'+esc(d.id)+'">'+esc(d.name)+'</option>').join('')+'</select><select name="channel" aria-label="Canal">'+options(['call','email','meeting','whatsapp','other'],'call')+'</select><input name="note" maxlength="1500" minlength="4" required placeholder="Resumo da interação e próximo passo"><button>Registrar interação</button></form>':'<p>Cadastre uma oportunidade para registrar interações.</p>')+
 '<table><thead><tr><th>Data</th><th>Escritório</th><th>Canal</th><th>Registro</th></tr></thead><tbody>'+
 interactions.map(i=>{const d=deals.find(x=>x.id===i.deal_id);return '<tr><td>'+esc(date(i.occurred_at))+'</td><td>'+esc(d?.name||'Oportunidade removida')+'</td><td>'+esc(i.channel)+'</td><td>'+esc(i.note)+'</td></tr>';}).join('')+'</tbody></table></div>';
 root.querySelector('#newdeal').addEventListener('submit',async e=>{e.preventDefault();try{await api('deal',Object.fromEntries(new FormData(e.target)));await refresh();message('Oportunidade cadastrada.');}catch(err){message(err.message);}});
 root.querySelector('#newinteraction')?.addEventListener('submit',async e=>{e.preventDefault();try{await api('interaction',Object.fromEntries(new FormData(e.target)));await refresh();message('Interação registrada.');}catch(err){message(err.message);}});
 root.querySelectorAll('[data-stage]').forEach(el=>el.addEventListener('change',async()=>{try{await api('deal-status',{id:el.dataset.stage,stage:el.value});await refresh();}catch(e){message(e.message);}}));
}
function showFeedback(){
 const entries=data.feedback||[],tasks=data.tasks||[],testers=data.betaTesters||[];
 root.innerHTML='<div class="panel"><h2>Relatos das beta testers e da equipe</h2><p>A identidade do autor é vinculada à conta autenticada. Converter não muda documentos nem código: cria uma tarefa de produto para revisão.</p>'+
 entries.map(f=>{
  const task=tasks.find(t=>t.feedback_id===f.id),author=testers.find(t=>t.user_id===f.user_id);
  return '<section class="panel"><small>'+esc(f.kind)+' · '+esc(author?.label||('Usuário '+f.user_id.slice(0,8)))+' · '+esc(date(f.created_at))+' · '+esc(f.page)+'</small><p>'+esc(f.message)+'</p>'+
  '<label>Status <select data-feedback="'+esc(f.id)+'">'+options(['open','reviewing','resolved'],f.status)+'</select></label>'+
  (task?'<p><strong>Tarefa associada:</strong> '+esc(task.title)+' ('+esc(task.priority)+')</p>':
  '<form data-task-for="'+esc(f.id)+'"><input name="title" required minlength="4" maxlength="160" aria-label="Título da tarefa" placeholder="Nome curto da melhoria" value="'+esc(String(f.message||'').slice(0,100))+'"><select name="priority" aria-label="Prioridade">'+options(priorities,'P1')+'</select><button>Converter em tarefa</button></form>')+
  '</section>';
 }).join('')+'</div>';
 root.querySelectorAll('[data-feedback]').forEach(el=>el.addEventListener('change',async()=>{try{await api('feedback-status',{id:el.dataset.feedback,status:el.value});await refresh();}catch(e){message(e.message);}}));
 root.querySelectorAll('[data-task-for]').forEach(el=>el.addEventListener('submit',async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(el));try{await api('feedback-task',{id:el.dataset.taskFor,title:f.title,priority:f.priority});await refresh();message('Feedback convertido em tarefa.');}catch(err){message(err.message);}}));
}
function showTasks(){
 const entries=data.tasks||[];
 root.innerHTML='<section class="panel"><h2>Backlog de melhorias</h2><p>Prioridades são definidas pelo proprietário. A conclusão da tarefa não publica nenhuma alteração automaticamente.</p><table><thead><tr><th>Prioridade</th><th>Tarefa</th><th>Estado</th><th>Criada</th></tr></thead><tbody>'+
 entries.map(t=>'<tr><td>'+esc(t.priority)+'</td><td>'+esc(t.title)+'</td><td><select data-task-status="'+esc(t.id)+'">'+options(taskStatuses,t.status)+'</select></td><td>'+esc(date(t.created_at))+'</td></tr>').join('')+'</tbody></table></section>';
 root.querySelectorAll('[data-task-status]').forEach(el=>el.addEventListener('change',async()=>{try{await api('task-status',{id:el.dataset.taskStatus,status:el.value});await refresh();}catch(e){message(e.message);}}));
}
async function loadUsers(){if(users)return;try{users=(await api('beta-users')).users||[];if(tab==='beta')render();}catch(e){message(e.message);}}
function showBeta(){
 const testers=data.betaTesters||[];
 root.innerHTML='<section class="panel"><h2>Beta testers — pessoas, não escritórios</h2><p>Selecione a conta existente. Se houver dois e-mails da mesma pessoa, confirme qual deve participar do teste; o sistema não faz essa escolha por semelhança de nome.</p>'+
 '<form id="add-beta"><select name="account" required><option value="">Selecione uma conta</option>'+
 (users||[]).map(u=>'<option value="'+esc(u.user_id+'|'+u.workspace_id)+'">'+esc(u.email)+' ('+esc(u.role)+')</option>').join('')+
 '</select><input name="label" maxlength="80" minlength="2" required placeholder="Nome de exibição (ex.: Dra. Ketrin)"><button>Habilitar beta tester</button></form>'+
 '<h3>Contas identificadas</h3><table><thead><tr><th>Nome</th><th>Conta</th><th>Ação</th></tr></thead><tbody>'+
 testers.map(t=>{const u=(users||[]).find(x=>x.user_id===t.user_id);return '<tr><td>'+esc(t.label)+'</td><td>'+esc(u?.email||t.user_id.slice(0,8))+'</td><td><button data-remove-beta="'+esc(t.user_id)+'">Revogar identificação</button></td></tr>';}).join('')+'</tbody></table></section>';
 root.querySelector('#add-beta').addEventListener('submit',async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target)),[user_id,workspace_id]=(v.account||'').split('|');try{await api('beta-assign',{user_id,workspace_id,label:v.label});await refresh();message('Beta tester vinculado à conta selecionada.');}catch(err){message(err.message);}});
 root.querySelectorAll('[data-remove-beta]').forEach(el=>el.addEventListener('click',async()=>{try{await api('beta-remove',{user_id:el.dataset.removeBeta});await refresh();message('Identificação beta revogada.');}catch(e){message(e.message);}}));
 if(!users)loadUsers();
}
function showSupport(){
 root.innerHTML='<section class="panel"><h2>Suporte autorizado</h2><p>Acesso somente após autorização do gestor válida por até 60 minutos, com registro de consulta. Esta visualização mostra contagens, não conteúdos de casos.</p><div id="support-list">Carregando escritórios…</div><div id="support-view"></div></section>';
 api('workspaces').then(d=>{
  const list=root.querySelector('#support-list');if(!list)return;
  list.innerHTML=(d.workspaces||[]).map(w=>'<p>Escritório '+esc(w.id.slice(0,8))+' · '+Number(w.users)+' usuário(s) · '+(w.grant?'Autorizado':'Sem autorização')+' <button data-support="'+esc(w.id)+'" '+(w.grant?'':'disabled')+'>Ver resumo</button></p>').join('')||'Sem escritórios cadastrados.';
  list.querySelectorAll('[data-support]').forEach(btn=>btn.addEventListener('click',async()=>{try{
   const d=await api('support',{workspace_id:btn.dataset.support}),view=root.querySelector('#support-view');
   view.replaceChildren();const title=document.createElement('h3');title.textContent='Resumo de suporte · somente leitura';view.append(title);
   for(const [kind,records] of Object.entries(d.data||{})){if(!Array.isArray(records))continue;const row=document.createElement('p');row.textContent=kind+': '+records.length+' registro(s)';view.append(row);}
  }catch(e){message(e.message);}}));
 }).catch(e=>message(e.message));
}
function render(){
 document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===tab);b.setAttribute('aria-current',b.dataset.tab===tab?'page':'false');});
 if(tab==='overview')showMetrics();else if(tab==='tenants')showTenants();else if(tab==='crm')showCRM();else if(tab==='feedback')showFeedback();else if(tab==='tasks')showTasks();else if(tab==='beta')showBeta();else if(tab==='support')showSupport();
}
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.tab;render();}));
await refresh();
})();