const test=require('node:test'),assert=require('node:assert/strict');const {server}=require('./server.cjs');let origin;
test.before(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;});test.after(()=>server.close());
test('dados exigem autenticação',async()=>{const r=await fetch(origin+'/api/state');assert.equal(r.status,401);assert.match(r.headers.get('content-type'),/json/);});
test('demo pública isolada e login com senha',async()=>{assert.match(await(await fetch(origin+'/demo')).text(),/window.CLOUD=false/);assert.match(await(await fetch(origin+'/login')).text(),/autocomplete="current-password"/);});
test('origem externa não pode submeter login',async()=>{const r=await fetch(origin+'/auth/login',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:'{}'});assert.equal(r.status,403);});
test('arquivos privados e caminhos arbitrários não são servidos',async()=>{for(const route of ['/.env','/server.cjs','/schema.sql','/package.json'])assert.equal((await fetch(origin+route)).status,404);});
