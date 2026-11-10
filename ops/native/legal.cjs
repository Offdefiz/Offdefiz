'use strict';
// Serviço processual isolado: todo ID é combinado com workspace derivado da sessão.
// Não habilita consulta externa, contagem fatal ou portais de clientes.
const {pool,transaction,fail}=require('./db.cjs');
const L=require('../../lib/legal-core.cjs');
const uuid=v=>typeof v==='string'&&/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(v);
const short=(v,max=200)=>typeof v==='string'?v.trim().slice(0,max+1):'';
const denied=()=>fail(404,'Registro não encontrado ou acesso não autorizado.');
const requireRole=(role,right)=>{if(!L.may(role,right))throw fail(403,'Seu perfil não tem permissão para esta operação.');};
const manager=role=>L.may(role,'legalAdmin');
async function audit(conn,actor,event,entity,entityId,processId=null){
 await conn.query(
  'INSERT INTO cj_legal_access_audit(workspace_id,actor_id,process_id,entity,entity_id,event,ip) VALUES($1,$2,$3,$4,$5,$6,$7)',
  [actor.workspace,actor.userId,processId,entity,entityId,event,actor.ip||null]);
}
async function ensureAreas(workspace){
 const payload=JSON.stringify(L.DEFAULT_AREAS);
 await pool.query(
  'INSERT INTO cj_practice_areas(workspace_id,code,name,stages,fields,classes,subjects,templates) '+
  'SELECT $1,r.code,r.name,r.stages,r.fields,r.classes,r.subjects,r.templates FROM '+
  'jsonb_to_recordset($2::jsonb) AS r(code text,name text,stages jsonb,fields jsonb,classes jsonb,subjects jsonb,templates jsonb) '+
  'WHERE NOT EXISTS (SELECT 1 FROM cj_practice_areas WHERE workspace_id=$1) '+
  'ON CONFLICT(workspace_id,code) DO NOTHING',[workspace,payload]);
}
async function getProcess(actor,id,{edit=false,connection=pool,auditRead=false}={}){
 if(!uuid(id))throw denied();
 requireRole(actor.role,edit?'legalWrite':'legalRead');
 const {rows:[record]}=await connection.query(
  'SELECT p.* FROM cj_legal_processes p WHERE p.workspace_id=$1 AND p.id=$4 '+
  'AND (NOT p.secret OR $3::boolean OR EXISTS ('+
  'SELECT 1 FROM cj_process_access a WHERE a.workspace_id=p.workspace_id AND a.process_id=p.id '+
  'AND a.user_id=$2 AND '+(edit?'a.can_edit':'a.can_read')+'))',
  [actor.workspace,actor.userId,manager(actor.role),id]);
 if(!record)throw denied();
 if(auditRead)await audit(connection,actor,'read','process',record.id,record.id);
 return record;
}
async function listAreas(actor){
 await ensureAreas(actor.workspace);
 const {rows}=await pool.query(
  'SELECT id,code,name,stages,classes,subjects,fields,templates,active,updated_at FROM cj_practice_areas '+
  'WHERE workspace_id=$1 ORDER BY name',[actor.workspace]);
 return {items:rows};
}
function areaPayload(body){
 const code=short(body.code,60),name=short(body.name,120);
 if(!/^[a-z][a-z0-9_]{1,59}$/.test(code)||name.length<2||name.length>120)throw fail(400,'Nome ou identificador de área inválido.');
 for(const key of ['stages','fields','classes','subjects','templates']){
  if(!Array.isArray(body[key])||body[key].length>200)throw fail(400,'Configuração inválida: '+key);
 }
 const keys=new Set();
 for(const field of body.fields){
  if(!field||typeof field.key!=='string'||!/^[a-z][a-z0-9_]{0,59}$/.test(field.key)
   ||keys.has(field.key)||!['text','textarea','boolean','date','decimal','money','select'].includes(field.type))
   throw fail(400,'Campos personalizados inválidos.');
  keys.add(field.key);
  if(field.type==='select'&&(!Array.isArray(field.options)||!field.options.every(x=>typeof x==='string'&&x.length<=100)))
   throw fail(400,'Opções de campo inválidas.');
 }
 if(body.stages.some(x=>typeof x!=='string'||x.length>100))throw fail(400,'Etapas inválidas.');
 return {code,name,stages:body.stages,fields:body.fields,classes:body.classes,subjects:body.subjects,templates:body.templates};
}
async function saveArea(actor,body){
 requireRole(actor.role,'legalAdmin');
 const p=areaPayload(body);
 const id=body.id||null;
 if(id&&!uuid(id))throw fail(400,'Área inválida.');
 return transaction(async client=>{
  let result;
  if(id){
   const r=await client.query(
    'UPDATE cj_practice_areas SET name=$3,stages=$4,fields=$5,classes=$6,subjects=$7,templates=$8,updated_at=now() '+
    'WHERE workspace_id=$1 AND id=$2 AND code=$9 RETURNING id,code,name,stages,fields,classes,subjects,templates',
    [actor.workspace,id,p.name,p.stages,p.fields,p.classes,p.subjects,p.templates,p.code]);
   result=r.rows[0];
  }else{
   await ensureAreas(actor.workspace);
   const r=await client.query(
    'INSERT INTO cj_practice_areas(workspace_id,code,name,stages,fields,classes,subjects,templates) '+
    'VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,code,name,stages,fields,classes,subjects,templates',
    [actor.workspace,p.code,p.name,p.stages,p.fields,p.classes,p.subjects,p.templates]);
   result=r.rows[0];
  }
  if(!result)throw denied();
  await audit(client,actor,id?'update':'create','area',result.id);
  return result;
 }).catch(e=>{if(e.code==='23505')throw fail(409,'Área com este identificador já cadastrada.');throw e;});
}
async function listProcesses(actor,areaId){
 requireRole(actor.role,'legalRead');
 if(areaId&&!uuid(areaId))throw fail(400,'Área inválida.');
 const {rows}=await pool.query(
  'SELECT p.id,p.area_id,p.process_number,p.title,p.kind,p.phase,p.status,p.secret,p.court,p.updated_at '+
  'FROM cj_legal_processes p WHERE p.workspace_id=$1 '+
  'AND (NOT p.secret OR $3::boolean OR EXISTS (SELECT 1 FROM cj_process_access a '+
  'WHERE a.workspace_id=p.workspace_id AND a.process_id=p.id AND a.user_id=$2 AND a.can_read)) '+
  'AND ($4::uuid IS NULL OR p.area_id=$4::uuid) ORDER BY p.updated_at DESC LIMIT 100',
  [actor.workspace,actor.userId,manager(actor.role),areaId||null]);
 return {items:rows};
}
async function createProcess(actor,body){
 requireRole(actor.role,'legalWrite');
 if(!uuid(body.area_id))throw fail(400,'Selecione uma área válida.');
 const kind=['judicial','administrative','extrajudicial','consultive'].includes(body.kind)?body.kind:'judicial';
 const title=short(body.title);
 if(title.length<2||title.length>200)throw fail(400,'Informe o título do processo.');
 const raw=body.process_number===null||body.process_number===undefined||body.process_number===''?null:String(body.process_number);
 if(raw!==null&&(!/^[\d.\-]+$/.test(raw)||!L.cnjValid(raw)))throw fail(400,'Número do processo CNJ inválido.');
 const processNumber=raw===null?null:raw.replace(/\D/g,'');
 const claim=body.claim_cents;
 if(claim!==null&&claim!==undefined&&(!Number.isSafeInteger(claim)||claim<0))throw fail(400,'Valor da causa deve ser centavos inteiros.');
 const assignee=body.responsible_user_id||actor.userId;
 if(!uuid(assignee))throw fail(400,'Responsável inválido.');
 return transaction(async client=>{
  const {rows:[area]}=await client.query(
   'SELECT fields,stages FROM cj_practice_areas WHERE workspace_id=$1 AND id=$2 AND active',
   [actor.workspace,body.area_id]);
  if(!area)throw denied();
  const {rowCount}=await client.query('SELECT 1 FROM cj_memberships WHERE workspace_id=$1 AND user_id=$2',[actor.workspace,assignee]);
  if(!rowCount)throw fail(400,'O responsável deve pertencer a este escritório.');
  const custom=body.custom_fields||{};
  try{L.validateCustomValues(area.fields,custom);}catch(e){throw fail(400,e.message);}
  const phase=body.phase===undefined?(area.stages[0]||'Recebido'):short(body.phase,100);
  if(!area.stages.includes(phase))throw fail(400,'Fase não configurada para a área.');
  const {rows:[record]}=await client.query(
   'INSERT INTO cj_legal_processes(workspace_id,area_id,kind,process_number,title,court,judicial_body,district,degree,'+
   'class_tpu,subjects_tpu,claim_cents,procedure_type,phase,responsible_user_id,custom_fields,secret,created_by) '+
   'VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *',
   [actor.workspace,body.area_id,kind,processNumber,title,short(body.court,120)||null,
    short(body.judicial_body,120)||null,short(body.district,120)||null,short(body.degree,60)||null,
    body.class_tpu||{},body.subjects_tpu||[],claim??null,short(body.procedure_type,100)||null,
    phase,assignee,custom,body.secret===true,actor.userId]);
  for(const id of new Set([actor.userId,assignee])){
   await client.query('INSERT INTO cj_process_access(workspace_id,process_id,user_id,can_read,can_edit,granted_by) '+
    'VALUES($1,$2,$3,true,true,$4) ON CONFLICT DO NOTHING',[actor.workspace,record.id,id,actor.userId]);
  }
  await audit(client,actor,'create','process',record.id,record.id);
  return record;
 }).catch(e=>{if(e.code==='23505')throw fail(409,'Este número CNJ já está cadastrado no escritório.');throw e;});
}
async function listPeople(actor){
 requireRole(actor.role,'legalRead');
 const {rows}=await pool.query(
  'SELECT p.id,p.kind,p.display_name,p.tax_id,p.legal_name,p.updated_at FROM cj_legal_people p '+
  'WHERE p.workspace_id=$1 AND ('+
  'NOT EXISTS(SELECT 1 FROM cj_process_parties x WHERE x.workspace_id=p.workspace_id AND x.person_id=p.id) '+
  'OR EXISTS(SELECT 1 FROM cj_process_parties x JOIN cj_legal_processes c '+
  'ON c.workspace_id=x.workspace_id AND c.id=x.process_id '+
  'WHERE x.workspace_id=p.workspace_id AND x.person_id=p.id '+
  'AND (NOT c.secret OR $3::boolean OR EXISTS('+
  'SELECT 1 FROM cj_process_access a WHERE a.workspace_id=c.workspace_id AND a.process_id=c.id '+
  'AND a.user_id=$2 AND a.can_read)))) '+
  'ORDER BY p.updated_at DESC LIMIT 100',
  [actor.workspace,actor.userId,manager(actor.role)]);
 return {items:rows};
}
async function createPerson(actor,body){
 requireRole(actor.role,'legalWrite');
 const kind=body.kind,display=short(body.display_name),taxRaw=body.tax_id;
 if(!['PF','PJ'].includes(kind)||display.length<2||display.length>200)throw fail(400,'Nome ou tipo de pessoa inválido.');
 const taxId=taxRaw?(kind==='PF'?String(taxRaw).replace(/\D/g,''):L.normalizedCnpj(taxRaw)):null;
 if(taxId&&!(kind==='PF'?L.cpfValid(taxId):L.cnpjValid(taxId)))throw fail(400,'CPF/CNPJ inválido.');
 const zip=body.zip_code?String(body.zip_code).replace(/\D/g,''):null;
 if(zip&&zip.length!==8)throw fail(400,'CEP inválido.');
 const details={rg:short(body.rg,30),marital:short(body.marital_status,50),profession:short(body.profession,100),
  legal:short(body.legal_name,200),representatives:body.representatives||[],partners:body.partners||[],
  address:body.address||{}};
 if(!Array.isArray(details.representatives)||!Array.isArray(details.partners)||
  typeof details.address!=='object'||details.address===null||Array.isArray(details.address))
  throw fail(400,'Representantes ou endereço inválidos.');
 return transaction(async client=>{
  const {rows:[person]}=await client.query(
   'INSERT INTO cj_legal_people(workspace_id,kind,display_name,tax_id,rg,marital_status,profession,zip_code,'+
   'legal_name,representatives,partners,address) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *',
   [actor.workspace,kind,display,taxId,details.rg,details.marital,details.profession,zip,details.legal,
    details.representatives,details.partners,details.address]);
  await audit(client,actor,'create','person',person.id);
  return person;
 }).catch(e=>{if(e.code==='23505')throw fail(409,'CPF/CNPJ já cadastrado neste escritório.');throw e;});
}
async function addParty(actor,processId,body){
 requireRole(actor.role,'legalWrite');
 if(!uuid(body.person_id)||!short(body.role,80)||short(body.role,80).length>80)throw fail(400,'Pessoa ou papel inválido.');
 return transaction(async client=>{
  await getProcess(actor,processId,{edit:true,connection:client});
  const {rows:[party]}=await client.query(
   'INSERT INTO cj_process_parties(workspace_id,process_id,person_id,role) '+
   'SELECT $1,$2,p.id,$4 FROM cj_legal_people p WHERE p.workspace_id=$1 AND p.id=$3 '+
   'ON CONFLICT DO NOTHING RETURNING *',[actor.workspace,processId,body.person_id,short(body.role,80)]);
  if(!party)throw fail(409,'Pessoa ausente, de outro escritório ou já vinculada com este papel.');
  await audit(client,actor,'link','party',party.id,processId);
  return party;
 });
}
async function addMovement(actor,processId,body){
 requireRole(actor.role,'legalWrite');
 const description=short(body.description,3000);
 if(!description||!['manual'].includes(body.origin||'manual'))throw fail(400,'Andamento manual inválido.');
 let hash;try{hash=L.movementFingerprint({workspaceId:actor.workspace,processId,
    date:body.date,description,tpuCode:body.tpu_code});}catch(e){throw fail(400,e.message);}
 return transaction(async client=>{
  await getProcess(actor,processId,{edit:true,connection:client});
  const r=await client.query(
   'INSERT INTO cj_process_movements(workspace_id,process_id,movement_date,description,tpu_code,origin,fingerprint) '+
   'VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(workspace_id,process_id,fingerprint) DO NOTHING RETURNING id',
   [actor.workspace,processId,body.date,description,short(body.tpu_code,50)||null,'manual',hash]);
  if(r.rowCount)await audit(client,actor,'create','movement',r.rows[0].id,processId);
  return {created:!!r.rowCount,fingerprint:hash};
 });
}
async function listMovements(actor,processId){
 await getProcess(actor,processId,{auditRead:true});
 const {rows}=await pool.query('SELECT id,movement_date,description,tpu_code,origin,document_id FROM cj_process_movements '+
  'WHERE workspace_id=$1 AND process_id=$2 ORDER BY movement_date DESC,id DESC LIMIT 200',[actor.workspace,processId]);
 return {items:rows};
}
async function archiveProcess(actor,id,reopen){
 return transaction(async client=>{
  const record=await getProcess(actor,id,{edit:true,connection:client});
  const status=reopen?'active':'archived';
  const {rows:[updated]}=await client.query(
   'UPDATE cj_legal_processes SET status=$3,archived_at=$4,updated_at=now() WHERE workspace_id=$1 AND id=$2 RETURNING *',
   [actor.workspace,record.id,status,reopen?null:new Date().toISOString()]);
  await audit(client,actor,reopen?'reopen':'archive','process',record.id,record.id);
  return updated;
 });
}

