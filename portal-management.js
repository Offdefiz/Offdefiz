(()=>{'use strict';
const $=s=>document.querySelector(s),status=$('#status'),entries=$('#entries'),caseSelect=$('#case-select');
const el=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
const uuid=value=>/^[0-9a-f-]{36}$/i.test(value);
async function api(route,payload){const r=await fetch('/api/portal/'+route,{method:payload?'POST':'GET',headers:payload?{'Content-Type':'application/json'}:{},body:payload?JSON.stringify(payload):undefined}),d=await r.json();if(!r.ok)throw Error(d.error||'Falha');return d;}
async function execute(fn){try{status.textContent='Salvando…';await fn();status.textContent='Alteração confirmada.';await load();}catch(e){status.textContent=e.message;}}
async function load(){
 try{
  const d=await api('manage');caseSelect.replaceChildren();
  for(const c of d.cases||[])caseSelect.add(new Option(c.id+' · '+(c.status||'sem status'),c.id));
  entries.replaceChildren();
  if(!d.access?.length)entries.append(el('p','Nenhum acesso autorizado.'));
  for(const access of d.access||[]){
   const article=document.createElement('article'),h=el('h3',access.case_label),meta=el('small','Caso '+access.case_id+' · usuário '+access.client_user_id),p=el('p',access.revoked_at?'Acesso revogado':'Acesso ativo');
   article.append(h,meta,p);
   if(!access.revoked_at){
    const form=document.createElement('form'),label=el('label','Nova atualização aprovada'),message=document.createElement('textarea'),check=document.createElement('input'),button=el('button','Publicar atualização');
    message.required=true;message.minLength=8;message.maxLength=2000;message.placeholder='Atualização informativa revisada pelo gestor';check.type='checkbox';check.required=true;
    label.append(message);const confirm=el('label',' Confirmo a revisão humana antes da publicação.');confirm.prepend(check);form.append(label,confirm,button);
    form.onsubmit=e=>{e.preventDefault();execute(()=>api('publish',{access_id:access.id,message:message.value,confirm:check.checked}));};
    const revoke=el('button','Revogar acesso');revoke.className='secondary';revoke.type='button';revoke.onclick=()=>execute(()=>api('revoke',{access_id:access.id,confirm:true}));
    article.append(form,revoke);
   }
   const updates=(d.updates||[]).filter(u=>u.access_id===access.id);
   for(const u of updates){const box=el('p',u.body);box.style.whiteSpace='pre-wrap';article.append(el('small',new Date(u.published_at).toLocaleString('pt-BR')),box);}
   entries.append(article);
  }
  status.textContent='Informações publicadas somente após aprovação do gestor.';
 }catch(e){status.textContent=e.message;}
}
$('#grant').onsubmit=e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));if(!uuid(f.client_user_id)){status.textContent='Informe um identificador UUID válido de conta de teste.';return;}execute(()=>api('grant',{case_id:f.case_id,client_user_id:f.client_user_id,case_label:f.case_label,confirm:!!f.confirm}));};
load();
})();