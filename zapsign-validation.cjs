'use strict';

// Os nomes de campos vêm exclusivamente do catálogo fornecido com os modelos.
const forms = require('./zapsign-formularios.json');
const {cpfValid,cnpjValid}=require('./lib/legal-core.cjs');
function template(modalidade, tipo) {
  const found = forms.find(x => x.modalidade === modalidade && x.tipo === tipo);
  if (!found) throw new Error('Modelo não encontrado.');
  return found;
}
function validDate(s) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return false;
  const [d,m,y] = s.split('/').map(Number), x = new Date(Date.UTC(y,m-1,d));
  return y >= 1900 && x.getUTCFullYear() === y && x.getUTCMonth() === m-1 && x.getUTCDate() === d;
}
function validate(modalidade, tipo, values) {
  const model = template(modalidade,tipo), errors = [];
  if (!values || typeof values !== 'object' || Array.isArray(values) || ![Object.prototype,null].includes(Object.getPrototypeOf(values))) {
    return {ok:false,errors:['Valores: informe um objeto de campos do modelo.']};
  }
  // Não ecoar chaves desconhecidas: também podem conter dados pessoais.
  if (Object.keys(values).some(name => !model.variaveis.includes(name))) errors.push('Valores: há campos fora do catálogo deste modelo.');
  const inputs = new Map(model.update_form_payload.inputs.map(x => [x.variable.slice(2,-2),x]));
  for (const name of model.variaveis) {
    const raw = Object.hasOwn(values,name) ? values[name] : undefined;
    const value = typeof raw === 'string' ? raw.trim() : '';
    const field = inputs.get(name), label = field?.label || name;
    if (!value) { errors.push(`${label}: preenchimento obrigatório.`); continue; }
    if (/\{\{|\}\}|<</.test(value)) { errors.push(`${label}: contém marcador de modelo.`); continue; }
    let ok = true;
    if (name === 'CPF DO CLIENTE') ok = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(value) && cpfValid(value);
    else if (name === 'ESCRITORIO CNPJ') ok = /^[\dA-Z]{2}\.[\dA-Z]{3}\.[\dA-Z]{3}\/[\dA-Z]{4}-\d{2}$/i.test(value) && cnpjValid(value);
    else if (field?.input_type === 'email' || name === 'ADVOGADO EMAIL') ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    else if (field?.input_type === 'phone_br') ok = /^\(\d{2}\) \d{5}-\d{4}$/.test(value);
    else if (field?.input_type === 'date') ok = validDate(value);
    else if (field?.input_type === 'dinheiro') ok = moneyCents(value) !== null;
    if (name === 'QUANTIDADE PARCELAS' || name === 'QUANTIDADE CONTRATOS') ok = /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value));
    if (name === 'EXITO PERCENTUAL') ok = /^(?:\d{1,2}(?:[,.]\d+)?|100(?:[,.]0+)?)%$/.test(value);
    if (!ok) errors.push(`${label}: formato inválido.`);
  }
  if (!errors.length && tipo === 'contrato') {
    const total=moneyCents(values['HONORARIO FIXO VALOR'].trim()), count=Number(values['QUANTIDADE PARCELAS']);
    try {
      const schedule=installments(total,count);
      if (moneyCents(values['VALOR PARCELA'].trim()) !== schedule.regularCents) errors.push('Valor da parcela: não corresponde ao honorário dividido pela quantidade de parcelas.');
    } catch { errors.push('Honorário ou quantidade de parcelas inválidos.'); }
  }
  return {ok: errors.length === 0, errors};
}
function moneyCents(value) {
  if (typeof value !== 'string' || !/^R\$ (?:\d{1,3}(?:\.\d{3})*|\d+),\d{2}$/.test(value)) return null;
  const cents=Number(value.slice(3).replace(/[.,]/g,''));
  return Number.isSafeInteger(cents) ? cents : null;
}
function substitutions(modalidade,tipo,values) {
  const result = validate(modalidade,tipo,values);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return template(modalidade,tipo).variaveis.map(name => ({de:`{{${name}}}`,para:values[name].trim()}));
}
// A última parcela absorve a diferença de centavos; não se confunde com o valor regular.
function installments(totalCents,count) {
  if (!Number.isSafeInteger(totalCents) || totalCents < 1 || !Number.isSafeInteger(count) || count < 1 || count > totalCents) throw new Error('Honorário ou quantidade de parcelas inválidos.');
  const regular = Math.round(totalCents/count), last = totalCents - regular*(count-1);
  if (last < 1) throw new Error('A quantidade gera uma última parcela inválida.');
  return {regularCents:regular,lastCents:last,count};
}
module.exports = {template,validate,substitutions,installments,moneyCents};
