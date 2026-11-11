const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('./domain.js');
const empty=()=>({schema:1,clients:[],debts:[],opportunities:[],meetings:[],proposals:[],contracts:[],installments:[],cases:[],tasks:[],audit:[]});
const payload={name:'Pessoa exemplo',phone:'31999998888',area:'Família',owner:'secretaria',next:'Atender',due:C.today(),captureId:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'};
test('capture creates separate linked client and card, reuses phone and deduplicates retries',()=>{
 const first=C.execute(empty(),'gestor','whatsappCapture',payload);
 assert.equal(first.state.clients.length,1);assert.equal(first.result.clientId,first.state.clients[0].id);
 const retry=C.execute(first.state,'gestor','whatsappCapture',payload);assert.equal(retry.state.opportunities.length,1);
 const other={...payload,captureId:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',phone:'+55 31 99999-8888'};
 const reuse=C.execute(first.state,'gestor','whatsappCapture',other);assert.equal(reuse.result.id,first.result.id);
 const next=C.execute(first.state,'gestor','whatsappCapture',{...other,newOpportunity:true});assert.equal(next.state.clients.length,1);assert.equal(next.state.opportunities.length,2);
 assert.throws(()=>C.execute(empty(),'financeiro','whatsappCapture',payload));
 assert.throws(()=>C.execute(empty(),'gestor','whatsappCapture',{...payload,phone:'123'}));
 assert.equal(empty().clients.length,0);
});
test('existing ID from another state never resolves or imports a client',()=>{
 const other=C.execute(empty(),'gestor','whatsappCapture',payload);
 const own=C.execute(empty(),'gestor','whatsappCapture',{...payload,clientId:other.state.clients[0].id});
 assert.notEqual(own.result.clientId,other.result.clientId);
});
