'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {DjenHttpAdapter,normalizeItem}=require('./lib/djen-http.cjs');
const {cnjDigits}=require('./lib/legal-core.cjs');
const base='0000001'+'2026'+'8'+'13'+'0001',cnj=base.slice(0,7)+cnjDigits(base)+base.slice(7);
test('DJEN usa somente endpoint público oficial e filtros exatos',async()=>{
 const adapter=new DjenHttpAdapter({httpClient:async(url,options)=>{
  const u=new URL(url);assert.equal(u.origin,'https://comunicaapi.pje.jus.br');
  assert.equal(u.searchParams.get('numeroProcesso'),cnj);
  assert.equal(options.redirect,'error');assert.ok(options.signal);
  return {ok:true,json:async()=>({items:[{id:1,numero_processo:cnj,data_disponibilizacao:'2026-11-10',texto:'<b>Intimação</b>'}]})};
 }});
 const r=await adapter.searchByNumber(cnj);
 assert.equal(r.complete,true);assert.equal(r.items[0].summary,'Intimação');assert.equal(r.items[0].isFatal,false);
});
test('DJEN consulta OAB e rejeita formato, erro remoto e resposta desconhecida',async()=>{
 let calls=0;
 const adapter=new DjenHttpAdapter({httpClient:async(url)=>{calls++;assert.equal(new URL(url).searchParams.get('ufOab'),'MG');return {ok:true,json:async()=>({items:[]})};}});
 await adapter.searchByOab({number:'12345',state:'MG'});assert.equal(calls,1);
 await assert.rejects(()=>adapter.searchByOab({number:'bad',state:'MG'}),/INVALID_OAB/);
 await assert.rejects(()=>new DjenHttpAdapter({httpClient:async()=>({ok:false,status:429})}).searchByNumber(cnj),/RATE_LIMITED/);
 await assert.rejects(()=>new DjenHttpAdapter({httpClient:async()=>({ok:true,json:async()=>({bad:[]})})}).searchByNumber(cnj),/INVALID_RESPONSE/);
 assert.throws(()=>normalizeItem({id:1,numero_processo:'invalido',data_disponibilizacao:'2026-11-10'}),/INVALID_RESPONSE/);
});
test('DJEN sinaliza paginação parcial em vez de declarar sincronização completa',async()=>{
 const item={id:1,numero_processo:cnj,data_disponibilizacao:'2026-11-10',texto:'Publicação'};
 const r=await new DjenHttpAdapter({maxPages:1,httpClient:async()=>({ok:true,json:async()=>({items:Array(100).fill(item)})})}).searchByNumber(cnj);
 assert.equal(r.complete,false);assert.equal(r.items.length,100);
});
