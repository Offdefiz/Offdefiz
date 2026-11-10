'use strict';
// Testes destrutivos APENAS em banco exclusivo partelis_verify_*, nunca em produção.
const test=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const L=require('../../lib/legal-core.cjs');
if(!/^partelis_verify_[a-z0-9_]+$/.test(process.env.PGDATABASE||''))throw Error('Banco descartável obrigatório.');
process.env.PARTELIS_STORAGE='postgres';
const {server}=require('../../server.cjs');
const {pool}=require('./db.cjs');
const {provision}=require('./invite.cjs');
async function run(){
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;
 const call=(route,cookie='',data)=>fetch(origin+route,{method:data?'POST':'GET',
  headers:{origin,'content-type':'application/json',cookie},body:data?JSON.stringify(data):undefined});
 const cookies=r=>r.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');
 async function actor(name){
  const email=randomUUID()+'@example.invalid';
  const secret=await provision(email,name);
  const r=await call('/auth/activate','',{token_hash:secret});
  test.equal(r.status,200);const cookie=cookies(r);
  const {rows:[membership]}=await pool.query(
   'SELECT m.user_id,m.workspace_id FROM cj_memberships m JOIN native_users u ON u.id=m.user_id WHERE u.email=$1',[email]);
  return {cookie,email,...membership};
 }
 const a=await actor('Escritório A'),b=await actor('Escritório B'),junior=await actor('Estagiário');
 await pool.query("UPDATE cj_memberships SET workspace_id=$1,role='estagiario' WHERE user_id=$2",[a.workspace_id,junior.user_id]);
 const areasA=await call('/api/legal/areas',a.cookie);
 const areasB=await call('/api/legal/areas',b.cookie);
 test.equal(areasA.status,200);test.equal(areasB.status,200);
 const aa=(await areasA.json()).items,bb=(await areasB.json()).items;
 test.equal(aa.length,14);test.equal(bb.length,14);
 test.notEqual(aa[0].id,bb[0].id);
 const penal=aa.find(x=>x.code==='penal');
 const first=aa.find(x=>x.code==='civel');
 const base='0000001'+'2026'+'8'+'13'+'0001';
 const cnj=base.slice(0,7)+L.cnjDigits(base)+base.slice(7);
 let r=await call('/api/legal/processes',a.cookie,{
  area_id:penal.id,title:'Processo penal sintético',kind:'judicial',process_number:cnj,
  secret:true,custom_fields:{reu_preso:false},workspace_id:b.workspace_id});
 test.equal(r.status,201);const secret=await r.json();
 test.equal(secret.workspace_id,a.workspace_id);
 r=await call('/api/legal/processes/'+secret.id,b.cookie);
 test.equal(r.status,404,'B não deve ler ID direto de A');
 r=await call('/api/legal/processes/'+secret.id,junior.cookie);
 test.equal(r.status,404,'Estagiário do mesmo escritório sem ACL não deve ler segredo');
 r=await call('/api/legal/processes/'+secret.id+'/movements',b.cookie,
  {date:'2026-11-10',description:'Publicação simulada'});
 test.equal(r.status,404,'B não pode gravar movimento por ID');
 r=await call('/api/legal/processes',junior.cookie,{area_id:first.id,title:'Bloqueado'});
 test.equal(r.status,403,'Estagiário não pode criar');
 r=await call('/api/legal/processes',a.cookie,{area_id:first.id,title:'Consultivo aberto',kind:'consultive',
  process_number:null,claim_cents:129900});
 test.equal(r.status,201);const open=await r.json();
 r=await call('/api/legal/processes/'+open.id,junior.cookie);
 test.equal(r.status,200,'Estagiário pode ler não sigiloso');
 r=await call('/api/legal/processes/'+open.id,b.cookie);
 test.equal(r.status,404,'B não lê não sigiloso de A');
 const lists=await Promise.all([call('/api/legal/processes',a.cookie),call('/api/legal/processes',b.cookie),
  call('/api/legal/processes',junior.cookie)]);
 const x=await lists[0].json(),y=await lists[1].json(),z=await lists[2].json();
 test.equal(x.items.length,2);test.equal(y.items.length,0);
 test.equal(z.items.length,1,'Segredo deve sumir até da listagem sem autorização');
 r=await call('/api/legal/processes/'+secret.id+'/movements',a.cookie,
  {date:'2026-11-10',description:'Intimação    Publicada',tpu_code:'123'});
 test.equal(r.status,201);test.equal((await r.json()).created,true);
 r=await call('/api/legal/processes/'+secret.id+'/movements',a.cookie,
  {date:'2026-11-10',description:'intimacao publicada',tpu_code:'123'});
 test.equal(r.status,201);test.equal((await r.json()).created,false);
 r=await call('/api/legal/processes/'+secret.id+'/movements',a.cookie);
 test.equal((await r.json()).items.length,1);
 r=await call('/api/legal/people',a.cookie,{kind:'PF',display_name:'Pessoa Fictícia',tax_id:'529.982.247-25'});
 test.equal(r.status,201);const person=await r.json();
 r=await call('/api/legal/people',a.cookie,{kind:'PF',display_name:'Duplicada',tax_id:'529.982.247-25'});
 test.equal(r.status,409,'Documento repetido no mesmo escritório');
 r=await call('/api/legal/people',b.cookie,{kind:'PF',display_name:'Em outro escritório',tax_id:'529.982.247-25'});
 test.equal(r.status,201,'Mesmo documento em tenant diferente é permitido');
 r=await call('/api/legal/processes/'+secret.id+'/parties',b.cookie,{person_id:person.id,role:'testemunha'});
 test.equal(r.status,404,'B não vincula parte a processo A');
 r=await call('/api/legal/processes/'+secret.id+'/parties',a.cookie,{person_id:person.id,role:'testemunha'});
 test.equal(r.status,201);
 const secretPeople=await call('/api/legal/people',junior.cookie);
 test.equal(secretPeople.status,200);
 test.equal((await secretPeople.json()).items.some(p=>p.id===person.id),false,
  'Pessoa vinculada apenas a processo sigiloso não pode aparecer ao estagiário');
 const ownerPeople=await call('/api/legal/people',a.cookie);
 test.equal((await ownerPeople.json()).items.some(p=>p.id===person.id),true);
 r=await call('/api/legal/processes/'+open.id+'/archive',a.cookie,{});
 test.equal(r.status,201);test.equal((await r.json()).status,'archived');
 r=await call('/api/legal/processes/'+open.id+'/reopen',a.cookie,{});
 test.equal(r.status,201);test.equal((await r.json()).status,'active');

 const cnjCall=async(route,cookie,data)=>{
 const u=[a,b,junior].find(x=>x.cookie===cookie);
 try{const value=await require('./legal.cjs').handle(route,{method:data?'POST':'GET',body:data||{},actor:{workspace:u.workspace_id,userId:u.user_id,role:u===junior?'estagiario':'gestor'}});
 return {status:data?201:200,json:async()=>value};}catch(e){return {status:e.status||500,json:async()=>({error:e.message})};}
 };
 // A sincronização manual nunca atravessa tenants nem consulta processo sigiloso.
 process.env.PARTELIS_DATAJUD_ENABLED='true';
 process.env.DATAJUD_API_KEY='chave-ficticia';
 const originalFetch=global.fetch;
 let externalCalls=0;
 global.fetch=(url,opts)=>{
  if(!String(url).startsWith('https://api-publica.datajud.cnj.jus.br/'))return originalFetch(url,opts);
  externalCalls++;
  test.equal(opts.headers.Authorization,'APIKey chave-ficticia');
  return Promise.resolve({ok:true,json:async()=>({hits:{hits:[{_source:{
   numeroProcesso:cnj,tribunal:'TJMG',grau:'G1',classe:{codigo:7},
   assuntos:[{codigo:42}],orgaoJulgador:{nome:'Vara fictícia'},nivelSigilo:0,
   movimentos:[{nome:'Intimação publicada',dataHora:'2026-11-10T10:00:00Z',codigo:123}]
  }}]}})});
 };
 try{
  r=await cnjCall('/api/legal/processes/'+secret.id+'/sync-datajud',a.cookie,{tribunal_alias:'tjmg'});
  test.equal(r.status,403);test.equal(externalCalls,0);
  r=await cnjCall('/api/legal/processes/'+secret.id+'/sync-datajud',b.cookie,{tribunal_alias:'tjmg'});
  test.equal(r.status,404);test.equal(externalCalls,0);
  const base2='0000002'+'2026'+'8'+'13'+'0001';
  const cnj2=base2.slice(0,7)+L.cnjDigits(base2)+base2.slice(7);
  r=await cnjCall('/api/legal/processes',a.cookie,{area_id:first.id,title:'Processo público sintético',
   process_number:cnj2});
  test.equal(r.status,201);const publicCase=await r.json();
  const originalNumber=cnj;
  // A resposta precisa coincidir com o número solicitado.
  global.fetch=(url,opts)=>{
   if(!String(url).startsWith('https://api-publica.datajud.cnj.jus.br/'))return originalFetch(url,opts);
   externalCalls++;
   return Promise.resolve({ok:true,json:async()=>({hits:{hits:[{_source:{
    numeroProcesso:cnj2,nivelSigilo:0,tribunal:'TJMG',grau:'G1',
    classe:{codigo:7},assuntos:[{codigo:42}],orgaoJulgador:{nome:'Vara fictícia'},
    movimentos:[{nome:'Intimação publicada',dataHora:'2026-11-10T10:00:00Z',codigo:123}]
   }}]}})});
  };
  r=await cnjCall('/api/legal/processes/'+publicCase.id+'/sync-datajud',a.cookie,{tribunal_alias:'tjmg'});
  test.equal(r.status,201);test.equal((await r.json()).created,1);
  r=await cnjCall('/api/legal/processes/'+publicCase.id+'/sync-datajud',a.cookie,{tribunal_alias:'tjmg'});
  test.equal((await r.json()).created,0,'Reconsulta idempotente');
  r=await cnjCall('/api/legal/processes/'+publicCase.id+'/integrations',b.cookie);
  test.equal(r.status,404);
  r=await cnjCall('/api/legal/processes/'+publicCase.id+'/integrations',a.cookie);
  test.equal((await r.json()).items[0].status,'ok');
  r=await cnjCall('/api/legal/processes/'+publicCase.id+'/movements',a.cookie);
  test.equal((await r.json()).items.length,1);
 }finally{global.fetch=originalFetch;delete process.env.DATAJUD_API_KEY;delete process.env.PARTELIS_DATAJUD_ENABLED;}


 const CNJ=require('./cnj.cjs');
 const ca={workspace:a.workspace_id,userId:a.user_id,role:'gestor'};
 const cb={workspace:b.workspace_id,userId:b.user_id,role:'gestor'};
 const cj={workspace:a.workspace_id,userId:junior.user_id,role:'estagiario'};
 await test.rejects(()=>CNJ.inbox(cb,open.id),e=>e.status===404);
 await test.rejects(()=>CNJ.inbox(cj,secret.id),e=>e.status===404);
 const originalFetchDjen=global.fetch;
 process.env.PARTELIS_DJEN_ENABLED='true';
 try{
  const publicRow=await pool.query('SELECT id,process_number FROM cj_legal_processes WHERE workspace_id=$1 AND NOT secret AND process_number IS NOT NULL LIMIT 1',[a.workspace_id]);
  const pc=publicRow.rows[0];
  global.fetch=async(url)=>{
   test.ok(String(url).startsWith('https://comunicaapi.pje.jus.br/api/v1/comunicacao?'));
   return {ok:true,json:async()=>({items:[{id:123,numero_processo:pc.process_number,
    data_disponibilizacao:'2026-11-10',texto:'<b>Intimação</b> para revisão humana'}]})};
  };
  await test.rejects(()=>CNJ.enqueue(cb,pc.id,{provider:'djen'}),e=>e.status===404);
  await test.rejects(()=>CNJ.syncDjen(ca,secret.id),e=>e.status===403);
  const firstJob=await CNJ.enqueue(ca,pc.id,{provider:'djen'});
  test.equal(firstJob.queued,true);
  test.equal((await CNJ.enqueue(ca,pc.id,{provider:'djen'})).queued,false);
  test.equal(await CNJ.runOne(),true);
  let box=await CNJ.inbox(ca,pc.id);
  test.equal(box.items.length,1);test.equal(box.items[0].read_at,null);
  test.equal(box.items[0].review_status,'pending_human_review');
  test.equal(box.items[0].summary.includes('<b>'),false);
  await CNJ.syncDjen(ca,pc.id);
  test.equal((await CNJ.inbox(ca,pc.id)).items.length,1,'Publicações não duplicam');
  await test.rejects(()=>CNJ.review(cb,pc.id,{publication_id:box.items[0].id}),e=>e.status===404);
  await CNJ.review(ca,pc.id,{publication_id:box.items[0].id,status:'reviewed'});
  box=await CNJ.inbox(ca,pc.id);
  test.equal(box.items[0].review_status,'reviewed');test.ok(box.items[0].read_at);
  await CNJ.monitor(ca,pc.id,{provider:'djen',enabled:true});
  await CNJ.tick();await CNJ.tick();
  const jobs=await pool.query("SELECT count(*)::int AS n FROM cj_cnj_jobs WHERE workspace_id=$1 AND process_id=$2 AND status='queued'",[a.workspace_id,pc.id]);
  test.equal(jobs.rows[0].n,1);
  global.fetch=async()=>{throw Error('SENSITIVE_BODY_MUST_NOT_LOG');};
  await CNJ.runOne();
  const retry=await pool.query("SELECT attempts,last_error_code,status,available_at>now() AS delayed FROM cj_cnj_jobs WHERE workspace_id=$1 AND process_id=$2 AND status='queued'",[a.workspace_id,pc.id]);
  test.equal(retry.rows[0].last_error_code,'SYNC_FAILED');test.equal(retry.rows[0].delayed,true);
  await pool.query("UPDATE cj_cnj_jobs SET available_at=now() WHERE workspace_id=$1 AND status='queued'",[a.workspace_id]);
  await pool.query("UPDATE cj_memberships SET role='estagiario' WHERE user_id=$1",[a.user_id]);
  await CNJ.runOne();
  const failed=await pool.query("SELECT last_error_code FROM cj_cnj_jobs WHERE workspace_id=$1 AND status='failed'",[a.workspace_id]);
  test.equal(failed.rows[0].last_error_code,'ACCESS_DENIED');
  await pool.query("UPDATE cj_memberships SET role='gestor' WHERE user_id=$1",[a.user_id]);
 }finally{global.fetch=originalFetchDjen;delete process.env.PARTELIS_DJEN_ENABLED;}
 console.log('OK: DJEN, caixa de intimações, leitura, revisão, fila idempotente, retry e revogação de acesso.');

 const {rows:[count]}=await pool.query(
  "SELECT count(*)::integer AS total FROM cj_legal_access_audit WHERE workspace_id=$1",[a.workspace_id]);
 test.ok(count.total>=6,'Acesso e mutações com auditoria');
 console.log('OK: 14 áreas, 3 identidades, isolamento ID direto, sigilo, CPF, idempotência, arquivamento e auditoria.');
}
run().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{
 server.closeAllConnections();server.close();await pool.end();
});
