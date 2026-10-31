(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.CJInsights=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const DAY=/^\d{4}-\d{2}-\d{2}$/;
  const dateValue=s=>Date.parse(String(s)+'T12:00:00Z');
  function daysBetween(from,to){if(!DAY.test(from)||!DAY.test(to))return 0;return Math.round((dateValue(to)-dateValue(from))/86400000);}
  function daily(state,role,day){
    const visible=state.tasks.filter(t=>!t.done&&(role==='gestor'||t.owner===role));
    const active=new Map(state.opportunities.filter(o=>!['contratado','perdido'].includes(o.stage)).map(o=>[o.id,o]));
    const sorted=[...visible].sort((a,b)=>String(a.due).localeCompare(String(b.due)));
    const groups={must:[],leverage:[],upcoming:[]};
    for(const t of sorted){
      const o=t.oppId?active.get(t.oppId):null;
      if(t.kind==='escalation'||t.due<=day||(o&&o.escalated&&role==='gestor'))groups.must.push(t);
      else if(o&&['proposta','negociacao','fechamento','assinatura'].includes(o.stage))groups.leverage.push(t);
      else groups.upcoming.push(t);
    }
    return {...groups,total:visible.length,overdue:visible.filter(t=>t.due<day).length,asOf:day};
  }
  function financial(state,day){
    const open=state.installments.filter(i=>!i.paidAt);
    const overdue=open.filter(i=>i.due<day);
    const sum=items=>items.reduce((v,i)=>v+Number(i.amount||0),0);
    const age={oneToSeven:0,eightToThirty:0,overThirty:0};
    for(const i of overdue){
      const diff=daysBetween(i.due,day);
      if(diff<=7)age.oneToSeven+=i.amount;
      else if(diff<=30)age.eightToThirty+=i.amount;
      else age.overThirty+=i.amount;
    }
    const [year,month]=day.slice(0,7).split('-').map(Number);
    const forecast=Array.from({length:3},(_,n)=>{
      const d=new Date(Date.UTC(year,month-1+n,1));
      const key=d.toISOString().slice(0,7);
      return {month:key,amount:sum(open.filter(i=>String(i.due).slice(0,7)===key))};
    });
    return {age,forecast,overdueCount:overdue.length,overdueAmount:sum(overdue),openCount:open.length,openAmount:sum(open),asOf:day};
  }
  function compactDate(d){return String(d).replace(/-/g,'');}
  function calendarRange(meeting){
    if(!DAY.test(meeting.date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(meeting.time||''))throw Error('Data ou horário inválido.');
    const start=compactDate(meeting.date)+'T'+meeting.time.replace(':','')+'00';
    const dt=new Date(meeting.date+'T'+meeting.time+':00Z');
    dt.setUTCMinutes(dt.getUTCMinutes()+60);
    const end=dt.toISOString().replace(/[-:]/g,'').slice(0,15);
    return {start,end};
  }
  // Por privacidade, o evento externo não leva nome nem dados do cliente.
  function googleCalendarUrl(meeting){
    const {start,end}=calendarRange(meeting);
    const args=new URLSearchParams({action:'TEMPLATE',text:'Reunião do escritório',dates:start+'/'+end,ctz:'America/Sao_Paulo',details:'Evento adicionado manualmente pelo Caixa Jurídico. Confirme os dados antes de salvar.'});
    return 'https://calendar.google.com/calendar/render?'+args.toString();
  }
  function calendarIcs(meeting){
    const {start,end}=calendarRange(meeting);
    const uid='cj-'+String(meeting.id||'evento').replace(/[^a-z0-9_-]/gi,'')+'@caixa-juridico';
    const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
    return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Caixa Juridico//Agenda Manual//PT-BR','CALSCALE:GREGORIAN','BEGIN:VEVENT','UID:'+uid,'DTSTAMP:'+stamp,'DTSTART;TZID=America/Sao_Paulo:'+start,'DTEND;TZID=America/Sao_Paulo:'+end,'SUMMARY:Reunião do escritório','DESCRIPTION:Evento demonstrativo. Revise antes de importar.','END:VEVENT','END:VCALENDAR',''].join('\r\n');
  }
  return {daily,financial,googleCalendarUrl,calendarIcs,daysBetween};
});
