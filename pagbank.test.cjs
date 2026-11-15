'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const P=require('./pagbank.cjs');
const env={PARTELIS_PAGBANK_ENABLED:'true',PARTELIS_PAGBANK_TOKEN:'private-test-token',PUBLIC_APP_URL:'https://partelis.com.br'};
const id='5c9ef424-1eb2-4f4c-8bb0-b9e343b9c7e2';
const input={plan:'solo',method:'pix',firm_name:'Meu escritório',contact_name:'Pessoa Teste',email:'pessoa@example.com',consent:true,request_id:id};
const order={...P.validate(input),id,checkout_id:'CHEC_5c9ef424-1eb2-4f4c-8bb0-b9e343b9c7e2'};
const provider={id:'ORDE_5c9ef424-1eb2-4f4c-8bb0-b9e343b9c7e2',reference_id:id,items:[{reference_id:'solo',quantity:1,unit_amount:5900}],charges:[{id:'CHAR_123',status:'PAID',amount:{value:5900,currency:'BRL',summary:{paid:5900,refunded:0}}}]};
const sign=raw=>crypto.createHash('sha256').update(env.PARTELIS_PAGBANK_TOKEN+'-').update(raw).digest('hex');
test('gateway fails closed, production origin and exact hosted payment domains',()=>{
 assert.equal(P.configured(env),true);for(const e of [{},{...env,PARTELIS_PAGBANK_ENABLED:'false'},{...env,PUBLIC_APP_URL:'http://partelis.com.br'},{...env,PUBLIC_APP_URL:'https://user:pass@partelis.com.br'}])assert.equal(P.configured(e),false);
 for(const v of ['https://evil.com','https://pagamento.pagbank.com.br.evil.com','https://user:pass@pagamento.pagbank.com.br','http://pagamento.pagbank.com.br'])assert.equal(P.validPayUrl(v),null);
 assert.ok(P.validPayUrl('https://pagamento.pagbank.com.br/pagamento?code=123'));
});
test('server owns price, validates contact and sends no card data, no recurrence',()=>{
 assert.equal(P.validate({...input,amount:1}).amount,5900);
 for(const bad of [{plan:'__proto__'},{method:'cash'},{email:'invalid'},{consent:false},{request_id:'invalid'}])assert.throws(()=>P.validate({...input,...bad}));
 const data=P.payload(order,env);assert.equal(data.items[0].unit_amount,5900);assert.equal(data.payment_methods[0].type,'PIX');assert.equal(data.recurrence_plan,undefined);assert.equal(data.payment_notification_urls[0],'https://partelis.com.br/api/public/payments/pagbank');
 const card=P.payload({...order,method:'card'},env);assert.equal(card.payment_methods_configs[0].config_options[0].value,'1');
});
test('authenticity uses exact raw bytes and constant-time validation',()=>{
 const raw=Buffer.from('{ "status": "PAID" }');assert.equal(P.authentic(raw,sign(raw),env.PARTELIS_PAGBANK_TOKEN),true);
 for(const h of ['',undefined,'garbage','0'.repeat(64)])assert.equal(P.authentic(raw,h,env.PARTELIS_PAGBANK_TOKEN),false);
 assert.equal(P.authentic(Buffer.from('{"status":"PAID"}'),sign(raw),env.PARTELIS_PAGBANK_TOKEN),false);
});
test('authoritative payment requires reference, plan, quantity, amount, BRL and full capture',()=>{
 assert.equal(P.verifiedPayment(order,provider).status,'paid');
 for(const change of [{reference_id:crypto.randomUUID()},{items:[{reference_id:'solo',quantity:1,unit_amount:1}]}])assert.throws(()=>P.verifiedPayment(order,{...provider,...change}));
 for(const amount of [{value:1,currency:'BRL',summary:{paid:1,refunded:0}},{value:5900,currency:'USD',summary:{paid:5900,refunded:0}},{value:5900,currency:'BRL',summary:{paid:5900,refunded:100}}])assert.notEqual(P.verifiedPayment(order,{...provider,charges:[{...provider.charges[0],amount}]}).status,'paid');
});
test('real checkout request uses fixed production API, known URLs, idempotency and persists before redirect',async()=>{
 let calls=0,attached=false,saved;
 const repo={reserve:async p=>(saved=p),attach:async(id,p)=>{assert.equal(id,saved.id);assert.equal(p.checkout_id,order.checkout_id);attached=true;}};
 const fetcher=async(url,options)=>{calls++;assert.equal(url,'https://api.pagseguro.com/checkouts');assert.equal(options.headers.Authorization,'Bearer private-test-token');const body=JSON.parse(options.body);assert.equal(options.headers['x-idempotency-key'],saved.id);assert.equal(body.items[0].unit_amount,5900);return {ok:true,json:async()=>({id:order.checkout_id,reference_id:saved.id,links:[{rel:'PAY',href:'https://pagamento.pagbank.com.br/pagamento?code=123'}]})};};
 const result=await P.service({repo,env,fetcher}).start(input);assert.ok(attached);assert.equal(calls,1);assert.equal(result.url,'https://pagamento.pagbank.com.br/pagamento?code=123');
 await assert.rejects(P.api('https://evil.com',{env,fetcher}));
});
test('duplicate checkout uses durable URL and does not create another checkout',async()=>{
 const repo={reserve:async()=>({...order,status:'waiting',url:'https://pagamento.pagbank.com.br/pagamento?code=123',expires_at:new Date(Date.now()+60000).toISOString()})};
 const result=await P.service({repo,env,fetcher:()=>{throw Error('must not call')}}).start(input);assert.ok(result.url);
});
test('webhook rejects forged notifications before storage/API; never trusts incoming paid status',async()=>{
 const raw=Buffer.from(JSON.stringify(provider));let queried=0,applied=0;
 const repo={find:async()=>order,apply:async(id,p)=>{applied++;assert.equal(p.status,'waiting');}};
 const fetcher=async(url)=>{queried++;assert.equal(url,'https://api.pagseguro.com/orders/'+provider.id);return {ok:true,json:async()=>({...provider,charges:[{...provider.charges[0],status:'WAITING'}]})};};
 const service=P.service({repo,env,fetcher});await assert.rejects(service.webhook(raw,{}),e=>e.status===401);assert.equal(queried,0);
 await service.webhook(raw,{'x-authenticity-token':sign(raw)});assert.equal(queried,1);assert.equal(applied,1);
});
test('webhook provider failures cause retry; arbitrary notification links never fetched',async()=>{
 const raw=Buffer.from(JSON.stringify({...provider,links:[{rel:'SELF',href:'http://localhost/private'}]}));let applied=false;
 const repo={find:async()=>order,apply:async()=>{applied=true}};
 await assert.rejects(P.service({repo,env,fetcher:async()=>({ok:false})}).webhook(raw,{'x-authenticity-token':sign(raw)}),e=>e.status===503);assert.equal(applied,false);
});