async function integrationStatus(actor,id){
 await getProcess(actor,id,{auditRead:true});
 const {rows}=await pool.query(
  'SELECT provider,last_synced_at,status,last_error_code,retry_count FROM cj_integration_status WHERE workspace_id=$1 AND process_id=$2 ORDER BY provider',
  [actor.workspace,id]);
 return {items:rows};
}
async function syncDatajud(actor,id,body){
 requireRole(actor.role,'legalWrite');
 const record=await getProcess(actor,id,{edit:true});
 if(record.secret)throw fail(403,'Consulta externa indisponível para processo sigiloso.');
 if(!record.process_number)throw fail(400,'Informe um número CNJ antes da consulta.');
 if(process.env.PARTELIS_DATAJUD_ENABLED!=='true'||!process.env.DATAJUD_API_KEY)
  throw fail(503,'DataJud ainda não configurado para este ambiente.');
 const alias=String(body.tribunal_alias||'').toLowerCase();
 if(!/^(?:stj|stm|tst|tse|trf[1-6]|trt(?:[1-9]|1[0-9]|2[0-4])|tj(?:[a-z]{2}|dft)|tjm(?:mg|rs|sp)|tre-[a-z]{2,3})$/.test(alias))
  throw fail(400,'Selecione um tribunal válido do DataJud.');
 const {DataJudProvider}=require('../../lib/process-providers.cjs');
 const provider=new DataJudProvider({httpClient:(url,opts)=>fetch(url,{...opts,signal:AbortSignal.timeout(15000),redirect:'error'}),key:process.env.DATAJUD_API_KEY});
 let result;
 try{result=await provider.searchByNumber(record.process_number,{tribunalAlias:alias});}
 catch(error){
  await pool.query('INSERT INTO cj_integration_status(workspace_id,process_id,provider,status,last_error_code,retry_count) VALUES($1,$2,$3,$4,$5,1) ON CONFLICT(workspace_id,process_id,provider) DO UPDATE SET status=$4,last_error_code=$5,retry_count=cj_integration_status.retry_count+1',
   [actor.workspace,id,'datajud','error','REMOTE_UNAVAILABLE']);
  throw fail(502,'Não foi possível consultar o DataJud. Tente novamente mais tarde.');
 }
 if(result.restricted)throw fail(403,'O CNJ restringe a consulta deste processo.');
 return transaction(async client=>{
  const current=await getProcess(actor,id,{edit:true,connection:client});
  if(current.secret||current.process_number!==record.process_number)throw fail(409,'O processo mudou durante a consulta. Recarregue.');
  let created=0;
  for(const movement of result.movements.slice(0,500)){
   const fingerprint=L.movementFingerprint({workspaceId:actor.workspace,processId:id,
    date:movement.date,description:movement.description,tpuCode:movement.tpuCode});
   const {rowCount}=await client.query(
    'INSERT INTO cj_process_movements(workspace_id,process_id,movement_date,description,tpu_code,origin,fingerprint) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(workspace_id,process_id,fingerprint) DO NOTHING',
    [actor.workspace,id,movement.date,movement.description,movement.tpuCode,'synchronized',fingerprint]);
   created+=rowCount;
  }
  if(result.found){
   await client.query('UPDATE cj_legal_processes SET court=COALESCE($3,court), degree=COALESCE($4,degree), class_tpu=COALESCE($5,class_tpu), subjects_tpu=COALESCE($6,subjects_tpu), judicial_body=COALESCE($7,judicial_body),updated_at=now() WHERE workspace_id=$1 AND id=$2',
    [actor.workspace,id,result.tribunal,result.degree,JSON.stringify(result.processClass),JSON.stringify(result.subjects),
     typeof result.judicialBody==='object'?result.judicialBody?.nome||null:result.judicialBody]);
  }
  await client.query('INSERT INTO cj_integration_status(workspace_id,process_id,provider,last_synced_at,status,last_error_code,retry_count) VALUES($1,$2,$3,now(),$4,NULL,0) ON CONFLICT(workspace_id,process_id,provider) DO UPDATE SET last_synced_at=now(),status=$4,last_error_code=NULL,retry_count=0',
   [actor.workspace,id,'datajud',result.found?'ok':'not_found']);
  await audit(client,actor,'sync','process',id,id);
  return {found:result.found,created,movements:result.movements.length,
   suggestions:result.movements.filter(x=>x.needsHumanReview).map(x=>({date:x.date,description:x.description.slice(0,200),reviewRequired:true,isFatal:false})),
   last_synced_at:new Date().toISOString()};
 });
}

