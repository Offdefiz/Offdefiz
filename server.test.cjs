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
test('landing mantém planos em destaque e leva à demo sem cadastro',async()=>{
  const landing=await(await fetch(origin+'/')).text();
  assert.match(landing,/<div class="hero-actions"><a class="btn" href="#planos">Ver planos<\/a><a class="btn btn-outline" href="\/demo">Ver o Partelís por dentro<\/a>/);
  assert.match(landing,/id="planos"/);
  assert.match(landing,/href="\/contratar\?plano=solo"/);
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
