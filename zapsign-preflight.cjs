'use strict';

const {template,validate,installments,moneyCents}=require('./zapsign-validation.cjs');
const audit=require('./docs/zapsign-source-audit.json');

// Pré-validação pura. Não importa cliente HTTP, não persiste dados e não libera assinatura.
// A API responde apenas com erros de campos, metadados e centavos calculados, nunca com valores pessoais.
function preflight(modalidade,tipo,values) {
  const model=template(modalidade,tipo);
  const validation=validate(modalidade,tipo,values);
  let parcelamento=null;
  const blockers=['Validação dos 12 modelos e PDFs em sandbox pendente.'];
  const source=audit.models.find(x=>x.arquivo===model.arquivo);
  if (!source || source.status !== 'audited') blockers.push('Documento original ainda não auditado.');
  if (source?.missing_variables?.length || source?.extra_variables?.length || source?.extra_anchors?.length || source?.unsupported_content?.length) blockers.push('O original diverge do catálogo ou contém conteúdo não suportado.');
  if (source?.missing_anchors?.length) blockers.push('O original não contém todas as âncoras de assinatura e rubrica do catálogo.');
  if (source?.literal_currency_prefix?.length) blockers.push('O original já contém R$ antes de campos monetários; representação precisa ser validada para evitar prefixo duplicado.');
  if (validation.ok && tipo==='contrato') {
    parcelamento=installments(moneyCents(values['HONORARIO FIXO VALOR'].trim()),Number(values['QUANTIDADE PARCELAS']));
    if (parcelamento.lastCents !== parcelamento.regularCents) {
      blockers.push('O modelo não possui variável para a última parcela ajustada; resolver a representação sem alterar o texto silenciosamente.');
    }
    blockers.push('Conferência do honorário por extenso pendente.');
  }
  return {
    ...validation,validationOnly:true,modelo:model.arquivo,assinantes:model.assinantes.length,parcelamento,
    canCreateDocument:false,productionEnabled:false,blockers
  };
}

module.exports={preflight};