async function handle(route,{method,body={},actor}){
 const url=new URL(route,'http://internal');
 const parts=url.pathname.split('/').filter(Boolean);
 if(parts[0]!=='api'||parts[1]!=='legal')throw denied();
 if(parts[2]==='areas'&&parts.length===3&&method==='GET')return listAreas(actor);
 if(parts[2]==='areas'&&parts.length===3&&method==='POST')return saveArea(actor,body);
 if(parts[2]==='people'&&parts.length===3&&method==='GET')return listPeople(actor);
 if(parts[2]==='people'&&parts.length===3&&method==='POST')return createPerson(actor,body);
 if(parts[2]==='processes'&&parts.length===3&&method==='GET')return listProcesses(actor,url.searchParams.get('area_id'));
 if(parts[2]==='processes'&&parts.length===3&&method==='POST')return createProcess(actor,body);
 if(parts[2]==='processes'&&parts.length>=4){
  const id=parts[3];
  if(parts.length===4&&method==='GET')return getProcess(actor,id,{auditRead:true});
  if(parts.length===5){
   const cnj=require('./cnj.cjs');
   if(parts[4]==='cnj-jobs'&&method==='POST')return cnj.enqueue(actor,id,body);
   if(parts[4]==='cnj-status'&&method==='GET')return cnj.status(actor,id);
   if(parts[4]==='monitor'&&method==='POST')return cnj.monitor(actor,id,body);
   if(parts[4]==='publications'&&method==='GET')return cnj.inbox(actor,id);
   if(parts[4]==='publication-review'&&method==='POST')return cnj.review(actor,id,body);
  }

  if(parts.length===5&&parts[4]==='integrations'&&method==='GET')return integrationStatus(actor,id);
  if(parts.length===5&&parts[4]==='sync-datajud'&&method==='POST')return syncDatajud(actor,id,body);
  if(parts.length===5&&parts[4]==='archive'&&method==='POST')return archiveProcess(actor,id,false);
  if(parts.length===5&&parts[4]==='reopen'&&method==='POST')return archiveProcess(actor,id,true);
  if(parts.length===5&&parts[4]==='movements'&&method==='GET')return listMovements(actor,id);
  if(parts.length===5&&parts[4]==='movements'&&method==='POST')return addMovement(actor,id,body);
  if(parts.length===5&&parts[4]==='parties'&&method==='POST')return addParty(actor,id,body);
 }
 throw fail(404,'Recurso jurídico inexistente.');
}
module.exports={handle,ensureAreas,getProcess,syncDatajud};
