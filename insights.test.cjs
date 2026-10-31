const test=require('node:test');
const assert=require('node:assert/strict');
const I=require('./insights.js');
const day='2026-10-31';
test('Meu Dia prioriza vencidos, escalonamentos e oportunidades relevantes sem duplicar tarefas',()=>{
  const state={
    opportunities:[{id:'o1',stage:'negociacao'},{id:'o2',stage:'triagem'}],
    tasks:[
      {id:'a',owner:'secretaria',oppId:'o2',due:'2026-10-30',done:false},
      {id:'b',owner:'secretaria',oppId:'o1',due:'2026-11-03',done:false},
      {id:'c',owner:'secretaria',oppId:'o2',due:'2026-11-06',done:false},
      {id:'d',owner:'gestor',oppId:'o1',due:'2026-11-05',kind:'escalation',done:false},
      {id:'e',owner:'secretaria',oppId:'o2',due:'2026-10-29',done:true}
    ]
  };
  const secretary=I.daily(state,'secretaria',day);
  assert.deepEqual(secretary.must.map(t=>t.id),['a']);
  assert.deepEqual(secretary.leverage.map(t=>t.id),['b']);
  assert.deepEqual(secretary.upcoming.map(t=>t.id),['c']);
  assert.equal(secretary.total,3);
  assert.equal(secretary.overdue,1);
  assert.ok(I.daily(state,'gestor',day).must.some(t=>t.id==='d'));
});
test('Financeiro separa vencidos por faixa e parcelas futuras sem confundir recebidos',()=>{
  const state={installments:[
    {amount:10000,due:'2026-10-30',paidAt:null},
    {amount:20000,due:'2026-10-15',paidAt:null},
    {amount:30000,due:'2026-09-15',paidAt:null},
    {amount:40000,due:'2026-11-10',paidAt:null},
    {amount:80000,due:'2026-10-02',paidAt:'2026-10-03'}
  ]};
  const f=I.financial(state,day);
  assert.deepEqual(f.age,{oneToSeven:10000,eightToThirty:20000,overThirty:30000});
  assert.equal(f.overdueAmount,60000);
  assert.equal(f.openAmount,100000);
  assert.deepEqual(f.forecast.map(x=>x.amount),[30000,40000,0]);
});
test('Exportação de agenda é explícita, sem enviar dados pessoais e com horário consistente',()=>{
  const event={id:'meet_123',date:'2026-10-31',time:'23:30',subject:'Assunto sigiloso',clientName:'Pessoa identificável'};
  const link=I.googleCalendarUrl(event);
  assert.match(link,/calendar.google.com\/calendar\/render/);
  assert.ok(!link.includes('Pessoa'));
  assert.ok(!link.includes('sigiloso'));
  const u=new URL(link);
  assert.equal(u.searchParams.get('dates'),'20261031T233000/20261101T003000');
  const ics=I.calendarIcs(event);
  assert.match(ics,/DTSTART;TZID=America\/Sao_Paulo:20261031T233000/);
  assert.match(ics,/DTEND;TZID=America\/Sao_Paulo:20261101T003000/);
  assert.ok(!ics.includes('Pessoa'));
  assert.throws(()=>I.calendarIcs({date:'tomorrow',time:'x'}));
});
