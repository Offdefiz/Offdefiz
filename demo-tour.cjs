// A public, read-only tour built from the same fictitious seed as the editable demo.
const domain = require('./domain.js');
const sample = domain.seed();
const client = sample.clients.find(row => row.name === 'Sofia Exemplo');
const opportunity = sample.opportunities.find(row => row.clientId === client.id);
const proposal = domain.latest(sample, opportunity.id);
const contract = sample.contracts.find(row => row.oppId === opportunity.id);
const installments = sample.installments.filter(row => row.contractId === contract.id);
const received = installments.filter(row => row.paidAt).reduce((sum, row) => sum + row.amount, 0);

const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);
const money = amount => escapeHtml(domain.money(amount));
const item = (label, value) => '<div><dt>' + escapeHtml(label) + '</dt><dd>' + value + '</dd></div>';
const pill = (text, tone = '') => '<span class="tour-pill ' + tone + '">' + escapeHtml(text) + '</span>';
const plans = '<a class="tour-button tour-buy" href="/#planos">Ver planos e contratar</a>';
const free = '<a class="tour-text-link" href="/demo?modo=livre">Explorar o painel completo <span aria-hidden="true">↗</span></a>';
const steps = [
  {
    key: 'atendimento', label: 'Atendimento', section: 'CRM / ATENDIMENTOS', title: 'O primeiro contato já tem um próximo passo.',
    description: 'Sofia chegou por indicação. No Partelís, você registra o contexto, define quem acompanha o caso e deixa o próximo retorno combinado.',
    record: escapeHtml(client.name), status: pill('Em diagnóstico'),
    details: item('Área do atendimento', escapeHtml(opportunity.area)) +
      item('Origem', escapeHtml(client.source)) +
      item('Responsável', escapeHtml(domain.roles[opportunity.owner])) +
      item('Próxima ação', 'Conferir documentos e preparar a proposta'),
    next: 'Abrir proposta'
  },
  {
    key: 'proposta', label: 'Proposta', section: 'COMERCIAL / PROPOSTAS', title: 'A proposta sai do mesmo atendimento.',
    description: 'Depois do diagnóstico, o escritório registra o escopo e os honorários no caso da Sofia. A proposta continua vinculada ao atendimento, com número de versão e situação.',
    record: 'Proposta de ' + escapeHtml(client.name), status: pill('Versão ' + proposal.version + ' · apresentada'),
    details: item('Escopo', escapeHtml(proposal.scope)) +
      item('Honorários propostos', money(proposal.amount)),
    next: 'Ver honorários'
  },
  {
    key: 'honorarios', label: 'Honorários', section: 'FINANCEIRO / HONORÁRIOS', title: 'O que foi contratado não se confunde com o que entrou.',
    description: 'Sofia aceitou a proposta e o escritório registrou a contratação. As parcelas aparecem no financeiro, onde você distingue o que recebeu do que ainda está em aberto.',
    record: 'Honorários de ' + escapeHtml(client.name), status: pill('Contratação registrada', 'tour-pill-paid'),
    details: item('Total contratado', money(contract.amount)) + item('Recebido', money(received)) +
      item('Em aberto', money(contract.amount - received)),
    rows: '<ul class="tour-installments" aria-label="Parcelas demonstrativas">' + installments.map(row =>
      '<li><span>' + escapeHtml(row.label) + '</span><strong>' + money(row.amount) + '</strong>' +
      (row.paidAt ? pill('Recebida', 'tour-pill-paid') : pill('Em aberto')) + '</li>'
    ).join('') + '</ul>'
  }
];

const url = step => step.key === 'atendimento' ? '/demo' : '/demo?etapa=' + step.key;
function renderDemoTour(stepKey) {
  const index = Math.max(0, steps.findIndex(step => step.key === stepKey));
  const step = steps[index], next = steps[index + 1], previous = steps[index - 1];
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,follow"><meta name="theme-color" content="#100b19">
<title>${step.label} · Demonstração Partelís</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/demo-tour.css?v=1">
</head>
<body class="demo-tour">
<a class="tour-skip" href="#tour-content">Pular para a demonstração</a>
<header class="tour-header"><div class="tour-wrap">
  <a href="/" aria-label="Partelís, início"><img src="/brand-horizontal-white.svg" width="130" height="44" alt="Partelís"></a>
  ${plans}
</div></header>
<main class="tour-wrap tour-main" id="tour-content">
  <div class="tour-intro"><span class="tour-kicker">DEMONSTRAÇÃO GUIADA</span>
    <p>1 minuto · Sem cadastro · Dados fictícios</p>
  </div>
  <nav class="tour-steps" aria-label="Etapas da demonstração"><ol>${steps.map((item, n) => `<li><a href="${url(item)}"${n === index ? ' aria-current="step"' : ''}><span aria-hidden="true">${n + 1}</span>${item.label}</a></li>`).join('')}</ol></nav>
  <div class="tour-grid">
    <div class="tour-copy">
      <p class="tour-kicker">ETAPA ${index + 1} DE ${steps.length}</p>
      <h1>${step.title}</h1><p class="tour-description">${step.description}</p>
    </div>
    <section class="tour-record" aria-labelledby="tour-record-name">
      <p class="tour-record-section">${step.section}</p>
      <div class="tour-record-head"><h2 id="tour-record-name">${step.record}</h2>${step.status}</div>
      <dl>${step.details}</dl>${step.rows || ''}
    </section>
    <div class="tour-actions">
      ${next ? `<a class="tour-button tour-buy" href="${url(next)}">${step.next} <span aria-hidden="true">→</span></a>` : plans}
      ${previous ? `<a class="tour-text-link" href="${url(previous)}"><span aria-hidden="true">←</span> Voltar</a>` : ''}
    </div>
  </div>
  <footer class="tour-footer">
    <p>Este exemplo não usa dados de clientes reais nem gera cobranças.</p>${free}
  </footer>
</main><script>window.CLOUD=false;</script></body></html>`;
}
module.exports = { renderDemoTour };
