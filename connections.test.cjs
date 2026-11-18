'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {validateProfile,validateLinks,validateRequest,service,slugOk}=require('./ops/native/connections.cjs');
const {server}=require('./server.cjs');
const good={slug:'silva-advocacia',professional_name:'Marina Silva',oab_registration:'OAB/MG 123456',city:'Belo Horizonte',state:'MG',areas:['Cível','Família'],presentation:'Atuação em Belo Horizonte.',published:true,ethical_attestation:true};
test('perfil exige declaração para publicar e campos éticos objetivos',()=>{
 assert.equal(validateProfile(good).published,true);
 assert.throws(()=>validateProfile({...good,ethical_attestation:false}),/declaração/);
 assert.throws(()=>validateProfile({...good,slug:'../admin'}),/Revise/);
 assert.throws(()=>validateProfile({...good,areas:['Cível','Cível']}),/Revise/);
 assert.throws(()=>validateProfile({...good,oab_registration:'não informada'}),/Revise/);
 assert.ok(slugOk('silva-advocacia'));assert.equal(slugOk('---'),false);
});
test('cartão Linktree mantém botões ordenados, temas e bloqueia links inseguros',()=>{
 const buttons=[
  {type:'whatsapp',label:'WhatsApp',url:'https://wa.me/5531999999999'},
  {type:'instagram',label:'Instagram',url:'https://www.instagram.com/advogada'},
  {type:'site',label:'Site do escritório',url:'https://exemplo.com.br'},
  {type:'email',label:'E-mail',url:'mailto:contato@exemplo.com.br'}
 ];
 const card=validateProfile({...good,links:buttons,theme:'escuro'});
 assert.equal(card.links.length,4);assert.equal(card.theme,'escuro');
 assert.deepEqual(card.links.map(b=>b.type),['whatsapp','instagram','site','email']);
 assert.throws(()=>validateLinks([{type:'site',label:'Clique aqui',url:'javascript:alert(1)'}]),/inválido|seguros/);
 assert.throws(()=>validateLinks([{type:'site',label:'Clique aqui',url:'https://localhost/admin'}]),/seguros/);
 assert.throws(()=>validateLinks([{type:'whatsapp',label:'Contato',url:'https://evil.com/'}]),/corresponde/);
 assert.throws(()=>validateLinks(Array.from({length:9},()=>buttons[0])),/oito/);
 assert.throws(()=>validateProfile({...good,theme:'premium'}),/Revise/);
});
test('solicitação não aceita relato sensível, sem consentimento ou assunto arbitrário',()=>{
 assert.deepEqual(validateRequest({name:'Ana Lima',email:'ANA@example.com',subject:'Cível',consent:true}),{name:'Ana Lima',email:'ana@example.com',phone:'',subject:'Cível'});
 assert.throws(()=>validateRequest({name:'Ana Lima',email:'ana@example.com',subject:'Cível',consent:false}),/autorize/);
 assert.throws(()=>validateRequest({name:'Ana Lima',email:'ana@example.com',subject:'Urgente',consent:true}),/assunto/);
 assert.equal(validateRequest({website:'spam'}),null);
});
test('consultas de perfil, inbox e status são vinculadas ao workspace',async()=>{
 const calls=[];
 const db={query:async(sql,params)=>{calls.push({sql,params});return {rows:[],rowCount:0};}};
 const s=service(db),workspace='9ee37925-7c78-40c5-b514-2c0f65c46f52';
 await s.ownProfile(workspace);await s.inbox(workspace);
 assert.deepEqual(calls.map(c=>c.params[0]),[workspace,workspace]);
 assert.match(calls[1].sql,/WHERE workspace_id=\$1/);
 await assert.rejects(s.setStatus(workspace,{id:'ee2fa32d-ae8a-4f4d-86f4-095c96c9021d',status:'contacted'}),/não encontrada/);
 assert.deepEqual(calls[2].params.slice(0,2),[workspace,'ee2fa32d-ae8a-4f4d-86f4-095c96c9021d']);
});
test('pedido público só é criado para perfil publicado',async()=>{
 const calls=[];
 const db={query:async(sql,params)=>{calls.push({sql,params});return {rows:[],rowCount:0};}};
 await assert.rejects(service(db).request('silva-advocacia',{name:'Ana Lima',email:'ana@example.com',subject:'Família',consent:true}),/não está disponível/);
 assert.match(calls[0].sql,/published=true/);
 assert.equal(calls[0].params[0],'silva-advocacia');
});
let origin;
test.before(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;});
test.after(()=>server.close());
test('landing divulga cartão profissional e páginas não são indexáveis',async()=>{
 const html=await(await fetch(origin+'/')).text();
 assert.match(html,/id="conexoes"/);assert.match(html,/Entrar para criar meu cartão/);
 assert.match(html,/coloque na bio/i);assert.match(html,/até oito links/i);
 const page=await fetch(origin+'/adv/silva-advocacia');
 assert.equal(page.status,200);assert.match(page.headers.get('x-robots-tag'),/noindex/);
 const publicHtml=await page.text();assert.match(publicHtml,/informações deste perfil são declaradas pelo profissional/);assert.match(publicHtml,/public-links/);assert.match(publicHtml,/download-vcard/);
 assert.equal((await fetch(origin+'/connections.js')).status,200);
 assert.equal((await fetch(origin+'/vendor/qrcode.min.js')).status,200);
 assert.equal((await fetch(origin+'/connections.css')).status,200);
 const editor=await fetch(origin+'/conexoes');assert.equal(editor.status,401);
});
test('solicitações não ficam abertas sem banco e origem confiável',async()=>{
 const r=await fetch(origin+'/api/public/conexoes/silva-advocacia/solicitacoes',{method:'POST',headers:{Origin:'https://terceiro.example','Content-Type':'application/json'},body:'{}'});
 assert.equal(r.status,403);
 assert.equal((await fetch(origin+'/api/public/conexoes/silva-advocacia')).status,503);
 assert.equal((await fetch(origin+'/conexoes')).status,401);
});
