const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const required = ['package.json', 'server.cjs', 'domain.js', 'landing.html', 'cookies.html', 'cookie-consent.js', 'cookie-consent.css', 'cookie-consent.test.cjs', 'login.html', 'favicon.svg', 'brand-horizontal.svg', 'ops/native/db.cjs', 'ops/native/store.cjs', 'ops/native/commercial.cjs', 'templates/proposta_acao_revisional.html', 'templates/proposta_holding.html', 'templates/proposta_passivo_bancario.html', 'templates/proposta_superendividamento.html', 'templates/proposta_multiarea.html', 'legal-service-catalog.js'];
for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) throw new Error('Deploy incompleto: arquivo ausente: ' + file);
}
const pkg = require('../package.json');
if (!pkg.dependencies?.pg || pkg.scripts?.start !== 'node server.cjs') throw new Error('Configuração de inicialização ou PostgreSQL ausente');
console.log('Arquivos e configuração de deploy verificados');
