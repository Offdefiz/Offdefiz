(()=>{'use strict';
const $=s=>document.querySelector(s),msg=$('#status');
function status(value,error=false){msg.textContent=value;msg.dataset.error=error?'true':'false';}
const el=(name,value)=>{const node=document.createElement(name);node.textContent=String(value??'');return node;};
async function api(url,data){
 const r=await fetch(url,{method:data===undefined?'GET':'POST',credentials:'same-origin',
  headers:data===undefined?{}:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});
 const v=await r.json();if(!r.ok)throw Error(v.error||'Operação não autorizada.');return v;
}
async function attempt(cb){try{await cb();status('Painel atualizado.');}catch(e){status(e.message,true);}}
function renderMetrics(data){
 const root=$('#metrics');root.replaceChildren();
 for(const [name,key] of [['Escritórios com acesso','workspacesWithAccess'],['Usuários vinculados','activeUsers'],
  ['Presenças recentes','onlineUsers'],['Beta testers','betaTesters'],
  ['Pagantes confirmados','payingWorkspacesVerified'],['Feedback pendente','feedbackPending'],
  ['Tarefas abertas','tasksOpen']]){
  const card=document.createElement('article');card.append(el('small',name),el('strong',data[key]??0));root.append(card);
 }
}
function renderUsers(users){
 const root=$('#users');root.replaceChildren();
 if(!users.length){root.append(el('p','Nenhum usuário cadastrado.'));return;}
 for(const user of users){
  const row=document.createElement('div');row.className='row';
  const info=document.createElement('div');info.className='info';
  info.append(el('strong',user.email),el('p','Perfil: '+user.role+' · escritório '+user.workspace_id));
  const btn=el('button',user.beta_tester?'Remover beta':'Marcar beta');
  btn.type='button';btn.onclick=()=>attempt(async()=>{
   btn.disabled=true;try{await api('/api/admin/ops/beta',{
    user_id:user.user_id,workspace_id:user.workspace_id,enabled:!user.beta_tester});await reload();
   }finally{btn.disabled=false;}
  });
  row.append(info,btn);root.append(row);
 }
}
function renderFeedback(list){
 const root=$('#feedback');root.replaceChildren();
 if(!list.length){root.append(el('p','Nenhuma sugestão registrada.'));return;}
 for(const f of list){
  const row=document.createElement('div');row.className='row';
  const info=document.createElement('div');info.className='info';
  info.append(el('strong',f.kind+' · '+f.status),el('p',f.message||''),el('small','Escritório: '+f.workspace_id+' · página: '+(f.page||'-')));
  const controls=document.createElement('div');controls.className='controls';
  if(f.task_id){
   controls.append(el('span','Tarefa '+f.priority+': '+f.task_title));
   const select=document.createElement('select');
   for(const st of ['backlog','planned','doing','done','dismissed']){
    const o=document.createElement('option');o.value=st;o.textContent=st;select.append(o);
   }
   select.value=f.task_status;
   select.onchange=()=>attempt(async()=>{await api('/api/admin/ops/task-status',{id:f.task_id,status:select.value});await reload();});
   controls.append(select);
  }else{
   const input=document.createElement('input');input.maxLength=160;input.value='Analisar: '+String(f.message||'').slice(0,110);
   input.setAttribute('aria-label','Título da tarefa');
   const priority=document.createElement('select');priority.setAttribute('aria-label','Prioridade');
   for(const pr of ['P0','P1','P2','P3']){const o=document.createElement('option');o.value=pr;o.textContent=pr;priority.append(o);}
   priority.value='P2';
   const create=el('button','Criar tarefa');
   create.type='button';create.onclick=()=>attempt(async()=>{
    create.disabled=true;try{await api('/api/admin/ops/task',{id:f.id,title:input.value,priority:priority.value});await reload();}
    finally{create.disabled=false;}
   });
   controls.append(input,priority,create);
  }
  row.append(info,controls);root.append(row);
 }
}
async function reload(){
 const [metrics,users,feedback]=await Promise.all([
  api('/api/admin/ops/metrics'),api('/api/admin/ops/users'),api('/api/admin/ops/feedback')
 ]);
 renderMetrics(metrics);renderUsers(users.items||[]);renderFeedback(feedback.items||[]);
 status('Dados atualizados. Contagem de presença aproximada e pagantes verificados.');
}
$('#reload').onclick=()=>attempt(reload);
attempt(reload);
})();