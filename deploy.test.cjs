const {test} = require('node:test');
const assert = require('node:assert/strict');
const {once} = require('node:events');
const {server} = require('./server.cjs');
test('deploy serves public pages, brand assets and proposal templates', async () => {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const base = 'http://127.0.0.1:' + server.address().port;
    for (const route of ['/health', '/', '/demo', '/login', '/favicon.svg', '/brand-horizontal.svg', '/templates/proposta_acao_revisional.html', '/templates/proposta_holding.html', '/templates/proposta_passivo_bancario.html', '/templates/proposta_superendividamento.html']) {
      const res = await fetch(base + route);
      assert.equal(res.status, 200, route);
      assert.ok((await res.text()).length > 0, route);
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
});
