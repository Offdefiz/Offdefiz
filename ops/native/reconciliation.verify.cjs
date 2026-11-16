'use strict';
const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
if(!/^partelis_verify_[a-z0-9_]+$/.test(process.env.PGDATABASE||''))throw Error('Use um banco descartável.');
process.env.PARTELIS_STORAGE='postgres';
process.env.PARTELIS_OWNER_EMAIL='owner-'+randomUUID()+'@example.invalid';
process.env.PARTELIS_CHECKOUT_SOLO_PIX='https://pag.ae/partelis-test';
process.env.PARTELIS_PAGBANK_ENABLED='false';
delete process.env.PARTELIS_EMAIL_API_KEY;
delete process.env.PARTELIS_EMAIL_FROM;
const {server}=require('../../server.cjs'),{pool}=require('./db.cjs');
const {provision}=require('./invite.cjs'),{repo}=require('./payments.cjs');
const {service}=require('./reconciliation.cjs');
async function verify(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const request=(route,data,cookie='',sameOrigin=true)=>fetch(origin+route,{
  method:data?'POST':'GET',headers:{cookie,origin:sameOrigin?origin:'https://example.invalid','Content-Type':'application/json'},body:data?JSON.stringify(data):undefined
 });
 const prefix='/api/admin/commercial/';
 const route='/api/public/checkout';
 const secret=await provision(process.env.PARTELIS_OWNER_EMAIL,'Proprietário - Teste');
 const activated=await request('/auth/activate',{token_hash:secret});
 assert.equal(activated.status,200);
 const cookie=activated.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
 const actor=(await pool.query('SELECT id FROM native_users WHERE email=$1',[process.env.PARTELIS_OWNER_EMAIL])).rows[0].id;
 const checkout=(n)=>({firm_name:'Escritório '+n,contact_name:'Responsável '+n,email:'cliente-'+randomUUID()+'@example.invalid',plan:'solo',method:'pix',consent:true,request_id:randomUUID()});
 const first=checkout('um'),second=checkout('dois');
 assert.equal((await(await request(route)).json()).requires_buyer,true);
 assert.equal((await request(route,first,'',false)).status,403);
 assert.equal((await request(route,{...first,email:''})).status,400);
 for(const p of [first,first,second]){
  const response=await request(route,p);assert.equal(response.status,200);assert.equal((await response.json()).url,process.env.PARTELIS_CHECKOUT_SOLO_PIX);
 }
 assert.equal((await request(route,{...first,email:second.email})).status,409);
 const {payments}=await(await request(prefix+'payments',undefined,cookie)).json();
 const a=payments.find(p=>p.email===first.email),b=payments.find(p=>p.email===second.email);
 assert.equal(payments.filter(p=>p.email===first.email).length,1);
 assert.equal(a.source,'payment_link');assert.equal(a.status,'waiting');assert.equal(b.status,'waiting');
 const ref=randomUUID(),data={id:a.id,reference:ref,payment_email:first.email};
 assert.equal((await request(prefix+'confirm-payment',data)).status,401);
 assert.equal((await request(prefix+'confirm-payment',{...data,payment_email:second.email},cookie)).status,409);
 assert.equal((await request(prefix+'confirm-payment',{...data,reference:'123'},cookie)).status,400);
 const confirmed=await request(prefix+'confirm-payment',data,cookie);assert.equal(confirmed.status,200);
 const outcome=await confirmed.json();assert.equal(outcome.email_state,'unconfigured');assert.ok(outcome.activation_url.includes('/ativar#'));
 assert.equal((await(await request(prefix+'confirm-payment',data,cookie)).json()).already,true);
 assert.equal((await request(prefix+'confirm-payment',{id:b.id,reference:ref,payment_email:second.email},cookie)).status,409);
 const untouched=await repo.find(b.id);assert.equal(untouched.status,'waiting');assert.equal(untouched.workspace_id,null);
 const tenants=(await(await request(prefix+'list',undefined,cookie)).json()).tenants;
 const customer=tenants.find(t=>t.workspace_id===outcome.workspace_id);
 assert.equal(customer.plan,'solo');assert.equal(customer.status,'pending_activation');assert.ok(customer.renewal_due_at);
 assert.equal((await request(prefix+'invite-member',{workspace_id:customer.workspace_id,email:second.email,role:'advogado'},cookie)).status,409);
 const mail=[];
 const env={PARTELIS_EMAIL_API_KEY:'test-not-a-real-key',PARTELIS_EMAIL_FROM:'convites@example.invalid'};
 const mailService=service({env,send:async params=>{mail.push(params);return mail.length>1;}});
 const failed=await mailService.resend({id:a.id},actor);assert.equal(failed.email_state,'failed');
 const sent=await mailService.resend({id:a.id},actor);assert.equal(sent.email_state,'sent');
 assert.equal(mail[0].version,mail[1].version);assert.equal(mail[1].email,first.email);
 const inviteToken=new URL(mail[1].url).hash.split('=')[1];
 const client=await request('/auth/activate',{token_hash:inviteToken});assert.equal(client.status,200);
 assert.equal((await request('/auth/activate',{token_hash:inviteToken})).status,400);
 const clientCookie=client.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
 assert.equal((await request('/api/password',{password:'Teste-Cliente-Exclusivo-2026'},clientCookie)).status,200);
 assert.equal((await request(prefix+'payments',undefined,clientCookie)).status,403);
 await assert.rejects(mailService.resend({id:a.id},actor),e=>e.status===409);

 const g=checkout('api'),gid=randomUUID();
 await repo.reserve({id:gid,request_id:g.request_id,plan:'escritorio',method:'card',amount:11900,firm:g.firm_name,name:g.contact_name,email:g.email});
 await assert.rejects(mailService.approve({id:gid},actor),e=>e.status===409);
 await repo.apply(gid,{status:'paid',provider_order_id:'ORDE_'+randomUUID(),charge_id:'CHAR_'+randomUUID()});
 const gateway=await repo.find(gid);
 assert.equal((await request(prefix+'provision',{lead_id:gateway.lead_id},cookie)).status,409);
 assert.equal((await mailService.approve({id:gid},actor)).email_state,'sent');
 assert.equal(mail.at(-1).email,g.email);
 console.log('Conciliação: dois compradores, pagamento pendente, referência única, plano correto, convite, reenvio e exclusividade do proprietário verificados.');
}
verify().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{server.close();await pool.end();});
