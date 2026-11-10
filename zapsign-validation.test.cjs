'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {template,validate,substitutions,installments} = require('./zapsign-validation.cjs');
test('exige todos os campos e rejeita marcadores ainda não preenchidos',()=>{
  const m=template('passivo_bancario','declaracao_hipossuficiencia');
  const v=Object.fromEntries(m.variaveis.map(n=>[n,'teste']));
  v['CPF DO CLIENTE']='123.456.789-00'; v['RENDA MENSAL']='R$ 1.000,00'; v['DATA CONTRATO']='01/11/2026';
  assert.equal(validate(m.modalidade,m.tipo,v).ok,true);
  assert.deepEqual(substitutions(m.modalidade,m.tipo,v).map(x=>x.de),m.variaveis.map(n=>`{{${n}}}`));
  v['NOME COMPLETO']='{{NOME COMPLETO}}'; v['DATA CONTRATO']='31/02/2026';
  assert.equal(validate(m.modalidade,m.tipo,v).errors.length,2);
  delete v['CPF DO CLIENTE']; assert.throws(()=>substitutions(m.modalidade,m.tipo,v));
});
test('distribui centavos e mantém soma exata',()=>{
  const result=installments(1000,3);
  assert.deepEqual(result,{regularCents:333,lastCents:334,count:3});
  assert.throws(()=>installments(2,3));
});
test('catálogo identifica os doze modelos com campos correspondentes',()=>{
  const forms=require('./zapsign-formularios.json'); assert.equal(forms.length,12);
  for(const m of forms) assert.deepEqual(m.variaveis,m.update_form_payload.inputs.map(x=>x.variable.slice(2,-2)));
});
