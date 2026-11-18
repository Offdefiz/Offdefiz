const test=require('node:test'),assert=require('node:assert/strict');const {server}=require('./server.cjs');let origin;
test.before(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;});test.after(()=>server.close());
test('dados exigem autenticação',async()=>{const r=await fetch(origin+'/api/state');assert.equal(r.status,401);assert.match(r.headers.get('content-type'),/json/);});
test('painel demonstrativo usa modo local e login real continua separado',async()=>{
  const demo=await fetch(origin+'/demo?modo=livre');
  assert.equal(demo.status,200);
  assert.match(demo.headers.get('x-robots-tag'),/noindex/);
  assert.equal(demo.headers.get('set-cookie'),null);
  assert.match(await demo.text(),/window.CLOUD=false.*src="\/app.js"/);
  assert.match(await(await fetch(origin+'/app')).text(),/window.CLOUD=true/);
  assert.match(await(await fetch(origin+'/login')).text(),/autocomplete="current-password"/);
});
test('landing mantém planos em destaque e mostra telas sem exigir demonstração',async()=>{
  const landing=await(await fetch(origin+'/')).text();
  assert.match(landing,/<div class="hero-actions"><a class="btn" href="#planos">Ver planos<\/a><a class="btn btn-outline" href="#por-dentro">Ver telas do sistema<\/a>/);
  assert.match(landing,/id="por-dentro"/);
  assert.match(landing,/href="\/demo">Prefere testar\?/);
  assert.match(landing,/id="planos"/);
  assert.match(landing,/href="\/contratar\?plano=solo"/);
});
test('landing publica somente as capturas WebP previstas e o estilo da vitrine',async()=>{
  const markup=await (await fetch(origin+'/')).text();
  const css=await fetch(origin+'/product-showcase.css?v=2');
  assert.equal(css.status,200);
  assert.match(css.headers.get('content-type'),/^text\/css/);
  const linked=[...new Set(markup.match(/\/telas\/[a-z-]+-v[12]\.webp/g))];
  assert.deepEqual(linked,['/telas/dashboard-v1.webp','/telas/indicadores-v2.webp','/telas/proposta-v2.webp']);
  let imageBytes=0;
  for(const route of linked){
    const res=await fetch(origin+route);
    assert.equal(res.status,200,route);
    assert.equal(res.headers.get('content-type'),'image/webp',route);
    assert.match(res.headers.get('cache-control'),/^public,/);
    const bytes=Buffer.from(await res.arrayBuffer());
    assert.equal(bytes.toString('ascii',0,4),'RIFF');
    assert.equal(bytes.toString('ascii',8,12),'WEBP');
    assert.equal(Number(res.headers.get('content-length')),bytes.length);
    imageBytes+=bytes.length;
  }
  assert.ok(imageBytes<230000,'As três capturas devem somar menos de 230 kB');
  const head=await fetch(origin+linked[0],{method:'HEAD'});
  assert.equal(head.headers.get('content-type'),'image/webp');
  assert.equal((await head.arrayBuffer()).byteLength,0);
  assert.equal((await fetch(origin+'/telas/nao-publicado.webp')).status,404);
});
test('demo guiada acompanha um caso fictício do atendimento às parcelas',async()=>{
  const steps=[
    ['/demo','Atendimento','Sofia Exemplo','Abrir proposta'],
    ['/demo?etapa=proposta','Proposta','Honorários propostos','Ver honorários'],
    ['/demo?etapa=honorarios','Honorários','Total contratado','Parcelas demonstrativas']
  ];
  for(const [route,step,record,next] of steps){
    const demo=await fetch(origin+route,{headers:{Cookie:'cj_access=invalid;cj_refresh=invalid'}});
    assert.equal(demo.status,200,route);
    assert.match(demo.headers.get('x-robots-tag'),/noindex/);
    assert.equal(demo.headers.get('set-cookie'),null);
    const html=await demo.text();
    for(const label of [record,next,'Sem cadastro · Dados fictícios','href="/#planos">Ver planos e contratar','href="/demo?modo=livre">Explorar o painel completo'])assert.ok(html.includes(label),label);
    assert.ok(html.includes('aria-current="step"'),step);
    assert.equal((html.match(/aria-current="step"/g)||[]).length,1);
    assert.doesNotMatch(html,/<form|src="[^"]+\.js|invalid|\/api\//);
  }
  const html=await(await fetch(origin+'/demo?etapa=honorarios')).text();
  const currency=amount=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(amount);
  for(const [label,value] of [['Total contratado',3600],['Recebido',900],['Em aberto',2700]])assert.ok(html.includes('<dt>'+label+'</dt><dd>'+currency(value)+'</dd>'),label);
  const fallback=await(await fetch(origin+'/demo?etapa=%3Cscript%3E')).text();
  assert.ok(fallback.includes('O primeiro contato já tem um próximo passo.'));
  assert.doesNotMatch(fallback,/<script><script>/);
});
test('origem externa não pode submeter login',async()=>{const r=await fetch(origin+'/auth/login',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:'{}'});assert.equal(r.status,403);});
test('arquivos privados e caminhos arbitrários não são servidos',async()=>{for(const route of ['/.env','/server.cjs','/schema.sql','/package.json'])assert.equal((await fetch(origin+route)).status,404);});
