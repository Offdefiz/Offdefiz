'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
process.env.SUPABASE_URL='https://supabase.invalid';
process.env.SUPABASE_PUBLISHABLE_KEY='test-key';
delete process.env.PUBLIC_APP_URL;
const {server}=require('./server.cjs');
const realFetch=global.fetch;
let origin,role='gestor',calls=[];
test.before(async()=>{
  global.fetch=async(input,opts={})=>{
    if(String(input).startsWith('http://127.0.0.1:'))return realFetch(input,opts);
    calls.push({url:String(input),method:opts.method||'GET'});
    assert.equal(opts.method||'GET','GET','a pré-validação não pode persistir dados');
    const u=new URL(input);assert.equal(u.origin,'https://supabase.invalid','nenhuma chamada ao ZapSign');
    if(u.pathname==='/auth/v1/user')return Response.json({id:'user-test',email:'sandbox@example.invalid'});
    if(u.pathname==='/rest/v1/cj_memberships')return Response.json([{workspace_id:'workspace-test',role}]);
    if(u.pathname==='/rest/v1/cj_state'){
      assert.equal(u.searchParams.get('workspace_id'),'eq.workspace-test');
      return Response.json([{revision:1,data:{},theme:{}}]);
    }
    throw new Error('Chamada inesperada');
  };
  await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
});
test.after(async()=>{global.fetch=realFetch;await new Promise(r=>server.close(r));});
function post(data,headers={}){return fetch(origin+'/api/contracts/preflight',{method:'POST',headers:{Origin:origin,Cookie:'cj_access=fake-session','Content-Type':'application/json',...headers},body:JSON.stringify(data)});}
const request={modalidade:'holding',tipo:'procuracao',values:{}};
test('pré-validação exige sessão, mesma origem e perfil autorizado no escritório',async()=>{
  assert.equal((await post(request,{Cookie:''})).status,401);
  assert.equal((await post(request,{Origin:'https://evil.invalid'})).status,403);
  for(const r of ['secretaria','financeiro','juridico']){role=r;assert.equal((await post(request)).status,403);}
  for(const r of ['gestor','especialista']){role=r;assert.equal((await post(request)).status,422);}
});
test('erros de entrada são controlados e não retornam valores nem links',async()=>{
  role='gestor';
  for(const data of [null,[],{modalidade:'nao-existe',tipo:'contrato'}])assert.equal((await post(data)).status,400);
  for(const value of [null,[],{}, {'NOME COMPLETO':'PRIVADO_NAO_ECOAR'}]){
    const r=await post({...request,values:value});assert.equal(r.status,422);
    const text=await r.text();assert.equal(text.includes('PRIVADO_NAO_ECOAR'),false);
    const d=JSON.parse(text);assert.equal(d.canCreateDocument,false);assert.equal(d.productionEnabled,false);
    assert.equal('sign_url' in d,false);assert.equal('values' in d,false);
  }
});
test('modelo completo retorna pré-validação sem criar documento, contratar cliente ou enviar assinatura',async()=>{
  const m=require('./zapsign-formularios.json')[2];
  const values=Object.fromEntries(m.variaveis.map(n=>[n,'Fictício']));
  Object.assign(values,{'CPF DO CLIENTE':'123.456.789-00','RENDA MENSAL':'R$ 1.000,00','DATA CONTRATO':'02/11/2026'});
  calls=[];const r=await post({modalidade:m.modalidade,tipo:m.tipo,values});assert.equal(r.status,200);
  const d=await r.json();assert.equal(d.ok,true);assert.equal(d.validationOnly,true);assert.equal(d.canCreateDocument,false);
  assert.deepEqual(calls.map(c=>c.method),['GET','GET','GET']);
  const forbidden=await fetch(origin+'/api/contracts/create',{method:'POST',headers:{Origin:origin,Cookie:'cj_access=fake-session'}});assert.equal(forbidden.status,404);
  for(const path of ['/zapsign-formularios.json','/zapsign-preflight.cjs','/docs/zapsign-source-audit.json'])assert.equal((await fetch(origin+path)).status,404);
});
