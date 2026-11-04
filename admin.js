(async()=>{
'use strict';
const root=document.querySelector('#content'), notice=document.querySelector('#notice');
let active='overview',data={tenants:[],deals:[],feedback:[]};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
const say=(msg,error=false)=>{notice.textContent=msg;notice.style.color=error?'#a52742':'#6530ac'};
const panel=(title,content)=>'<div class="panel"><h2>'+title+'</h2>'+content+'</div>';
async function api(endpoint,body){
  const response=await fetch('/api/admin/'+endpoint,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,cache:'no-store'});
  const content=await response.json();
  if(!response.ok)throw Error(content.error||'Não foi possível processar a operação.');
  return content;
}
async function reload(){
  try{data=await api('dashboard');await render()}catch(err){root.textContent='Não foi possível carregar o painel: '+err.message;say(err.message,true)}
}
function overview(){
  const t=data.tenants||[],d=data.deals||[],f=data.feedback||[];
  const metrics=[['Escritórios registrados',t.length],['Ambientes beta',t.filter(v=>v.plan==='beta').length],['Oportunidades comerciais',d.length],['Feedbacks pendentes',f.filter(v=>v.status==='open').length]];
  return '<div class="grid">'+metrics.map(([name,n])=>'<div class="panel"><small>'+esc(name)+'</small><div class="metric">'+n+'</div></div>').join('')+'</div>'+
    panel('Operação comercial','<p>Gerencie solicitações, novos escritórios e convites no painel comercial.</p><a class="link" style="display:inline-flex" href="/admin/comercial">Gerenciar contas e contratações</a>')+
    panel('Oportunidades registradas como ganhas','<div class="metric">'+money(d.filter(x=>x.stage==='won').reduce((s,x)=>s+Number(x.value||0),0))+'</div><small>Valor estimado do CRM, não equivale a receita recebida nem assinatura verificada.</small>');
}
function tenants(){
  const list=data.tenants||[];
  return panel('Escritórios cadastrados','<p><a href="/admin/comercial">Adicionar escritório ou gerenciar usuários</a></p><div style="overflow:auto"><table><thead><tr><th>Escritório</th><th>Plano</th><th>Situação</th></tr></thead><tbody>'+
    (list.map(t=>'<tr><td>'+esc(t.name)+'</td><td>'+esc(t.plan)+'</td><td>'+esc(t.status)+'</td></tr>').join('')||'<tr><td colspan="3">Nenhum escritório.</td></tr>')+'</tbody></table></div>');
}
function crm(){
  const list=data.deals||[],stages=['lead','contacted','demo','proposal','won','lost'];
  return panel('Nova oportunidade','<form id="newdeal"><input name="name" maxlength="100" placeholder="Nome do escritório" required><input name="contact" maxlength="120" placeholder="Contato profissional"><input name="value" type="number" min="0" step=".01" placeholder="Valor estimado (R$)"><input name="next_action" maxlength="200" required placeholder="Próxima ação"><input name="next_date" type="date" required><button type="submit">Adicionar</button></form>')+
    panel('Pipeline comercial','<div style="overflow:auto"><table><thead><tr><th>Escritório</th><th>Etapa</th><th>Valor</th><th>Próxima ação</th></tr></thead><tbody>'+
    (list.map(d=>'<tr><td>'+esc(d.name)+'</td><td><select data-stage="'+esc(d.id)+'">'+stages.map(stage=>'<option value="'+stage+'" '+(d.stage===stage?'selected':'')+'>'+stage+'</option>').join('')+'</select></td><td>'+money(d.value)+'</td><td>'+esc(d.next_action)+' · '+esc(d.next_date)+'</td></tr>').join('')||'<tr><td colspan="4">Nenhuma oportunidade.</td></tr>')+'</tbody></table></div>');
}
function feedback(){
  const list=data.feedback||[];
  return panel('Relatos das pessoas beta testers','<div style="overflow:auto"><table><thead><tr><th>Tipo</th><th>Relato</th><th>Página</th><th>Status</th></tr></thead><tbody>'+
    (list.map(f=>'<tr><td>'+esc(f.kind)+'</td><td>'+esc(f.message)+'</td><td>'+esc(f.page)+'</td><td><select data-feedback="'+esc(f.id)+'">'+['open','reviewing','resolved'].map(v=>'<option value="'+v+'" '+(f.status===v?'selected':'')+'>'+v+'</option>').join('')+'</select></td></tr>').join('')||'<tr><td colspan="4">Nenhum relato enviado.</td></tr>')+'</tbody></table></div>');
}
function support(){
  return panel('Suporte autorizado','<p>O responsável do escritório deve autorizar uma sessão de leitura, válida por 60 minutos. Cada acesso é auditado.</p><div id="support-list">Carregando escritórios...</div><div id="support-view"></div>');
}
async function loadSupport(){
  try{
    const result=await api('workspaces');
    const list=root.querySelector('#support-list');if(!list)return;
    const spaces=result.workspaces||[];
    list.innerHTML=spaces.map(s=>'<div style="padding:12px;border-bottom:1px solid #eee"><strong>Escritório '+esc(String(s.id).slice(0,8))+'</strong> · '+Number(s.users)+' usuário(s) · '+(s.grant?'Autorização ativa':'Aguardando autorização')+' <button data-open-support="'+esc(s.id)+'" '+(s.grant?'':'disabled')+'>Abrir leitura</button></div>').join('')||'Nenhum escritório.';
    list.querySelectorAll('[data-open-support]').forEach(button=>button.addEventListener('click',async()=>{
      try{
        const response=await api('support',{workspace_id:button.dataset.openSupport});
        const container=root.querySelector('#support-view');if(!container)return;
        container.replaceChildren();const title=document.createElement('h3');title.textContent='Dados para diagnóstico — somente leitura';container.append(title);
        for(const [name,arr] of Object.entries(response.data||{})){
          if(!Array.isArray(arr))continue;
          const title=document.createElement('h4');title.textContent=name+' ('+arr.length+')';container.append(title);
          for(const item of arr.slice(0,50)){
            const pre=document.createElement('pre');pre.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;border:1px solid #eee;border-radius:8px;padding:10px';pre.textContent=JSON.stringify(item,null,2);container.append(pre);
          }
        }
      }catch(e){say(e.message,true)}
    }));
  }catch(err){say(err.message,true)}
}
async function render(){
  document.querySelectorAll('[data-tab]').forEach(button=>button.classList.toggle('active',button.dataset.tab===active));
  root.innerHTML=active==='overview'?overview():active==='tenants'?tenants():active==='crm'?crm():active==='feedback'?feedback():support();
  root.querySelector('#newdeal')?.addEventListener('submit',async ev=>{
    ev.preventDefault();
    try{await api('deal',Object.fromEntries(new FormData(ev.target)));say('Oportunidade registrada.');await reload()}catch(e){say(e.message,true)}
  });
  root.querySelectorAll('[data-stage]').forEach(select=>select.addEventListener('change',async()=>{
    try{await api('deal-status',{id:select.dataset.stage,stage:select.value});await reload()}catch(e){say(e.message,true)}
  }));
  root.querySelectorAll('[data-feedback]').forEach(select=>select.addEventListener('change',async()=>{
    try{await api('feedback-status',{id:select.dataset.feedback,status:select.value});await reload()}catch(e){say(e.message,true)}
  }));
  if(active==='support')await loadSupport();
}
document.querySelectorAll('[data-tab]').forEach(button=>button.addEventListener('click',()=>{active=button.dataset.tab;render().catch(e=>say(e.message,true))}));
await reload();
})();
