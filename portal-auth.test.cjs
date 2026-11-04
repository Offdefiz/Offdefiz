'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {server}=require('./server.cjs');let url;
test.before(async()=>{await new Promise(ok=>server.listen(0,'127.0.0.1',ok));url='http://127.0.0.1:'+server.address().port;});
test.after(()=>server.close());
test('portal do cliente permanece fechado sem habilitação explícita',async()=>{
 if(process.env.PARTELIS_CLIENT_PORTAL_ENABLED==='1')return;
 assert.equal((await fetch(url+'/cliente')).status,404);
 assert.equal((await fetch(url+'/api/portal/updates')).status,404);
});
