'use strict';
const {pool,transaction,fail}=require('./db.cjs');
const {dashboardMetrics,validateTask}=require('../../ops-metrics.cjs');
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
async function heartbeat(workspaceId,userId){
 await pool.query(
  'INSERT INTO cj_presence(workspace_id,user_id,last_seen_at) VALUES($1,$2,now()) '+
  'ON CONFLICT(workspace_id,user_id) DO UPDATE SET last_seen_at=now()',
  [workspaceId,userId]);
 return {ok:true,onlineApproximate:true};
}
async function ownerMetrics(){
 const [memberships,tenants,presence,subs,betas,feedback,tasks]=await Promise.all([
  pool.query('SELECT workspace_id,user_id FROM cj_memberships'),
  pool.query('SELECT workspace_id,status FROM cj_admin_tenants'),
  pool.query('SELECT workspace_id,user_id,last_seen_at FROM cj_presence WHERE last_seen_at>now()-interval \'2 minutes\''),
  pool.query('SELECT workspace_id,status,billing_source,billing_verified_at,current_period_end FROM cj_verified_subscriptions'),
  pool.query('SELECT workspace_id,user_id FROM cj_beta_testers'),
  pool.query('SELECT id,status FROM cj_beta_feedback'),
  pool.query('SELECT id,status FROM cj_feedback_tasks')
 ]);
 const data=dashboardMetrics({memberships:memberships.rows,tenants:tenants.rows,presence:presence.rows,
  subscriptions:subs.rows,betaTesters:betas.rows,feedback:feedback.rows,tasks:tasks.rows});
 return {...data,onlineIsEstimate:true,paymentsRequireProviderVerification:true};
}
async function people(){
 const {rows}=await pool.query(
  'SELECT m.workspace_id,m.user_id,u.email,m.role,'+
  '(b.user_id IS NOT NULL) AS beta_tester '+
  'FROM cj_memberships m JOIN native_users u ON u.id=m.user_id '+
  'LEFT JOIN cj_beta_testers b ON b.workspace_id=m.workspace_id AND b.user_id=m.user_id '+
  'ORDER BY u.email LIMIT 500');
 return {items:rows};
}
async function feedback(){
 const {rows}=await pool.query(
  'SELECT f.id,f.workspace_id,f.user_id,f.kind,f.message,f.page,f.status,f.created_at,'+
  't.id AS task_id,t.title AS task_title,t.priority,t.status AS task_status '+
  'FROM cj_beta_feedback f LEFT JOIN cj_feedback_tasks t ON t.feedback_id=f.id '+
  'ORDER BY f.created_at DESC LIMIT 500');
 return {items:rows};
}
async function setBeta(input,actorId){
 if(!uuid(input.workspace_id)||!uuid(input.user_id)||typeof input.enabled!=='boolean')
  throw fail(400,'Identifique o escritório, usuário e estado beta.');
 return transaction(async client=>{
  const {rowCount}=await client.query(
   'SELECT 1 FROM cj_memberships WHERE workspace_id=$1 AND user_id=$2',
   [input.workspace_id,input.user_id]);
  if(!rowCount)throw fail(404,'Usuário não vinculado ao escritório.');
  if(input.enabled){
   await client.query(
    'INSERT INTO cj_beta_testers(workspace_id,user_id,tagged_by) VALUES($1,$2,$3) '+
    'ON CONFLICT(workspace_id,user_id) DO NOTHING',
    [input.workspace_id,input.user_id,actorId]);
  }else{
   await client.query('DELETE FROM cj_beta_testers WHERE workspace_id=$1 AND user_id=$2',
    [input.workspace_id,input.user_id]);
  }
  await client.query(
   "INSERT INTO cj_provision_audit(actor_id,workspace_id,user_id,event) VALUES($1,$2,$3,$4)",
   [actorId,input.workspace_id,input.user_id,input.enabled?'beta_tester_tagged':'beta_tester_untagged']);
  return {ok:true};
 });
}
async function feedbackToTask(input,actorId){
 const normalized=validateTask(input);
 if(!normalized)throw fail(400,'Informe sugestão válida, título e prioridade P0 a P3.');
 return transaction(async client=>{
  const {rows:[f]}=await client.query('SELECT workspace_id FROM cj_beta_feedback WHERE id=$1 FOR UPDATE',
   [normalized.feedback_id]);
  if(!f)throw fail(404,'Sugestão não encontrada.');
  const {rows:[task]}=await client.query(
   'INSERT INTO cj_feedback_tasks(workspace_id,feedback_id,title,priority,created_by) '+
   'VALUES($1,$2,$3,$4,$5) ON CONFLICT(feedback_id) DO NOTHING RETURNING id,feedback_id,title,priority,status',
   [f.workspace_id,normalized.feedback_id,normalized.title,normalized.priority,actorId]);
  if(!task)throw fail(409,'Esta sugestão já virou tarefa.');
  await client.query("UPDATE cj_beta_feedback SET status='reviewing' WHERE id=$1 AND status='open'",
   [f.id||normalized.feedback_id]);
  await client.query("INSERT INTO cj_provision_audit(actor_id,workspace_id,event) VALUES($1,$2,'feedback_task_created')",
   [actorId,f.workspace_id]);
  return task;
 });
}
async function updateTask(input){
 if(!uuid(input.id)||!['backlog','planned','doing','done','dismissed'].includes(input.status))
  throw fail(400,'Tarefa ou status inválido.');
 const {rows:[task]}=await pool.query(
  'UPDATE cj_feedback_tasks SET status=$2,updated_at=now() WHERE id=$1 RETURNING id,title,status,priority',
  [input.id,input.status]);
 if(!task)throw fail(404,'Tarefa inexistente.');
 return task;
}
module.exports={heartbeat,ownerMetrics,people,feedback,setBeta,feedbackToTask,updateTask};
