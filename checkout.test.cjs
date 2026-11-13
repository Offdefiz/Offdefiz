const {test}=require('node:test'),assert=require('node:assert/strict');const {paymentUrl,catalog}=require('./checkout.cjs');
test('checkout closed until configured',()=>{assert.equal(paymentUrl('solo','pix',{}),null);assert.equal(catalog({})[0].methods.pix,false)});
test('only configured plan and method, no arbitrary redirects',()=>{const env={PARTELIS_CHECKOUT_SOLO_PIX:'https://mpago.la/example'};assert.equal(paymentUrl('solo','pix',env),'https://mpago.la/example');for(const p of ['__proto__','constructor','unknown'])assert.equal(paymentUrl(p,'pix',env),null);assert.equal(paymentUrl('solo','card',env),null)});
test('rejects unsafe payment addresses',()=>{for(const u of ['http://mpago.la/x','https://mpago.la.evil.com/x','https://user:pass@mpago.la/x','javascript:alert(1)','https://localhost/x'])assert.equal(paymentUrl('solo','pix',{PARTELIS_CHECKOUT_SOLO_PIX:u}),null)});

test('HTTP checkout routes serve page and enforce configured payment',async()=>{
 const {server}=require('./server.cjs'),{Readable}=require('node:stream');
 function request(url,method='GET',payload){return new Promise(resolve=>{const req=Readable.from(payload?[JSON.stringify(payload)]:[]);Object.assign(req,{url,method,headers:{},socket:{remoteAddress:'127.0.0.1'}});const headers={};const res={setHeader(k,v){headers[k]=v},removeHeader(k){delete headers[k]},writeHead(status,values){this.status=status;Object.assign(headers,values)},end(data){resolve({status:this.status||200,body:String(data||''),headers})}};server.emit('request',req,res);});}
 for(const path of ['/contratar?plano=solo','/checkout.css','/checkout.js'])assert.equal((await request(path)).status,200);
 assert.equal(JSON.parse((await request('/api/public/checkout')).body).plans.length,3);
 assert.equal((await request('/api/public/checkout','POST',{plan:'solo',method:'pix'})).status,503);
 process.env.PARTELIS_CHECKOUT_SOLO_PIX='https://mpago.la/test';
 try{const result=await request('/api/public/checkout','POST',{plan:'solo',method:'pix'});assert.equal(result.status,200);assert.equal(JSON.parse(result.body).url,'https://mpago.la/test');}finally{delete process.env.PARTELIS_CHECKOUT_SOLO_PIX;}
});
