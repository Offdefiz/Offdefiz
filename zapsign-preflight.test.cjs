'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),crypto=require('node:crypto');
const forms=require('./zapsign-formularios.json');
const {validate,substitutions,moneyCents,installments}=require('./zapsign-validation.cjs');
const {preflight}=require('./zapsign-preflight.cjs');

function values(model) {
  const defaults={cpf:'529.982.247-25',cnpj:'04.252.011/0001-10',email:'sandbox@example.invalid',phone_br:'(31) 99999-9999',date:'02/11/2026',dinheiro:'R$ 1.000,00'};
  const v=Object.fromEntries(model.update_form_payload.inputs.map(f=>[f.variable.slice(2,-2),defaults[f.input_type]||'Teste fictício']));
  if (model.tipo==='contrato') Object.assign(v,{'QUANTIDADE PARCELAS':'2','HONORARIO FIXO VALOR':'R$ 1.000,00','VALOR PARCELA':'R$ 500,00','EXITO PERCENTUAL':'20%'});
  if(model.variaveis.includes('QUANTIDADE CONTRATOS'))v['QUANTIDADE CONTRATOS']='1';
  return v;
}
test('preserva byte a byte o catálogo fornecido e exige uma matriz única de 4 × 3',()=>{
  const digest=crypto.createHash('sha256').update(fs.readFileSync('zapsign-formularios.json')).digest('hex');
  assert.equal(digest,'9ab30040f6a5fbd43f800274ad0c0ba48a25da4a364d8ca38f52d2aedd2871e3');
  const expected=['passivo_bancario','acao_revisional','superendividamento','holding'].flatMap(m=>['contrato','procuracao','declaracao_hipossuficiencia'].map(t=>`${t}_${m}.docx`));
  assert.deepEqual(forms.map(m=>m.arquivo).sort(),expected.sort());
  for(const m of forms){
    assert.equal(new Set(m.variaveis).size,m.variaveis.length);
    assert.deepEqual(m.update_form_payload.inputs.map(f=>f.order),m.variaveis.map((_,i)=>i+1));
    assert.equal(m.assinantes.length,m.tipo==='contrato'?2:1);
  }
});
for(const model of forms) test(`pré-validação sem efeitos externos: ${model.arquivo}`,()=>{
  const v=values(model),copy=structuredClone(v),result=preflight(model.modalidade,model.tipo,v);
  assert.equal(result.ok,true);assert.equal(result.validationOnly,true);
  assert.equal(result.canCreateDocument,false);assert.equal(result.productionEnabled,false);
  assert.deepEqual(v,copy);
  assert.deepEqual(substitutions(model.modalidade,model.tipo,v),model.variaveis.map(n=>({de:`{{${n}}}`,para:v[n]})));
  assert.equal(JSON.stringify(result).includes('sandbox@example.invalid'),false);
  for(const n of model.variaveis){const missing={...v};delete missing[n];assert.equal(validate(model.modalidade,model.tipo,missing).ok,false,`campo obrigatório: ${n}`);}
});
test('rejeita dados de outro modelo, objetos inválidos, campos herdados e marcadores residuais',()=>{
  const m=forms[2],v=values(m),run=x=>validate(m.modalidade,m.tipo,x);
  for(const x of [undefined,null,[],42,'texto',Object.create(v)])assert.equal(run(x).ok,false);
  assert.equal(run({...v,'CAMPO_PRIVADO_NAO_ECOAR':'valor'}).ok,false);
  assert.equal(JSON.stringify(run({...v,'CAMPO_PRIVADO_NAO_ECOAR':'valor'})).includes('CAMPO_PRIVADO_NAO_ECOAR'),false);
  for(const marker of ['{{restante}}','abc}}','<<signer1>>']) assert.equal(run({...v,'NOME COMPLETO':marker}).ok,false);
  assert.throws(()=>preflight('desconhecida','contrato',v),/Modelo/);
});
test('rejeita formatos inválidos, datas inexistentes e números fora da precisão segura',()=>{
  const m=forms[0],v=values(m);
  for(const [name,value] of Object.entries({'CPF DO CLIENTE':'12345678900','ESCRITORIO CNPJ':'12345678000100','EMAIL DO CLIENTE':'invalido','TELEFONE DO CLIENTE':'31999999999','DATA CONTRATO':'31/02/2026','HONORARIO FIXO VALOR':'R$ 1.000,001','QUANTIDADE PARCELAS':'9007199254740993','EXITO PERCENTUAL':'101%'})){
    assert.equal(validate(m.modalidade,m.tipo,{...v,[name]:value}).ok,false,name);
  }
  assert.equal(moneyCents('R$ 90.071.992.547.409,92'),null);
  assert.equal(moneyCents('R$ 0,01'),1);
  assert.equal(validate(m.modalidade,m.tipo,{...v,'DATA CONTRATO':'29/02/2028'}).ok,true);
});
test('confronta parcela com total e informa o bloqueio quando a última difere',()=>{
  const m=forms[0],v=values(m);
  assert.equal(validate(m.modalidade,m.tipo,{...v,'VALOR PARCELA':'R$ 499,99'}).ok,false);
  assert.equal(validate(m.modalidade,m.tipo,{...v,'HONORARIO FIXO VALOR':'R$ 0,00'}).ok,false);
  const r=preflight(m.modalidade,m.tipo,{...v,'HONORARIO FIXO VALOR':'R$ 10,00','QUANTIDADE PARCELAS':'3','VALOR PARCELA':'R$ 3,33'});
  assert.equal(r.ok,true);assert.deepEqual(r.parcelamento,{regularCents:333,lastCents:334,count:3});
  assert.ok(r.blockers.some(x=>x.includes('última parcela')));assert.equal(r.canCreateDocument,false);
  for(const [total,count] of [[1000,3],[1001,3],[10000,7],[9007199254740000,9]]){
    const s=installments(total,count);assert.equal(s.regularCents*(count-1)+s.lastCents,total);
  }
});
test('relata divergências dos originais e nunca libera produção por variável de ambiente',()=>{
  process.env.ZAPSIGN_ENABLED='true';process.env.ZAPSIGN_ENV='production';
  for(const m of forms){const r=preflight(m.modalidade,m.tipo,values(m));assert.equal(r.productionEnabled,false);assert.equal(r.canCreateDocument,false);}
  const p=preflight(forms[1].modalidade,forms[1].tipo,values(forms[1]));assert.ok(p.blockers.some(x=>x.includes('âncoras')));
  const c=preflight(forms[0].modalidade,forms[0].tipo,values(forms[0]));assert.ok(c.blockers.some(x=>x.includes('R$')));
  const missing=forms.find(m=>m.arquivo==='contrato_acao_revisional.docx');assert.ok(preflight(missing.modalidade,missing.tipo,values(missing)).blockers.some(x=>x.includes('original')));
  delete process.env.ZAPSIGN_ENABLED;delete process.env.ZAPSIGN_ENV;
});
