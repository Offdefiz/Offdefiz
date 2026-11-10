'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const L=require('./lib/legal-core.cjs');
test('14 áreas editáveis como sugestões, sem comportamento por ramo no motor',()=>{
 assert.equal(L.DEFAULT_AREAS.length,14);
 assert.equal(new Set(L.DEFAULT_AREAS.map(x=>x.code)).size,14);
 for(const area of L.DEFAULT_AREAS){
  assert.ok(area.name&&Array.isArray(area.stages)&&Array.isArray(area.fields));
  assert.ok(Array.isArray(area.templates)&&Array.isArray(area.classes)&&Array.isArray(area.subjects));
 }
 assert.ok(L.DEFAULT_AREAS.find(x=>x.code==='penal').fields.some(x=>x.key==='reu_preso'));
 assert.ok(L.DEFAULT_AREAS.find(x=>x.code==='trabalhista').fields.some(x=>x.key==='admissao'));
 assert.ok(L.DEFAULT_AREAS.find(x=>x.code==='tributario').fields.some(x=>x.key==='orgao'));
});
test('CPF: dígitos verificadores, máscara, repetição e tipo',()=>{
 assert.equal(L.cpfValid('529.982.247-25'),true);
 for(const invalid of ['529.982.247-26','111.111.111-11','123','',null])assert.equal(L.cpfValid(invalid),false);
});
test('CNPJ: formato numérico e alfanumérico válido desde 2026',()=>{
 assert.equal(L.cnpjValid('04.252.011/0001-10'),true);
 assert.equal(L.cnpjValid('12.ABC.345/01DE-35'),true);
 assert.equal(L.normalizedCnpj('12.abc.345/01de-35'),'12ABC34501DE35');
 for(const invalid of ['04.252.011/0001-11','12ABC34501DE34','00000000000000','A'.repeat(14)])assert.equal(L.cnpjValid(invalid),false);
});
test('CNJ: módulo 97/ISO 7064 na posição dos dígitos',()=>{
 const base='0000001'+'2026'+'8'+'13'+'0001';
 assert.equal(base.length,18);
 const raw=base.slice(0,7)+L.cnjDigits(base)+base.slice(7);
 assert.equal(L.cnjValid(raw),true);
 assert.equal(L.cnjValid(raw.slice(0,7)+'00'+raw.slice(9)),raw.slice(7,9)==='00');
 assert.equal(L.cnjValid('1234567-00.2026.8.13.0001'),false);
 assert.equal(L.cnjValid(''),false);
});
test('campos customizados por definição, sem seleção por área',()=>{
 const schema=[{key:'reu_preso',type:'boolean',required:true},{key:'admissao',type:'date'},{key:'salario_centavos',type:'money'},{key:'orgao',type:'select',options:['PGFN','CARF']}];
 const values={reu_preso:false,admissao:'2026-10-01',salario_centavos:12345,orgao:'CARF'};
 assert.deepEqual(L.validateCustomValues(schema,values),values);
 assert.throws(()=>L.validateCustomValues(schema,{...values,salario_centavos:1.1}),/centavos/);
 assert.throws(()=>L.validateCustomValues(schema,{...values,orgao:'Banco'}),/Opção/);
 assert.throws(()=>L.validateCustomValues(schema,{...values,desconhecido:'segredo'}),/não configurado/);
 assert.throws(()=>L.validateCustomValues(schema,{}),/obrigatório/);
});
test('andamento: chave idempotente considera escritório, processo, dia, descrição e TPU',()=>{
 const p={workspaceId:'a',processId:'proc',date:'2026-11-10',description:'Intimação   Publicada',tpuCode:'123'};
 assert.equal(L.movementFingerprint(p),L.movementFingerprint({...p,description:'intimacao publicada'}));
 assert.notEqual(L.movementFingerprint(p),L.movementFingerprint({...p,workspaceId:'b'}));
 assert.notEqual(L.movementFingerprint(p),L.movementFingerprint({...p,processId:'outro'}));
 assert.notEqual(L.movementFingerprint(p),L.movementFingerprint({...p,tpuCode:'124'}));
});
test('prazo útil, recesso parametrizado e feriado nacional versionado geram somente sugestão',()=>{
 const base={notificationDate:'2026-12-18',days:2,holidays:[{date:'2027-01-22',scope:'national'}],
   calendarVersion:'feriados-2027-v1',
   rule:{unit:'business',excludeStart:true,version:'civel-draft-1',suspensions:[{start:'12-20',end:'01-20'}]}};
 const result=L.deadlineSuggestion(base);
 assert.equal(result.suggestedDate,'2027-01-25');
 assert.equal(result.status,'pending_human_review');assert.equal(result.isFatal,false);
 assert.equal(result.holidayCalendarVersion,'feriados-2027-v1');
});
test('feriado local só afeta praça correspondente; dias corridos independem de fim de semana',()=>{
 const opts={notificationDate:'2026-11-10',days:2,
   holidays:[{date:'2026-11-11',scope:'city',state:'MG',city:'Belo Horizonte'}],
   rule:{unit:'business',excludeStart:true,version:'exemplo',suspensions:[]}};
 assert.equal(L.deadlineSuggestion({...opts,location:{state:'MG',city:'Belo Horizonte'}}).suggestedDate,'2026-11-13');
 assert.equal(L.deadlineSuggestion({...opts,location:{state:'MG',city:'Contagem'}}).suggestedDate,'2026-11-12');
 assert.equal(L.deadlineSuggestion({...opts,rule:{unit:'calendar',excludeStart:true,suspensions:[]}}).suggestedDate,'2026-11-12');
});
test('regra sem versão de homologação não equivale a prazo fatal',()=>{
 assert.throws(()=>L.deadlineSuggestion({notificationDate:'2026-02-31',days:2,holidays:[],rule:{unit:'business',excludeStart:true}}),/Data inválida/);
 assert.throws(()=>L.deadlineSuggestion({notificationDate:'2026-11-10',days:0,holidays:[],rule:{unit:'business',excludeStart:true}}),/Quantidade/);
 assert.ok(!L.may('financeiro','legalRead'));
 assert.ok(!L.may('secretaria','legalWrite'));
 assert.ok(L.may('advogado','legalWrite'));
});
