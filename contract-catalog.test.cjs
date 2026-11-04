'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {models}=require('./contract-catalog.cjs');
const original=require('./zapsign-formularios.json');
test('catálogo público mantém os 12 modelos, todas as chaves e sua ordem exata',()=>{
 const result=models();assert.equal(result.length,12);
 for(const [i,model] of result.entries()){
  assert.equal(model.modalidade,original[i].modalidade);
  assert.equal(model.tipo,original[i].tipo);
  assert.deepEqual(model.fields.map(f=>f.variable),original[i].variaveis);
  assert.deepEqual(model.fields.map(f=>f.order),original[i].variaveis.map(name=>original[i].update_form_payload.inputs.find(f=>f.variable==='{{'+name+'}}')?.order??null));
  assert.equal(Object.hasOwn(model,'assinantes'),false);
 }
});
test('modelos da interface não contêm valor de cliente, token ou link de assinatura',()=>{
 const data=JSON.stringify(models());
 assert.equal(/sign_url|doc_token|access_token|service_role/i.test(data),false);
});
