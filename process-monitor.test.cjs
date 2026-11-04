'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),C=require('./domain.js');
const DAY='2026-11-04',number='00008323520184013202';
const state=()=>({schema:1,clients:[],debts:[],opportunities:[],meetings:[],proposals:[],contracts:[],installments:[],cases:[],tasks:[],audit:[]});
const register=s=>C.execute(s,'juridico','monitor',{operation:'register',number,label:'Processo fictício para auditoria'},DAY).state;
test('cadastra número CNJ e impede duplicata por escritório',()=>{
 const s=register(state());assert.equal(s.processMonitors[0].number,number);
 assert.throws(()=>register(s),/já cadastrado/);
});
test('movimentação exige URL do tribunal e conferência humana',()=>{
 const s=register(state()),id=s.processMonitors[0].id;
 const base={operation:'record',id,summary:'Acompanhamento manual de teste',eventDate:DAY,confirm:true};
 assert.throws(()=>C.execute(s,'juridico','monitor',{...base,sourceUrl:'https://jus.br.evil.example/abc'},DAY),/fonte oficial/);
 assert.throws(()=>C.execute(s,'juridico','monitor',{...base,sourceUrl:'https://pje.trt3.jus.br/abc',confirm:false},DAY),/Confirme/);
 const next=C.execute(s,'juridico','monitor',{...base,sourceUrl:'https://pje.trt3.jus.br/abc'},DAY).state;
 assert.equal(next.processMonitors[0].events.length,1);
 assert.equal(next.processMonitors[0].events[0].reviewMethod,'manual');
 assert.equal(next.tasks.length,0,'Movimentação não pode criar prazo judicial automaticamente.');
});
test('secretaria não registra processo e ausência de rede é invariante',()=>{
 assert.throws(()=>C.execute(state(),'secretaria','monitor',{operation:'register',number,label:'Fictício'},DAY),/perfil/);
 const src=require('node:fs').readFileSync('domain.js','utf8');
 assert.doesNotMatch(src,/api-publica\.datajud\.cnj\.jus\.br/);
});