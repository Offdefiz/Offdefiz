'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {webcrypto,createHash}=require('node:crypto');
function setup(){
 let accepted=false,activate,cleanup,domReady,loads=[],timers=[],status='waiting',calls=0;
 const storage=new Map();
 const document={createElement:()=>({}),head:{appendChild(s){loads.push(s.src)}}};
 const w={crypto:webcrypto,document,sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
  addEventListener(t,fn){domReady=fn},clearTimeout(){},setTimeout(fn){timers.push(fn);return timers.length},
  PartelisCookies:{allowed:()=>accepted,whenAllowed(cat,fn){assert.equal(cat,'marketing');activate=fn;}},
  fetch:async()=>{calls++;return {ok:true,json:async()=>({id:'order-verified',status,registered:status==='paid',plan:{id:'solo',name:'Solo',price:59}})}}
 };
 vm.runInNewContext(fs.readFileSync('marketing.js','utf8'),{window:w,document,TextEncoder,Uint8Array,Date});domReady();
 return {w,loads,storage,get calls(){return calls},accept(){accepted=true;cleanup=activate()},decline(){accepted=false;cleanup?.()},status(v){status=v}};
}
test('no SDK, event, identity or payment lookup before acceptance',async()=>{
 const h=setup();h.w.PartelisMarketing.view({id:'partelis'});
 assert.equal(h.loads.length,0);assert.equal(h.w.PartelisMarketing.track('Purchase'),false);
 assert.equal(await h.w.PartelisMarketing.identify({email:'person@example.invalid'}),false);
 await h.w.PartelisMarketing.checkOrder();assert.equal(h.calls,0);assert.equal(h.storage.size,0);
 h.accept();assert.equal(h.loads.length,2);assert.equal(h.w.ttq.filter(x=>x[0]==='track'&&x[1]==='ViewContent').length,1);
});
test('identity uses normalized SHA-256 only and revocation clears hashes',async()=>{
 const h=setup();h.accept();
 await h.w.PartelisMarketing.identify({email:' PERSON@Example.invalid ',phone:'(31) 99999-1234',firm:'private legal firm',message:'private case'});
 const identity=h.w.ttq.find(x=>x[0]==='identify')[1];
 assert.equal(identity.email,createHash('sha256').update('person@example.invalid').digest('hex'));
 assert.equal(identity.phone_number,createHash('sha256').update('5531999991234').digest('hex'));
 assert.match(identity.external_id,/^[a-f0-9]{64}$/);
 assert.deepEqual(Object.keys(identity).sort(),['email','external_id','phone_number']);
 assert.doesNotMatch(JSON.stringify([...h.storage]),/person@|private case|private legal firm|99999-1234/);
 h.decline();assert.equal(h.storage.has('pt_tt_hashes'),false);
 assert.equal(h.w.PartelisMarketing.track('Lead'),false);
});
test('purchase requires server paid status; registration and purchase are deduplicated',async()=>{
 const h=setup();h.accept();const api=h.w.PartelisMarketing;
 api.rememberOrder('bfc6b660-c6e3-428c-8618-f82e25430c28');await api.checkOrder();
 assert.equal(h.w.ttq.filter(x=>x[0]==='track'&&x[1]==='Purchase').length,0);
 h.status('paid');await api.checkOrder();await api.checkOrder();
 const purchases=h.w.ttq.filter(x=>x[0]==='track'&&x[1]==='Purchase');
 assert.equal(purchases.length,1);assert.equal(purchases[0][2].value,59);assert.equal(purchases[0][2].currency,'BRL');
 assert.equal(h.w.ttq.filter(x=>x[0]==='track'&&x[1]==='CompleteRegistration').length,1);
});
test('Meta consent, event isolation and paid purchase deduplication',async()=>{
 const h=setup();assert.equal(h.w.fbq,undefined);h.accept();
 assert.ok(h.loads.includes('https://connect.facebook.net/en_US/fbevents.js'));
 assert.equal(h.w.fbq.queue.filter(x=>x[0]==='init'&&x[1]==='1462114395890964').length,1);
 const api=h.w.PartelisMarketing;api.rememberOrder('bfc6b660-c6e3-428c-8618-f82e25430c28');
 await api.checkOrder();assert.equal(h.w.fbq.queue.filter(x=>x[2]==='Purchase').length,0);
 h.status('paid');await api.checkOrder();await api.checkOrder();
 const purchases=h.w.fbq.queue.filter(x=>x[0]==='trackSingle'&&x[2]==='Purchase');
 assert.equal(purchases.length,1);assert.equal(purchases[0][3].value,59);
 assert.equal(purchases[0][4].eventID,'purchase:order-verified');
 assert.doesNotMatch(JSON.stringify(h.w.fbq.queue),/email|phone|private case/);
 h.decline();assert.equal(h.w.fbq.queue.at(-1)[1],'revoke');
 const before=h.w.fbq.queue.length;assert.equal(api.track('Lead'),false);assert.equal(h.w.fbq.queue.length,before);
});

