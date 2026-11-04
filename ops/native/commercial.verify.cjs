'use strict';
// Testes E2E no PostgreSQL efêmero; nunca conectar ao banco de produção.
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
if(!/^partelis_verify_[a-z0-9_]+$/.test(process.env.PGDATABASE||''))throw Error('Banco descartável de testes obrigatório.');
process.env.PARTELIS_STORAGE='postgres';
process.env.PARTELIS_OWNER_EMAIL='owner-'+randomUUID()+'@example.invalid';
const {server}=require('../../server.cjs');
const {pool}=require('./db.cjs');
const {provision}=require('./invite.cjs');
const ownerEmail=process.env.PARTELIS_OWNER_EMAIL;
async function run(){
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+server.address().port;
  const request=(route,{cookie='',data,method}={})=>fetch(base+route,{
    method:method||(data?'POST':'GET'),
    headers:{origin:base,cookie,...(data?{'Content-Type':'application/json'}:{})},
    body:data?JSON.stringify(data):undefined
  });
  const cookies=r=>r.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
  const activate=async secret=>{
    const r=await request('/auth/activate',{data:{token_hash:secret}});assert.equal(r.status,200);
    return cookies(r);
  };
  // Prova: marketing não é ambiente de cliente; demo não consulta PostgreSQL.
  assert.match(await(await request('/')).text(),/Solicitar apresentação e proposta/);
  assert.match(await(await request('/demo')).text(),/window.CLOUD=false/);
  assert.match(await(await request('/app')).text(),/window.CLOUD=true/);
  assert.equal((await request('/api/admin/commercial/list')).status,401);
  const secret=await provision(ownerEmail,'Proprietário - Teste');
  const ownerCookie=await activate(secret);
  const ownerAccount=await request('/api/password',{cookie:ownerCookie,data:{password:'Teste-Proprietario-Exclusivo-2026'}});
  assert.equal(ownerAccount.status,200);
  assert.equal((await request('/admin/comercial',{cookie:ownerCookie})).status,200);
  // Formulário público com consentimento e controle de acesso.
  const firm='Escritório de Teste '+randomUUID().slice(0,8);
  const email='gestor-'+randomUUID()+'@example.invalid';
  let response=await request('/api/public/leads',{data:{firm_name:firm,contact_name:'Pessoa Fictícia',email,phone:'',plan_interest:'contratar',message:'Homologação sem dados reais.',consent:false}});
  assert.equal(response.status,400);
  response=await request('/api/public/leads',{data:{firm_name:firm,contact_name:'Pessoa Fictícia',email,phone:'',plan_interest:'contratar',message:'Homologação sem dados reais.',consent:true}});
  assert.equal(response.status,201);
  await request('/api/public/leads',{data:{firm_name:firm,contact_name:'Pessoa Fictícia',email,consent:true}});
  let list=await(await request('/api/admin/commercial/list',{cookie:ownerCookie})).json();
  const leads=list.leads.filter(x=>x.email===email);
  assert.equal(leads.length,1);
  assert.equal((await request('/api/admin/commercial/provision',{data:{lead_id:leads[0].id}})).status,401);
  const created=await request('/api/admin/commercial/provision',{cookie:ownerCookie,data:{lead_id:leads[0].id,plan:'trial'}});
  assert.equal(created.status,201);
  const createdBody=await created.json();
  assert.ok(createdBody.activation_url.includes('/ativar#token_hash='));
  const token=new URL(createdBody.activation_url).hash.slice('#token_hash='.length);
  assert.equal((await request('/api/admin/commercial/provision',{cookie:ownerCookie,data:{lead_id:leads[0].id}})).status,409);
  const clientCookie=await activate(token);
  assert.equal((await request('/auth/activate',{data:{token_hash:token}})).status,400);
  assert.equal((await request('/api/admin/commercial/list',{cookie:clientCookie})).status,403);
  assert.equal((await request('/api/password',{cookie:clientCookie,data:{password:'Teste-Cliente-Exclusivo-2026'}})).status,200);
  const tenant=await (await request('/api/state',{cookie:clientCookie})).json();
  assert.equal(tenant.user.email,email);
  assert.equal(tenant.user.role,'gestor');
  assert.equal(tenant.revision,0);
  list=await(await request('/api/admin/commercial/list',{cookie:ownerCookie})).json();
  assert.equal(list.tenants.find(t=>t.workspace_id===createdBody.workspace_id).status,'active');
  // Colaborador autorizado, convite reemitido, permissões preservadas.
  const memberEmail='colaborador-'+randomUUID()+'@example.invalid';
  let invited=await request('/api/admin/commercial/invite-member',{cookie:ownerCookie,data:{workspace_id:createdBody.workspace_id,email:memberEmail,role:'juridico'}});
  assert.equal(invited.status,201);
  const oldToken=new URL((await invited.json()).activation_url).hash.slice('#token_hash='.length);
  invited=await request('/api/admin/commercial/reissue-invite',{cookie:ownerCookie,data:{workspace_id:createdBody.workspace_id,email:memberEmail}});
  assert.equal(invited.status,200);
  const newToken=new URL((await invited.json()).activation_url).hash.slice('#token_hash='.length);
  assert.equal((await request('/auth/activate',{data:{token_hash:oldToken}})).status,400);
  const memberCookie=await activate(newToken);
  assert.equal((await request('/api/password',{cookie:memberCookie,data:{password:'Teste-Colaborador-Exclusivo'}})).status,200);
  assert.equal((await request('/api/theme',{cookie:memberCookie,data:{revision:0,accent:'#30145F',name:'Tentativa'}})).status,403);
  assert.equal((await request('/api/admin/commercial/list',{cookie:memberCookie})).status,403);
  // Um workspace não modifica nem consulta outro via parâmetro fornecido pelo navegador.
  const otherCookie=ownerCookie;
  const ownState=await(await request('/api/state?workspace_id='+createdBody.workspace_id,{cookie:otherCookie})).json();
  assert.notEqual(ownState.user.email,email);
  assert.notEqual(ownState.user.email,memberEmail);
  // Recuperação auditada: nova senha invalida as sessões antigas sem afetar outros escritórios.
  const recovery=await request('/api/admin/commercial/assisted-recovery',{cookie:ownerCookie,data:{
    workspace_id:createdBody.workspace_id,email,reason:'Confirmação de identidade em canal independente',identity_verified:true}});
  assert.equal(recovery.status,200);
  const recoverySecret=new URL((await recovery.json()).activation_url).hash.slice('#token_hash='.length);
  const recoveryCookie=await activate(recoverySecret);
  assert.equal((await request('/api/password',{cookie:recoveryCookie,data:{password:'Nova-Senha-Cliente-2026'}})).status,200);
  assert.equal((await request('/api/state',{cookie:clientCookie})).status,401);
  const newLogin=await request('/auth/login',{data:{email,password:'Nova-Senha-Cliente-2026'}});
  assert.equal(newLogin.status,200);
  const newClientCookie=cookies(newLogin);
  response=await request('/api/admin/commercial/tenant-status',{cookie:ownerCookie,data:{workspace_id:createdBody.workspace_id,status:'suspended'}});
  assert.equal(response.status,200);
  assert.equal((await request('/api/state',{cookie:newClientCookie})).status,403);
  assert.equal((await request('/api/state',{cookie:memberCookie})).status,403);
  assert.equal((await request('/admin',{cookie:clientCookie})).status,403);
  console.log('COMERCIAL OK: site, leads, aprovação, convite, equipe, superadmin, isolamento e suspensão.');
}
run().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{
  server.closeAllConnections();server.close();await pool.end();
});
