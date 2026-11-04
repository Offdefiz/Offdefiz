// Execute in a fresh, disposable database initialized with schema.sql.
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
process.env.PARTELIS_STORAGE='postgres';
if(!/^partelis_verify_[a-z0-9_]+$/.test(process.env.PGDATABASE||''))throw Error('Use um banco exclusivo de teste.');
const {server}=require('../../server.cjs');
const {pool}=require('./db.cjs');
const {provision}=require('./invite.cjs');
async function verify(){
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const request=(path,cookie='',body)=>fetch(base+path,{headers:{cookie,origin:base,'content-type':'application/json'},method:body?'POST':'GET',body:body?JSON.stringify(body):undefined});
  const cookies=r=>r.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');
  const tenants=await Promise.all(Array.from({length:7},async(_,i)=>{
    const email=randomUUID()+'@example.invalid', password=randomUUID();
    const secret=await provision(email,'Teste '+i);
    const activated=await request('/auth/activate','',{token_hash:secret});
    assert.equal(activated.status,200);
    assert.equal((await request('/auth/activate','',{token_hash:secret})).status,400);
    assert.equal((await request('/api/password',cookies(activated),{password})).status,200);
    const logged=await request('/auth/login','',{email,password});assert.equal(logged.status,200);
    return cookies(logged);
  }));
  await Promise.all(tenants.map(async(cookie,i)=>{
    const changed=await request('/api/theme',cookie,{revision:0,name:'Isolado '+i,accent:'#30145F'});
    assert.equal(changed.status,200);
    assert.equal((await request('/admin',cookie)).status,403);
  }));
  await Promise.all(tenants.map(async(cookie,i)=>{
    const state=await (await request('/api/state?workspace_id=outro',cookie)).json();
    assert.equal(state.theme.name,'Isolado '+i);assert.equal(state.revision,1);
    const logout=await request('/auth/logout',cookie,{});assert.equal(logout.status,200);
    assert.equal((await request('/api/state',cookie)).status,401);
  }));
  console.log('Sete escritórios isolados, convites descartáveis, login, logout e bloqueio administrativo validados.');
}
verify().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{server.closeAllConnections();server.close();await pool.end()});
