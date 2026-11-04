(async function () {
'use strict';
const root=document.querySelector('#content'),notice=document.querySelector('#notice');
let tab='overview',data={},search='';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value)||0);
const types={bug:'Problema',idea:'Sugestão',usability:'Usabilidade'};
const statusLabels={open:'Aberto',reviewing:'Em análise',resolved:'Resolvido'};
const priorities={untriaged:'Não priorizado',low:'Baixa',medium:'Média',high:'Alta',critical:'Crítica'};
const stages={lead:'Lead',contacted:'Contatado',demo:'Demonstração',proposal:'Proposta',won:'Ganho',lost:'Perdido'};
const billingLabels={unknown:'Não verificado',trial:'Teste',active:'Pagamento verificado',past_due:'Em atraso',canceled:'Cancelado'};
async function api(route,payload){
 const response=await fetch('/api/admin/'+route,{method:payload?'POST':'GET',headers:payload?{'Content-Type':'application/json'}:{},body:payload?JSON.stringify(payload):undefined});
 const result=await response.json();
 if(!response.ok)throw new Error(result.error||'Não foi possível concluir a operação.');
 return result;
}
async function task(fn){
 try{notice.textContent='Salvando…';await fn();notice.textContent='Alterações registradas.';await refresh();}
 catch(error){notice.textContent=error.message;}
}
const metric=(label,value,detail)=>'<div class="panel"><small>'+esc(label)+'</small><div class="metric">'+esc(value)+'</div><small>'+esc(detail||'')+'</small></div>';
async function refresh(){try{data=await api('dashboard');render();}catch(error){root.textContent=error.message;}}
function render(){
 document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
 const tenants=data.tenants||[],deals=data.deals||[],feedback=data.feedback||[],stats=data.stats||{};
 if(tab==='overview'){
  root.innerHTML='<div class="grid">'+
    metric('Escritórios cadastrados',stats.workspaces??'—','Workspaces existentes')+
    metric('Pagantes verificados',stats.verifiedPayers??'—','Pagamento válido até hoje')+
    metric('Ativos recentes',stats.activeMembersLast3Min??'—','Sessões com atividade em 3 minutos; não presença garantida')+
    metric('Escritórios beta',stats.betaWorkspaces??'—','Contagem de escritórios, não de pessoas')+
    metric('Feedback a tratar',stats.feedbackOpen??'—','Ainda não resolvido')+
    metric('Oportunidades',deals.length,'Pipeline comercial Partelís')+
    '</div><div class="panel"><h2>Pipeline comercial</h2><p>Valor registrado não equivale a dinheiro recebido.</p><div class="metric">'+money(deals.filter(d=>d.stage==='won').reduce((sum,d)=>sum+Number(d.value||0),0))+'</div></div>';
 }
 if(tab==='tenants'){
  root.innerHTML='<div class="panel"><h2>Escritórios e assinaturas</h2><p>Um escritório só será contado como pagante após registro manual de comprovante/recebimento e data de vigência. Esta tela não movimenta dinheiro.</p><table><thead><tr><th>Escritório</th><th>Plano / usuários</th><th>Situação registrada</th><th>Assinatura</th></tr></thead><tbody>'+
  tenants.map(t=>{
   const b=t.billing||{},id=esc(t.workspace_id);
   return '<tr><td><strong>'+esc(t.name)+'</strong><br><small>'+esc(t.status)+'</small></td><td>'+esc(t.plan)+'<br><small>'+esc(t.users)+' usuários</small></td><td>'+esc(billingLabels[b.billing_status]||'Não verificado')+'<br><small>'+esc(b.verified_paid_through||'Sem prazo confirmado')+'</small></td><td><form data-billing="'+id+'" class="admin-billing-form"><select name="billing_status">'+Object.keys(billingLabels).map(k=>'<option value="'+k+'" '+(b.billing_status===k?'selected':'')+'>'+billingLabels[k]+'</option>').join('')+'</select><input aria-label="Mensalidade em reais" name="amount" type="number" min="0" step="0.01" placeholder="Mensalidade R$" value="'+esc((Number(b.amount_cents)||0)/100)+'"><input aria-label="Pago até" name="verified_paid_through" type="date" value="'+esc(b.verified_paid_through||'')+'"><label><input type="checkbox" name="confirm"> Conferi o recebimento</label><button type="submit">Salvar</button></form></td></tr>';
  }).join('')+'</tbody></table></div>';
  root.querySelectorAll('[data-billing]').forEach(form=>form.onsubmit=e=>{
   e.preventDefault();const fields=new FormData(form),amount=Number(fields.get('amount'));
   if(!Number.isFinite(amount)||amount<0||!Number.isSafeInteger(Math.round(amount*100))){notice.textContent='Valor inválido.';return;}
   task(()=>api('billing',{workspace_id:form.dataset.billing,billing_status:fields.get('billing_status'),amount_cents:Math.round(amount*100),verified_paid_through:fields.get('verified_paid_through')||null,confirm:fields.has('confirm')}));
  });
 }
 if(tab==='crm'){
  root.innerHTML='<div class="panel"><h2>Nova oportunidade</h2><form id="newdeal"><input name="name" placeholder="Escritório" maxlength="100" required><input name="contact" placeholder="Contato profissional" maxlength="120"><input name="value" type="number" min="0" step=".01" placeholder="Valor R$"><input name="next_action" maxlength="200" required placeholder="Próxima ação"><input name="next_date" type="date" required><button>Adicionar</button></form></div><div class="panel"><h2>Pipeline</h2><table><thead><tr><th>Escritório</th><th>Etapa</th><th>Valor</th><th>Próxima ação</th></tr></thead><tbody>'+
  deals.map(d=>'<tr><td>'+esc(d.name)+'</td><td><select data-stage="'+esc(d.id)+'">'+Object.keys(stages).map(k=>'<option value="'+k+'" '+(k===d.stage?'selected':'')+'>'+stages[k]+'</option>').join('')+'</select></td><td>'+money(d.value)+'</td><td>'+esc(d.next_action)+' · '+esc(d.next_date)+'</td></tr>').join('')+'</tbody></table></div>';
  root.querySelector('#newdeal').onsubmit=e=>{e.preventDefault();task(()=>api('deal',Object.fromEntries(new FormData(e.target))));};
  root.querySelectorAll('[data-stage]').forEach(node=>node.onchange=()=>task(()=>api('deal-status',{id:node.dataset.stage,stage:node.value})));
 }
 if(tab==='feedback'){
  const visible=feedback.filter(f=>(f.kind+' '+f.message+' '+(f.task_title||'')+' '+f.page).toLowerCase().includes(search.toLowerCase()));
  root.innerHTML='<div class="panel"><h2>Feedback e tarefas de melhoria</h2><p>Cada sugestão pode receber prioridade e ser transformada em tarefa interna, com acompanhamento de execução.</p><label>Busca <input id="feedback-search" value="'+esc(search)+'" placeholder="Buscar relato, tarefa ou página"></label><table><thead><tr><th>Origem / relato</th><th>Status da análise</th><th>Prioridade e tarefa</th></tr></thead><tbody>'+
    visible.map(f=>'<tr><td><strong>'+esc(types[f.kind]||f.kind)+'</strong><br>'+esc(f.message)+'<br><small>'+esc(f.page||'')+'</small></td><td><select data-feedback-status="'+esc(f.id)+'">'+Object.keys(statusLabels).map(k=>'<option value="'+k+'" '+(k===f.status?'selected':'')+'>'+statusLabels[k]+'</option>').join('')+'</select><br><small>'+esc(f.created_at||'')+'</small></td><td><form data-triage="'+esc(f.id)+'"><select name="priority">'+Object.keys(priorities).map(k=>'<option value="'+k+'" '+(k===f.priority?'selected':'')+'>'+priorities[k]+'</option>').join('')+'</select><input name="task_title" maxlength="120" placeholder="Título da tarefa" value="'+esc(f.task_title||'')+'"><select name="task_status">'+[['not_created','Sem tarefa'],['backlog','Backlog'],['doing','Em execução'],['done','Concluída']].map(([k,l])=>'<option value="'+k+'" '+(k===(f.task_status||'not_created')?'selected':'')+'>'+l+'</option>').join('')+'</select><input name="due_at" type="date" aria-label="Prazo interno" value="'+esc(f.due_at||'')+'"><button type="submit">Salvar tarefa</button></form></td></tr>').join('')+
   '</tbody></table></div>';
  root.querySelector('#feedback-search').onchange=e=>{search=e.target.value;render();};
  root.querySelectorAll('[data-feedback-status]').forEach(node=>node.onchange=()=>task(()=>api('feedback-status',{id:node.dataset.feedbackStatus,status:node.value})));
  root.querySelectorAll('[data-triage]').forEach(form=>form.onsubmit=e=>{e.preventDefault();const f=Object.fromEntries(new FormData(form));task(()=>api('feedback-triage',{id:form.dataset.triage,priority:f.priority,task_title:f.task_title,task_status:f.task_status,due_at:f.due_at||null}));});
 }
 if(tab==='support'){
  root.innerHTML='<div class="panel"><h2>Suporte remoto autorizado</h2><p>Somente leitura após autorização do gestor, válida por 60 minutos. A abertura fica registrada em auditoria.</p><div id="support-list">Consultando…</div><div id="support-view"></div></div>';
  api('workspaces').then(d=>{
   const list=root.querySelector('#support-list');if(!list)return;
   list.innerHTML=(d.workspaces||[]).map(w=>'<div class="panel">Escritório '+esc(w.id.slice(0,8))+' · '+esc(w.users)+' usuários · '+(w.grant?'Autorizado':'Sem autorização')+' <button data-support="'+esc(w.id)+'" '+(w.grant?'':'disabled')+'>Ver dados</button></div>').join('')||'Nenhum escritório.';
   list.querySelectorAll('[data-support]').forEach(button=>button.onclick=async()=>{
    try{const details=await api('support',{workspace_id:button.dataset.support});const view=root.querySelector('#support-view');if(!view)return;
      view.replaceChildren();const heading=document.createElement('h3');heading.textContent='Diagnóstico — somente leitura';view.append(heading);
      for(const [name,rows] of Object.entries(details.data||{})){if(!Array.isArray(rows))continue;const h=document.createElement('h4');h.textContent=name+' ('+rows.length+')';view.append(h);for(const record of rows.slice(0,20)){const pre=document.createElement('pre');pre.style.whiteSpace='pre-wrap';pre.style.overflowWrap='anywhere';pre.textContent=JSON.stringify(record,null,2);view.append(pre);}}
    }catch(err){notice.textContent=err.message;}
   });
  }).catch(err=>notice.textContent=err.message);
 }
}
document.querySelectorAll('[data-tab]').forEach(node=>node.onclick=()=>{tab=node.dataset.tab;render();});
await refresh();
})();