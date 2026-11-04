'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {server}=require('./server.cjs');
let origin;
test.before(async()=>{await new Promise(done=>server.listen(0,'127.0.0.1',done));origin='http://127.0.0.1:'+server.address().port;});
test.after(async()=>{await new Promise(done=>server.close(done));});
const originHeaders=()=>({Origin:process.env.PUBLIC_APP_URL||origin,'Content-Type':'application/json'});
test('document preparation is reachable but private catalogue requires login',async()=>{
 const html=await fetch(origin+'/contratos');assert.equal(html.status,200);const body=await html.text();
 assert.match(body,/nenhuma assinatura ou arquivo é gerado/i);
 assert.match(body,/contracts-preflight.js/);
 assert.equal((await fetch(origin+'/contracts-preflight.js')).status,200);
 assert.equal((await fetch(origin+'/api/contracts/catalog')).status,401);
 assert.equal((await fetch(origin+'/api/contracts/preflight',{method:'POST',headers:originHeaders(),body:'{}'})).status,401);
});
test('owner APIs, presence and feedback reject unauthenticated calls',async()=>{
 assert.equal((await fetch(origin+'/api/admin/dashboard')).status,401);
 for(const route of ['/api/activity/ping','/api/admin/feedback-triage','/api/admin/billing']){
 const response=await fetch(origin+route,{method:'POST',headers:originHeaders(),body:'{}'});
 assert.equal(response.status,401,route);
 }
});
test('no admin-billing or presence tables have direct grants in migration',()=>{
 const m=fs.readFileSync('migrations/20261104_partelis_admin_operacao.sql','utf8');
 assert.match(m,/ENABLE ROW LEVEL SECURITY/);
 assert.match(m,/REVOKE ALL PRIVILEGES/);
 assert.match(m,/public\.cj_admin_billing,public\.cj_user_presence/);
});
test('automatic signing remains disabled in preflight',()=>{
 const {preflight}=require('./zapsign-preflight.cjs');
 const result=preflight('passivo_bancario','procuracao',{});
 assert.equal(result.productionEnabled,false);assert.equal(result.canCreateDocument,false);assert.equal(result.validationOnly,true);
});
test('front-end does not expose service credentials or call signature provider',()=>{
 for(const file of ['contracts-preflight.js','presence.js','admin.js']){
 const content=fs.readFileSync(file,'utf8');
 assert.doesNotMatch(content,/SUPABASE_SERVICE_ROLE_KEY|ZAPSIGN_API_TOKEN|OPENAI_API_KEY/);
 }
 assert.doesNotMatch(fs.readFileSync('contracts-preflight.js','utf8'),/api\.zapsign\.com/);
});