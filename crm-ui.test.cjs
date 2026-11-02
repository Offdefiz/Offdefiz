const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {server}=require('./server.cjs');
let origin;
test.before(async()=>{await new Promise(done=>server.listen(0,'127.0.0.1',done));origin='http://127.0.0.1:'+server.address().port;});
test.after(async()=>{await new Promise(done=>server.close(done));});
test('CRM app serves actual settings, profile, search and style assets',async()=>{
 const response=await fetch(origin+'/');
 assert.equal(response.status,200);
 const html=await response.text();
 for(const asset of ['/crm-ui.css','/crm-experience.js','/onboarding.js','/feedback.js']){
  assert.ok(html.includes(asset),'Page must reference '+asset);
  const r=await fetch(origin+asset);assert.equal(r.status,200,asset);
  const body=await r.text();assert.ok(body.length>100,asset);
  assert.match(r.headers.get('content-type'),asset.endsWith('.js')?/javascript/:/text\/css/);
 }
});
test('profile operations require a real authenticated user',async()=>{
 assert.equal((await fetch(origin+'/api/profile')).status,401);
 const r=await fetch(origin+'/api/profile',{method:'POST',headers:{origin:process.env.PUBLIC_APP_URL||origin,'Content-Type':'application/json'},body:JSON.stringify({display_name:'Teste fictício',avatar_data:null})});
 assert.equal(r.status,401);
});
test('support status rejects unauthenticated access',async()=>{
 const r=await fetch(origin+'/api/support/status');assert.equal(r.status,401);
});
test('CRM navigation preserves original business modules',()=>{
 const src=fs.readFileSync('./app.js','utf8');
 for(const key of ['today','funnel','calendar','proposal','contract','finance','legal','plan','settings','profile']){
  assert.ok(src.includes("'"+key+"'")||src.includes(key+':'),'Module should exist: '+key);
 }
 assert.match(src,/renderSettings/);assert.match(src,/renderProfile/);
});
test('UI actions no longer mount floating button toolbar',()=>{
 const feedback=fs.readFileSync('./feedback.js','utf8');
 const onboarding=fs.readFileSync('./onboarding.js','utf8');
 const enhancements=fs.readFileSync('./enhancements.js','utf8');
 assert.ok(!feedback.includes("b.style.cssText='position:fixed"));
 assert.ok(!onboarding.includes('bar.className='));
 assert.ok(!enhancements.includes("b.textContent='Aparência'"));
 assert.ok(!enhancements.includes("out.textContent='Sair'"));
});
test('photo upload is optimized locally and backend checks image format',()=>{
 const client=fs.readFileSync('./crm-experience.js','utf8'),backend=fs.readFileSync('./server.cjs','utf8');
 assert.match(client,/canvas/);assert.match(client,/toDataURL/);assert.match(client,/processPhoto/);
 assert.match(backend,/avatar_data/);assert.match(backend,/cj_user_profiles/);
 assert.match(backend,/ownerIdentity\(req,res\)/);
});
