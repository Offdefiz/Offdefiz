'use strict';
const {pool,transaction,fail}=require('./db.cjs');
const allowed=new Set(['datajud','djen']);
const enabled=p=>process.env[p==='djen'?'PARTELIS_DJEN_ENABLED':'PARTELIS_DATAJUD_ENABLED']==='true';
const legal=()=>require('./legal.cjs');
async function enqueue(actor,id,body){
 await legal().getProcess(actor,id,{edit:true});
 const provider=body.provider;
 if(!allowed.has(provider))throw fail(400,'Provedor inválido.');
 if(!enabled(provider))throw fail(503,'Provedor ainda não habilitado neste ambiente.');
 const alias=String(body.tribunal_alias||'').toLowerCase();
 if(provider==='datajud'&&!/^[a-z0-9-]{2,24}$/.test(alias))throw fail(400,'Informe o tribunal DataJud.');
 const {rows}=await pool.query(
 'INSERT INTO cj_cnj_jobs(workspace_id,process_id,actor_id,provider,tribunal_alias) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING id',
 [actor.workspace,id,actor.userId,provider,alias]);
 return {queued:rows.length>0,id:rows[0]?.id||null};
}
async function monitor(actor,id,body){
 const p=await legal().getProcess(actor,id,{edit:true});
 if(p.secret||!p.process_number||p.status!=='active')throw fail(400,'Monitoramento exige processo público ativo com número CNJ.');
 if(!allowed.has(body.provider))throw fail(400,'Provedor inválido.');
 if(body.enabled!==false&&!enabled(body.provider))throw fail(503,'Provedor ainda não habilitado.');
 await pool.query('INSERT INTO cj_process_monitors(workspace_id,process_id,provider,actor_id,tribunal_alias,enabled) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(workspace_id,process_id,provider) DO UPDATE SET actor_id=$4,tribunal_alias=$5,enabled=$6',
 [actor.workspace,id,body.provider,actor.userId,String(body.tribunal_alias||'').slice(0,24),body.enabled!==false]);
 return {ok:true};
}
async function status(actor,id){
 await legal().getProcess(actor,id,{auditRead:true});
 const jobs=await pool.query('SELECT id,provider,status,attempts,available_at,last_error_code FROM cj_cnj_jobs WHERE workspace_id=$1 AND process_id=$2 ORDER BY created_at DESC LIMIT 20',[actor.workspace,id]);
 const monitors=await pool.query('SELECT provider,enabled,last_enqueued_at FROM cj_process_monitors WHERE workspace_id=$1 AND process_id=$2',[actor.workspace,id]);
 return {jobs:jobs.rows,monitors:monitors.rows};
}
async function inbox(actor,id){
 await legal().getProcess(actor,id,{auditRead:true});
 const {rows}=await pool.query('SELECT p.*,r.read_at FROM cj_publications p LEFT JOIN cj_publication_reads r ON r.workspace_id=p.workspace_id AND r.publication_id=p.id AND r.user_id=$3 WHERE p.workspace_id=$1 AND p.process_id=$2 ORDER BY available_date DESC LIMIT 200',[actor.workspace,id,actor.userId]);
 return {items:rows};
}
async function review(actor,id,body){
 await legal().getProcess(actor,id,{edit:body.status!==undefined,auditRead:true});
 if(!/^[a-f0-9-]{36}$/i.test(String(body.publication_id||'')))throw fail(400,'Publicação inválida.');
 return transaction(async c=>{
  const {rowCount}=await c.query('SELECT 1 FROM cj_publications WHERE workspace_id=$1 AND process_id=$2 AND id=$3',[actor.workspace,id,body.publication_id]);
  if(!rowCount)throw fail(404,'Publicação não encontrada.');
  if(body.status!==undefined){
   if(!['reviewed','dismissed'].includes(body.status))throw fail(400,'Revisão inválida.');
   await c.query('UPDATE cj_publications SET review_status=$4,reviewed_by=$5,reviewed_at=now() WHERE workspace_id=$1 AND process_id=$2 AND id=$3',[actor.workspace,id,body.publication_id,body.status,actor.userId]);
  }
  await c.query('INSERT INTO cj_publication_reads(workspace_id,publication_id,user_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[actor.workspace,body.publication_id,actor.userId]);
  await c.query("INSERT INTO cj_legal_access_audit(workspace_id,actor_id,process_id,entity,entity_id,event,ip) VALUES($1,$2,$3,'publication',$4,$5,$6)",[actor.workspace,actor.userId,id,body.publication_id,body.status||'read',actor.ip||null]);
  return {ok:true};
 });
}
async function syncDjen(actor,id){
 const p=await legal().getProcess(actor,id,{edit:true});
 if(p.secret||!p.process_number)throw fail(403,'Consulta externa indisponível para este processo.');
 if(!enabled('djen'))throw fail(503,'DJEN não habilitado.');
 const {DjenHttpAdapter}=require('../../lib/djen-http.cjs');
 const result=await new DjenHttpAdapter().searchByNumber(p.process_number);
 return transaction(async c=>{
  const current=await legal().getProcess(actor,id,{edit:true,connection:c});
  if(current.secret||current.process_number!==p.process_number)throw fail(409,'Processo alterado durante consulta.');
  let created=0;
  for(const item of result.items){
   if(item.processNumber!==p.process_number)continue;
   const r=await c.query("INSERT INTO cj_publications(workspace_id,process_id,provider,external_id,available_date,summary) VALUES($1,$2,'djen',$3,$4,$5) ON CONFLICT DO NOTHING",[actor.workspace,id,item.identifier,item.date,item.summary]);
   created+=r.rowCount;
  }
  await c.query("INSERT INTO cj_integration_status(workspace_id,process_id,provider,last_synced_at,status) VALUES($1,$2,'djen',now(),$3) ON CONFLICT(workspace_id,process_id,provider) DO UPDATE SET last_synced_at=now(),status=$3,last_error_code=NULL,retry_count=0",[actor.workspace,id,result.complete?'ok':'partial']);
  await c.query("INSERT INTO cj_legal_access_audit(workspace_id,actor_id,process_id,entity,entity_id,event) VALUES($1,$2,$3,'process',$3,'sync_djen')",[actor.workspace,actor.userId,id]);
  return {created,complete:result.complete};
 });
}
async function tick(){
 return transaction(async c=>{
  const lock=await c.query("SELECT pg_try_advisory_xact_lock(17001110) AS locked");
  if(!lock.rows[0].locked)return {scheduled:0};
  let scheduled=0;
  const {rows}=await c.query("SELECT m.* FROM cj_process_monitors m JOIN cj_legal_processes p ON p.workspace_id=m.workspace_id AND p.id=m.process_id WHERE m.enabled AND p.status='active' AND NOT p.secret AND p.process_number IS NOT NULL AND (m.last_enqueued_at IS NULL OR m.last_enqueued_at<now()-interval '1 hour') LIMIT 100");
  for(const m of rows){
   if(!enabled(m.provider))continue;
   const r=await c.query('INSERT INTO cj_cnj_jobs(workspace_id,process_id,actor_id,provider,tribunal_alias) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',[m.workspace_id,m.process_id,m.actor_id,m.provider,m.tribunal_alias]);
   scheduled+=r.rowCount;
   await c.query('UPDATE cj_process_monitors SET last_enqueued_at=now() WHERE workspace_id=$1 AND process_id=$2 AND provider=$3',[m.workspace_id,m.process_id,m.provider]);
  }
  return {scheduled};
 });
}
async function runOne(){
 // Um worker por banco impede concorrência e limita consumo por provedor.
 const guard=await pool.connect();
 try{
  if(!(await guard.query('SELECT pg_try_advisory_lock(17001111) AS locked')).rows[0].locked)return false;
  await pool.query("UPDATE cj_cnj_jobs SET status='queued',locked_at=NULL WHERE status='running' AND locked_at<now()-interval '10 minutes'");
  const job=await transaction(async c=>{
   const {rows}=await c.query("SELECT * FROM cj_cnj_jobs WHERE status='queued' AND available_at<=now() ORDER BY available_at FOR UPDATE SKIP LOCKED LIMIT 1");
   if(!rows[0])return null;
   await c.query("UPDATE cj_cnj_jobs SET status='running',attempts=attempts+1,locked_at=now() WHERE id=$1",[rows[0].id]);
   return rows[0];
  });
  if(!job)return false;
  try{
   if(!enabled(job.provider))throw Error('PROVIDER_DISABLED');
   const member=await pool.query('SELECT role FROM cj_memberships WHERE workspace_id=$1 AND user_id=$2',[job.workspace_id,job.actor_id]);
   if(!member.rows[0])throw Error('ACCESS_REVOKED');
   const actor={workspace:job.workspace_id,userId:job.actor_id,role:member.rows[0].role};
   const p=await legal().getProcess(actor,job.process_id,{edit:true});
   if(p.status!=='active')throw Error('PROCESS_ARCHIVED');
   if(job.provider==='djen')await syncDjen(actor,job.process_id);
   else await legal().syncDatajud(actor,job.process_id,{tribunal_alias:job.tribunal_alias});
   await pool.query("UPDATE cj_cnj_jobs SET status='done',locked_at=NULL,last_error_code=NULL WHERE id=$1",[job.id]);
  }catch(e){
   const code=e.status===404||e.status===403?'ACCESS_DENIED':['PROVIDER_DISABLED','ACCESS_REVOKED','PROCESS_ARCHIVED'].includes(e.message)?e.message:'SYNC_FAILED';
   const terminal=['ACCESS_DENIED','ACCESS_REVOKED','PROCESS_ARCHIVED','PROVIDER_DISABLED'].includes(code)||job.attempts>=4;
   await pool.query("UPDATE cj_cnj_jobs SET status=$2,locked_at=NULL,last_error_code=$3,available_at=now()+($4*interval '1 second') WHERE id=$1",[job.id,terminal?'failed':'queued',code,Math.min(3600,60*2**job.attempts)]);
   await pool.query("INSERT INTO cj_integration_status(workspace_id,process_id,provider,status,last_error_code,retry_count) VALUES($1,$2,$3,'error',$4,1) ON CONFLICT(workspace_id,process_id,provider) DO UPDATE SET status='error',last_error_code=$4,retry_count=cj_integration_status.retry_count+1",[job.workspace_id,job.process_id,job.provider,code]);
  }
  return true;
 }finally{await guard.query('SELECT pg_advisory_unlock(17001111)');guard.release();}
}
if(require.main===module)(async()=>{
 await tick();
 for(let i=0;i<10;i++){if(!await runOne())break;await new Promise(r=>setTimeout(r,1500));}
})().catch(()=>{console.error('CNJ_WORKER_FAILED');process.exitCode=1;}).finally(()=>pool.end());
module.exports={enqueue,monitor,status,inbox,review,syncDjen,tick,runOne};
