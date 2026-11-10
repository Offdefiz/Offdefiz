(()=>{'use strict';
const $=s=>document.querySelector(s),state={areas:[],processes:[],people:[],process:null,editingArea:null,role:''};
const status=$('#status');
function say(message,error=false){status.textContent=message;status.dataset.error=error?'true':'false';}
async function api(path,body){
 const response=await fetch(path,{method:body===undefined?'GET':'POST',credentials:'same-origin',
  headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 let result;try{result=await response.json();}catch{throw Error('Resposta inválida do servidor.');}
 if(!response.ok)throw Error(result.error||'Operação não autorizada ou indisponível.');
 return result;
}
async function safely(job){try{await job();say('Operação concluída. Nenhum prazo fatal foi gerado.');}catch(e){say(e.message,true);}}
const text=(tag,value)=>{const el=document.createElement(tag);el.textContent=String(value??'');return el;};
function option(value,name){const o=document.createElement('option');o.value=value;o.textContent=name;return o;}
function setOptions(select,rows,empty){
 const prev=select.value;select.replaceChildren();if(empty!==null)select.add(option('',empty));
 for(const a of rows)select.add(option(a.id,a.name));
 if([...select.options].some(x=>x.value===prev))select.value=prev;
}
function area(){return state.areas.find(x=>x.id===$('#newProcessArea').value);}
function renderAreaFields(){
 const a=area(),phase=$('#newProcessPhase'),custom=$('#customInputs');
 phase.replaceChildren();custom.replaceChildren();
 if(!a)return;
 for(const v of a.stages||[])phase.add(option(v,v));
 for(const field of a.fields||[]){
  const label=text('label',field.label||field.key);
  let input;
  if(field.type==='select'){input=document.createElement('select');for(const opt of field.options||[])input.add(option(opt,opt));}
  else{
   input=document.createElement('input');
   input.type=field.type==='date'?'date':field.type==='boolean'?'checkbox':'text';
   if(field.type==='money')input.placeholder='Ex.: 1500,00';
  }
  input.dataset.field=field.key;input.dataset.type=field.type;
  input.required=field.required===true&&field.type!=='boolean';
  if(field.type!=='boolean')input.maxLength=field.type==='textarea'?4000:1000;
  label.append(input);custom.append(label);
 }
}
async function loadAreas(){
 const result=await api('/api/legal/areas');state.areas=result.items;
 const list=state.areas.map(x=>({id:x.id,name:x.name+(x.active?'':' (inativa)')}));
 setOptions($('#areaSelect'),list,'Selecione uma área');
 setOptions($('#newProcessArea'),list,null);
 setOptions($('#processArea'),list,'Todas as áreas');
 renderAreaFields();
}
function fillAreaEditor(a){
 state.editingArea=a||null;$('#areaCode').value=a?.code||'';$('#areaCode').readOnly=Boolean(a);
 $('#areaName').value=a?.name||'';
 $('#areaStages').value=(a?.stages||['Recebido','Em andamento','Concluído']).join('\n');
 for(const [field,key] of [['areaFields','fields'],['areaClasses','classes'],['areaSubjects','subjects'],['areaTemplates','templates']])
  $('#'+field).value=JSON.stringify(a?.[key]||[],null,2);
 $('#areaEditor').open=true;
}
function parseArray(id){
 let value;try{value=JSON.parse($('#'+id).value||'[]');}catch{throw Error('JSON inválido em '+id);}
 if(!Array.isArray(value))throw Error('Informe uma lista JSON em '+id);
 return value;
}
async function saveArea(event){
 event.preventDefault();const data={
  ...(state.editingArea?{id:state.editingArea.id}:{}),
  code:$('#areaCode').value.trim(),name:$('#areaName').value.trim(),
  stages:$('#areaStages').value.split('\n').map(x=>x.trim()).filter(Boolean),
  fields:parseArray('areaFields'),classes:parseArray('areaClasses'),
  subjects:parseArray('areaSubjects'),templates:parseArray('areaTemplates')
 };
 await api('/api/legal/areas',data);await loadAreas();$('#areaEditor').open=false;state.editingArea=null;
}
async function loadProcesses(){
 const areaId=$('#processArea').value;
 const r=await api('/api/legal/processes'+(areaId?'?area_id='+encodeURIComponent(areaId):''));
 state.processes=r.items;renderProcesses();
}
function renderProcesses(){
 const container=$('#processList');container.replaceChildren();
 if(!state.processes.length){container.append(text('p','Nenhum processo cadastrado para este filtro.'));return;}
 for(const p of state.processes){
  const row=document.createElement('div');row.className='row';
  const info=document.createElement('div');info.append(text('strong',p.title));
  info.append(text('p',(state.areas.find(x=>x.id===p.area_id)?.name||'Área')+' · '+
   (p.process_number||'Sem número CNJ')+' · '+p.status+(p.secret?' · acesso restrito':'')));
  const btn=text('button','Abrir');btn.type='button';btn.onclick=()=>safely(()=>openProcess(p.id));
  row.append(info,btn);container.append(row);
 }
}
function toCents(value){
 const raw=String(value||'').trim();if(!raw)return null;
 if(!/^\d+(?:[,.]\d{1,2})?$/.test(raw))throw Error('Valor monetário inválido: use 1500,00.');
 const [reais,centavos='']=raw.replace(',','.').split('.');
 const number=BigInt(reais)*100n+BigInt((centavos+'00').slice(0,2));
 if(number>BigInt(Number.MAX_SAFE_INTEGER))throw Error('Valor monetário acima do limite.');
 return Number(number);
}
function customValues(){
 const values={};
 for(const field of $('#customInputs').querySelectorAll('[data-field]')){
  const key=field.dataset.field,kind=field.dataset.type,raw=kind==='boolean'?field.checked:field.value.trim();
  if(kind==='boolean')values[key]=raw;
  else if(raw!=='')values[key]=kind==='money'?toCents(raw):raw;
 }
 return values;
}
async function saveProcess(event){
 event.preventDefault();
 const form=new FormData(event.target),payload={area_id:$('#newProcessArea').value,
  title:String(form.get('title')||''),kind:String(form.get('kind')||'judicial'),
  process_number:String(form.get('process_number')||'').trim()||null,
  court:String(form.get('court')||'').trim(),judicial_body:String(form.get('judicial_body')||'').trim(),
  district:String(form.get('district')||'').trim(),degree:String(form.get('degree')||'').trim(),
  procedure_type:String(form.get('procedure_type')||'').trim(),
  phase:String(form.get('phase')||''),claim_cents:toCents(form.get('claim')),
  custom_fields:customValues(),secret:form.has('secret')};
 const record=await api('/api/legal/processes',payload);
 event.target.reset();renderAreaFields();$('#processEditor').open=false;
 await loadProcesses();await openProcess(record.id);
}
async function openProcess(id){
 const p=await api('/api/legal/processes/'+id);
 state.process=p;$('#detailCard').hidden=false;$('#detailTitle').textContent=p.title;
 $('#detailInfo').textContent=[p.process_number||'Sem número CNJ',p.court||'Sem tribunal',
  'Fase: '+p.phase,'Status: '+p.status,p.secret?'Acesso restrito':''].filter(Boolean).join(' · ');
 $('#archive').disabled=p.status==='archived';$('#reopen').disabled=p.status==='active';
 await loadMovements();await loadIntegration();$('#detailCard').scrollIntoView({block:'start',behavior:'smooth'});
}
async function loadIntegration(){
 let root=$('#cnjIntegration');
 if(!root){root=document.createElement('div');root.id='cnjIntegration';$('#detailInfo').after(root);}
 root.replaceChildren();
 const p=state.process;
 const result=await api('/api/legal/processes/'+p.id+'/integrations');
 for(const item of result.items)root.append(text('p',item.provider+' · '+item.status+' · '+(item.last_synced_at||'Sem sincronização')));
 if(p.secret||!p.process_number)return;
 if(!['gestor','socio_admin','advogado','juridico'].includes(state.role))return;
 const label=text('label','Tribunal DataJud (ex.: tjmg, trf6, trt3)');
 const alias=document.createElement('input');alias.maxLength=24;label.append(alias);
 const button=text('button','Consultar DataJud');button.type='button';
 button.onclick=()=>safely(async()=>{
  button.disabled=true;
  try{const answer=await api('/api/legal/processes/'+p.id+'/sync-datajud',{tribunal_alias:alias.value.trim()});
   root.append(text('p',answer.found?answer.created+' novos andamentos.':'Processo não localizado nesta fonte.'));
   for(const suggestion of answer.suggestions||[])root.append(text('p','Revisar possível prazo: '+suggestion.description));
   await loadMovements();
  }finally{button.disabled=false;}
 });
 root.append(label,button);
 const base='/api/legal/processes/'+p.id;
 const queueState=await api(base+'/cnj-status');
 const reload=text('button','Atualizar integrações e intimações');reload.type='button';reload.onclick=()=>safely(loadIntegration);root.append(reload);
 for(const job of queueState.jobs)root.append(text('p',job.provider+' · '+job.status+' · tentativas: '+job.attempts+(job.last_error_code?' · '+job.last_error_code:'')));
 for(const source of ['djen','datajud']){
  const sync=text('button','Sincronizar '+source+' pela fila');sync.type='button';
  sync.onclick=()=>safely(async()=>{sync.disabled=true;try{await api(base+'/cnj-jobs',{provider:source,tribunal_alias:alias.value.trim()});await loadIntegration();}finally{sync.disabled=false;}});
  const watch=text('button','Monitorar '+source+' a cada hora');watch.type='button';
  watch.onclick=()=>safely(async()=>{await api(base+'/monitor',{provider:source,tribunal_alias:alias.value.trim(),enabled:true});await loadIntegration();});
  const stop=text('button','Pausar '+source);stop.type='button';stop.onclick=()=>safely(async()=>{await api(base+'/monitor',{provider:source,enabled:false});await loadIntegration();});
  root.append(sync,watch,stop);
 }
 root.append(text('h3','Caixa de intimações · revisão humana'));
 const box=await api(base+'/publications');
 if(!box.items.length)root.append(text('p','Nenhuma publicação recebida para este processo.'));
 for(const publication of box.items){
  const card=document.createElement('div');card.className='card';
  card.append(text('strong',publication.available_date.slice(0,10)+' · '+publication.review_status+(publication.read_at?' · lida':' · não lida')));
  card.append(text('p',publication.summary));
  for(const [title,reviewStatus]of [['Marcar como lida',undefined],['Revisada','reviewed'],['Descartar','dismissed']]){
   const action=text('button',title);action.type='button';
   action.onclick=()=>safely(async()=>{await api(base+'/publication-review',{publication_id:publication.id,...(reviewStatus?{status:reviewStatus}:{})});await loadIntegration();});
   card.append(action);
  }
  root.append(card);
 }
}
async function loadMovements(){
 const p=state.process;if(!p)return;
 const r=await api('/api/legal/processes/'+p.id+'/movements'),root=$('#movementList');root.replaceChildren();
 if(!r.items.length){root.append(text('p','Sem movimentações registradas.'));return;}
 for(const m of r.items){const node=document.createElement('div');node.className='row';
  node.append(text('span',String(m.movement_date).slice(0,10)+' · '+m.description+' · '+m.origin));root.append(node);}
}
async function saveMovement(event){
 event.preventDefault();if(!state.process)throw Error('Selecione um processo.');
 const form=new FormData(event.target);
 const data={date:String(form.get('date')),description:String(form.get('description')),
  tpu_code:String(form.get('tpu_code')||''),origin:'manual'};
 const result=await api('/api/legal/processes/'+state.process.id+'/movements',data);
 if(!result.created)say('Andamento idêntico já existia. Nenhuma duplicação foi feita.');
 event.target.reset();await loadMovements();
}
async function setProcessStatus(reopen){
 if(!state.process)return;
 await api('/api/legal/processes/'+state.process.id+(reopen?'/reopen':'/archive'),{});
 await loadProcesses();await openProcess(state.process.id);
}
async function loadPeople(){
 const r=await api('/api/legal/people');state.people=r.items;
 const root=$('#peopleList');root.replaceChildren();
 if(!state.people.length)root.append(text('p','Nenhuma pessoa cadastrada.'));
 for(const p of state.people){const row=document.createElement('div');row.className='row';
  row.append(text('span',p.display_name+' · '+p.kind+(p.tax_id?' · '+p.tax_id:'')));root.append(row);}
 const selector=$('#partyPerson');selector.replaceChildren();
 for(const p of state.people)selector.add(option(p.id,p.display_name+' · '+p.kind));
}
async function savePerson(event){
 event.preventDefault();const input=new FormData(event.target);
 const data=Object.fromEntries(input.entries());await api('/api/legal/people',data);
 event.target.reset();await loadPeople();
}
async function saveParty(event){
 event.preventDefault();if(!state.process)throw Error('Selecione um processo.');
 const input=new FormData(event.target);
 await api('/api/legal/processes/'+state.process.id+'/parties',{
  person_id:$('#partyPerson').value,role:String(input.get('role')||'').trim()});
 event.target.reset();
}
function wire(){
 $('#editArea').onclick=()=>fillAreaEditor(state.areas.find(x=>x.id===$('#areaSelect').value));
 $('#newArea').onclick=()=>fillAreaEditor(null);
 $('#newProcessArea').onchange=renderAreaFields;
 $('#processArea').onchange=()=>safely(loadProcesses);
 $('#refresh').onclick=()=>safely(async()=>{await loadAreas();await loadProcesses();await loadPeople();});
 for(const [id,func] of [['areaForm',saveArea],['processForm',saveProcess],['personForm',savePerson],
  ['movementForm',saveMovement],['partyForm',saveParty]]){
  $('#'+id).addEventListener('submit',event=>safely(()=>func(event)));
 }
 $('#archive').onclick=()=>safely(()=>setProcessStatus(false));
 $('#reopen').onclick=()=>safely(()=>setProcessStatus(true));
}
(async()=>{
 wire();
 try{
  const user=await api('/api/state');
  state.role=user.user?.role||'';
  const allowed=['gestor','socio_admin','advogado','juridico'];
  if(!allowed.includes(state.role)){
   $('#processEditor').remove();$('#areaEditor').remove();$('#newArea').disabled=true;$('#editArea').disabled=true;
  }
  await loadAreas();await Promise.all([loadProcesses(),loadPeople()]);
  say('Acesso validado para o escritório. Cadastros processuais não são sincronizados automaticamente.');
 }catch(error){say(error.message,true);}
})();
})();