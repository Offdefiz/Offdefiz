'use strict';
// Cenários administrativos exclusivamente no banco partelis_verify_*.
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
if(!/^partelis_verify_[a-z0-9_]+$/.test(process.env.PGDATABASE||''))throw Error('Banco de teste descartável obrigatório.');
process.env.PARTELIS_STORAGE='postgres';
const email='owner-'+randomUUID()+'@example.invalid';
process.env.PARTELIS_OWNER_EMAIL=email;
const {server}=require('../../server.cjs');
const {pool}=require('./db.cjs');
const {provision}=require('./invite.cjs');
async function run(){
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;
 const req=(route,cookie='',payload)=>{
  return fetch(origin+route,{method:payload===undefined?'GET':'POST',
   headers:{origin,cookie,'Content-Type':'application/json'},
   body:payload===undefined?undefined:JSON.stringify(payload)});
 };
 const cookie=r=>r.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');
 async function account(address,name){
  const token=await provision(address,name);
  const activation=await req('/auth/activate','',{token_hash:token});
  assert.equal(activation.status,200);
  const c=cookie(activation);
  const {rows:[user]}=await pool.query(
   'SELECT m.workspace_id,m.user_id FROM cj_memberships m JOIN native_users u ON u.id=m.user_id WHERE u.email=$1',
   [address]);
  return {...user,c};
 }
 const owner=await account(email,'Administrador');
 const tester=await account('tester-'+randomUUID()+'@example.invalid','Beta fictícia');
 let response=await req('/api/admin/ops/metrics',tester.c);
 assert.equal(response.status,403,'Painel owner não acessível a membro de outro escritório');
 assert.equal((await req('/api/presence',owner.c,{})).status,200);
 assert.equal((await req('/api/presence',tester.c,{})).status,200);
 response=await req('/api/admin/ops/metrics',owner.c);
 assert.equal(response.status,200);
 let metrics=await response.json();
 assert.ok(metrics.activeUsers>=2);
 assert.equal(metrics.payingWorkspacesVerified,0,'Trial e beta não são pagantes');
 assert.ok(metrics.onlineUsers>=2);
 const users=await(await req('/api/admin/ops/users',owner.c)).json();
 assert.ok(users.items.some(x=>x.user_id===tester.user_id));
 response=await req('/api/admin/ops/beta',owner.c,{
  workspace_id:tester.workspace_id,user_id:tester.user_id,enabled:true});
 assert.equal(response.status,200);
 metrics=await(await req('/api/admin/ops/metrics',owner.c)).json();
 assert.equal(metrics.betaTesters,1);
 response=await req('/api/feedback',tester.c,{kind:'bug',message:'Erro sintético no registro da audiência',page:'/app'});
 assert.equal(response.status,200);
 const feedback=await(await req('/api/admin/ops/feedback',owner.c)).json();
 const candidate=feedback.items.find(x=>x.user_id===tester.user_id);
 assert.ok(candidate);
 const task={id:candidate.id,title:'Revisar erro sintético de audiência',priority:'P1'};
 response=await req('/api/admin/ops/task',tester.c,task);
 assert.equal(response.status,403,'Somente dono pode criar tarefa de feedback');
 response=await req('/api/admin/ops/task',owner.c,task);
 assert.equal(response.status,201);
 const item=await response.json();
 response=await req('/api/admin/ops/task',owner.c,task);
 assert.equal(response.status,409,'Não criar duas tarefas para mesmo feedback');
 response=await req('/api/admin/ops/task-status',owner.c,{id:item.id,status:'doing'});
 assert.equal(response.status,200);
 response=await req('/api/admin/ops/beta',owner.c,{workspace_id:tester.workspace_id,user_id:tester.user_id,enabled:false});
 assert.equal(response.status,200);
 metrics=await(await req('/api/admin/ops/metrics',owner.c)).json();
 assert.equal(metrics.betaTesters,0);
 console.log('OK: métricas de presença, beta, feedback e tarefas sem pagamentos fictícios.');
}
run().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{
 server.closeAllConnections();server.close();await pool.end();
});
