(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Caixa = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const roles = {gestor:'Gestor',secretaria:'SDR / secretaria',especialista:'Especialista',juridico:'Jurídico',financeiro:'Financeiro'};
  const stages = {triagem:'Lead novo',agendamento:'Agendado',diagnostico:'Diagnóstico realizado',proposta:'Proposta',negociacao:'Negociação',fechamento:'Fechamento agendado',assinatura:'Aguardando assinatura',nutricao:'Nutrição / recall',contratado:'Ganho / contratado',perdido:'Perdido'};
  const rights = {
    client:['gestor','secretaria','especialista'], debt:['gestor','secretaria','especialista'],
    stage:['gestor','secretaria','especialista'], meeting:['gestor','secretaria','especialista'],
    proposal:['gestor','especialista'], contract:['gestor','especialista'], payment:['gestor','financeiro'], followup:['gestor','secretaria','especialista'],
    legal:['gestor','juridico'], task:['gestor','secretaria','especialista','juridico','financeiro']
  };
  function assert(value,message) { if (!value) throw new Error(message); }
  function can(role,action) { return (rights[action] || []).includes(role); }
  function required(value,label) { const s=String(value || '').trim(); assert(s && s.length<=1000,label+' é obrigatório e deve ter até 1.000 caracteres.'); return s; }
  function date(value) { assert(/^\d{4}-\d{2}-\d{2}$/.test(value || ''),'Informe uma data válida.'); const d=new Date(value+'T12:00:00Z'); assert(!isNaN(d) && d.toISOString().slice(0,10)===value,'Informe uma data válida.'); return value; }
  function today() { const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()); return ['year','month','day'].map(k=>p.find(v=>v.type===k).value).join('-'); }
  function shift(day,days) { const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10); }
  function month(day,n) { date(day);const d=new Date(day+'T12:00:00Z'),v=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+n);const end=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(v,end));return d.toISOString().slice(0,10); }
  function cents(value) { const v=Number(value);assert(Number.isFinite(v) && v>=0.01 && v<=100000000,'Informe um valor de pelo menos R$ 0,01 e até R$ 100 milhões.');return Math.round(v*100); }
  function money(n) { return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100); }
  function uid(prefix) { return prefix+'_'+(typeof crypto!=='undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)+Math.random().toString(36).slice(2)); }
  function get(list,id) { const value=list.find(x=>x.id===id);assert(value,'Registro não encontrado.');return value; }
  function latest(state,oppId) { return state.proposals.filter(p=>p.oppId===oppId).sort((a,b)=>b.version-a.version)[0]; }
  function proposalTerms(p) {
    const down=Number(p.down),count=Number(p.count),unit=Number(p.unit),rate=Number(p.successPercent);
    assert(Number.isFinite(down)&&down>=0&&down<=100000000,'Entrada inválida.');
    assert(Number.isInteger(count)&&count>=0&&count<=36,'Informe de zero a 36 parcelas.');
    assert(Number.isFinite(unit)&&unit>=0&&unit<=100000000,'Valor da parcela inválido.');
    assert(count===0?unit===0:unit>=0.01,'Sem parcelas, use valor zero; com parcelas, informe pelo menos R$ 0,01.');
    assert(Number.isFinite(rate)&&rate>=0&&rate<=100,'Percentual de êxito inválido.');
    const t={down:Math.round(down*100),count,unit:Math.round(unit*100),successPercent:rate,successBase:required(p.successBase,'Base do êxito')};
    assert(rate===0||t.successBase!=='Não previsto','Defina a base do êxito para um percentual positivo.');
    assert(t.down+t.count*t.unit>=1&&t.down+t.count*t.unit<=10000000000,'Total fixo inválido.');return t;
  }
  function execute(state,role,action,data,day) {
    day=date(day || today());assert(can(role,action),'Este perfil não pode executar essa ação.');
    const s=JSON.parse(JSON.stringify(state)),p=data || {};let result,description='';
    const opportunity=id=>get(s.opportunities,id);
    if(action==='client') {
      const c={id:uid('cli'),name:required(p.name,'Nome fictício'),source:required(p.source,'Origem'),created:day};s.clients.push(c);
      const o={id:uid('opp'),clientId:c.id,area:required(p.area,'Área'),owner:required(p.owner,'Responsável'),stage:'triagem',next:required(p.next,'Próxima ação'),due:date(p.due),created:day};
      assert(roles[o.owner],'Responsável inválido.');s.opportunities.push(o);
      s.tasks.push({id:uid('task'),oppId:o.id,kind:'followup',title:o.next,owner:o.owner,due:o.due,done:false,created:day});result=o;description='Atendimento criado com próxima ação e responsável';
    } else if(action==='debt') {
      const o=opportunity(p.oppId);result={id:uid('deb'),clientId:o.clientId,creditor:required(p.creditor,'Credor'),kind:required(p.kind,'Modalidade'),amount:cents(p.amount),situation:required(p.situation,'Situação'),created:day};s.debts.push(result);description='Dívida registrada para diagnóstico';
    } else if(action==='stage') {
      const o=opportunity(p.oppId);assert(!['contratado','perdido'].includes(o.stage),'Atendimento encerrado não pode ser movido.');
      assert(['triagem','agendamento','diagnostico','perdido'].includes(p.stage),'Proposta, fechamento e contrato avançam pelo fluxo correspondente.');
      if(p.stage==='perdido') {assert(!s.proposals.some(x=>x.oppId===o.id && x.status==='aceita'),'Há uma proposta aceita; resolva a contratação antes de encerrar.');o.reason=required(p.reason,'Motivo do encerramento');s.tasks.filter(t=>t.oppId===o.id&&!t.done).forEach(t=>{t.done=true;t.closedReason='Atendimento encerrado';});s.meetings.filter(m=>m.oppId===o.id&&['agendada','confirmada'].includes(m.status)).forEach(m=>m.status='cancelada');s.proposals.filter(x=>x.oppId===o.id && ['rascunho','apresentada'].includes(x.status)).forEach(x=>x.status='retirada');}
      else { assert(!latest(s,o.id),'Após criar proposta, acompanhe pelo módulo Propostas.');o.next=required(p.next,'Próxima ação');o.due=date(p.due); }
      o.stage=p.stage;result=o;description='Etapa atualizada: '+stages[p.stage];
    } else if(action==='followup') {
      const o=opportunity(p.oppId);assert(!['contratado','perdido'].includes(o.stage),'Atendimento encerrado.');
      assert(['sim','nao','objecao','data','sem_resposta'].includes(p.outcome),'Informe o resultado do contato.');
      assert(roles[p.owner],'Responsável inválido.');
      const desired=p.stage||o.stage,pr=latest(s,o.id);
      assert(Object.hasOwn(stages,desired)&&!['contratado','perdido'].includes(desired),'Use o fluxo de contrato ou encerramento.');
      if(desired!==o.stage){
        assert(['triagem','agendamento','diagnostico','negociacao','fechamento','nutricao'].includes(desired),'A etapa segue o fluxo da proposta.');
        if(desired==='negociacao')assert(pr&&pr.status==='apresentada','Apresente uma proposta antes de negociar.');
        if(desired==='fechamento')assert(s.meetings.some(m=>m.oppId===o.id&&m.subject==='Fechamento'&&['agendada','confirmada'].includes(m.status)),'Agende uma reunião de fechamento.');
        assert(!pr||!['triagem','agendamento','diagnostico'].includes(desired),'A proposta já iniciou; acompanhe a negociação.');
        assert(!pr||pr.status!=='aceita','A proposta aceita segue para assinatura.');
      }
      o.next=required(p.next,'Próxima ação');o.due=date(p.due);o.owner=p.owner;o.stage=desired;
      o.unanswered=p.outcome==='sem_resposta'?(o.unanswered||0)+1:0;o.escalated=o.unanswered>=2;if(p.outcome==='sem_resposta'&&o.unanswered>=3){o.recallRecommendation='Avaliar pausa, novo canal ou encerramento fundamentado';}else if(p.outcome!=='sem_resposta'){o.recallRecommendation=null;}
      const entry={id:uid('ret'),outcome:p.outcome,note:required(p.note,'Registro do contato'),at:day,next:o.next,due:o.due,owner:o.owner};
      o.contacts=o.contacts||[];o.contacts.push(entry);if(p.outcome==='sem_resposta'&&o.unanswered===2){const exists=s.tasks.some(t=>t.oppId===o.id&&!t.done&&t.kind==='escalation');if(!exists)s.tasks.push({id:uid('task'),oppId:o.id,kind:'escalation',title:'Gestor: revisar negociação sem resposta e definir estratégia',owner:'gestor',due:day,done:false,created:day});}if(p.outcome!=='sem_resposta'){s.tasks.filter(t=>t.oppId===o.id&&!t.done&&t.kind==='escalation').forEach(t=>{t.done=true;t.closedReason='Cliente respondeu';});}result=o;description='Retorno registrado: '+p.outcome+(o.escalated?' · requer atenção do gestor':'');
    } else if(action==='meeting') {
      if(p.id && p.operation==='reschedule') {
        const m=get(s.meetings,p.id);assert(['agendada','confirmada','nao_compareceu'].includes(m.status),'Esta reunião não pode ser reagendada.');
        const o=opportunity(m.oppId);assert(!['contratado','perdido'].includes(o.stage),'Atendimento encerrado.');
        const d=date(p.date);assert(/^([01]\d|2[0-3]):[0-5]\d$/.test(p.time||''),'Informe um horário válido.');
        assert(m.date!==d||m.time!==p.time,'Escolha outra data ou horário.');
        assert(!s.meetings.some(x=>x.id!==m.id&&x.owner===m.owner&&x.date===d&&x.time===p.time&&['agendada','confirmada'].includes(x.status)),'Já existe reunião para esse responsável no mesmo horário.');
        m.status='reagendada';result=Object.assign({},m,{id:uid('meet'),date:d,time:p.time,status:'agendada',previousId:m.id});s.meetings.push(result);
        if(o.stage==='agendamento'){o.next='Confirmar reunião reagendada';o.due=d;}description='Reunião reagendada com histórico preservado';
      } else if(p.id) {
        const m=get(s.meetings,p.id);assert(['confirmada','realizada','nao_compareceu','cancelada'].includes(p.status),'Status de reunião inválido.');assert(['agendada','confirmada'].includes(m.status),'Esta reunião já foi encerrada.');assert(!(m.status==='confirmada' && p.status==='confirmada'),'A reunião já está confirmada.');m.status=p.status;
        if(p.status==='realizada') {const o=opportunity(m.oppId);if(['triagem','agendamento'].includes(o.stage)){o.stage='diagnostico';o.next='Concluir diagnóstico e preparar proposta';o.due=day;}}result=m;description='Reunião: '+p.status;
      } else {
        const o=opportunity(p.oppId);assert(!['contratado','perdido'].includes(o.stage),'Atendimento encerrado.');const d=date(p.date);assert(/^([01]\d|2[0-3]):[0-5]\d$/.test(p.time || ''),'Informe um horário válido.');
        assert(!s.meetings.some(m=>m.date===d&&m.time===p.time&&m.owner===p.owner&&['agendada','confirmada'].includes(m.status)),'Já existe reunião para esse responsável no mesmo horário.');assert(roles[p.owner],'Responsável inválido.');
        result={id:uid('meet'),oppId:o.id,date:d,time:p.time,owner:p.owner,subject:required(p.subject,'Assunto'),status:'agendada'};s.meetings.push(result);if(o.stage==='triagem'){o.stage='agendamento';o.next='Confirmar reunião de diagnóstico';o.due=d;}if(p.subject==='Fechamento'&&latest(s,o.id)?.status==='apresentada'){o.stage='fechamento';o.next='Realizar reunião de fechamento';o.due=d;}description='Reunião agendada';
      }
    } else if(action==='proposal') {
      const o=opportunity(p.oppId);assert(!['contratado','perdido'].includes(o.stage),'Atendimento encerrado.');const prev=latest(s,o.id);
      if(p.operation==='send' || p.operation==='accept') {
        assert(prev && prev.id===p.id,'Só a versão atual pode ser apresentada ou aceita.');
        if(p.operation==='send') {assert(prev.status==='rascunho','A proposta precisa estar em rascunho.');assert(prev.validUntil>=day,'A proposta está vencida.');prev.status='apresentada';prev.sent=day;o.next='Retornar sobre proposta v'+prev.version;o.due=shift(day,2);description='Apresentação da proposta registrada manualmente';}
        else {assert(prev.status==='apresentada','Registre a apresentação antes do aceite.');assert(prev.validUntil>=day,'A proposta está vencida; crie uma nova versão.');prev.status='aceita';prev.accepted=day;o.stage='assinatura';o.next='Formalizar contrato e condições de pagamento';o.due=day;description='Aceite da proposta registrado manualmente';}result=prev;
      } else {
        assert(!prev || prev.status!=='aceita','A versão aceita já segue para contratação.');const valid=date(p.validUntil);assert(valid>=day,'A validade não pode estar no passado.');
        const terms=p.down!==undefined?proposalTerms(p):null;
        result={id:uid('prop'),oppId:o.id,version:prev?prev.version+1:1,scope:required(p.scope,'Escopo'),amount:terms?terms.down+terms.count*terms.unit:cents(p.amount),terms,validUntil:valid,status:'rascunho',created:day};
        if(prev)prev.status='substituida';s.proposals.push(result);o.stage='proposta';o.next='Apresentar proposta v'+result.version;o.due=day;description='Proposta v'+result.version+' criada; versões anteriores preservadas';
      }
    } else if(action==='contract') {
      const o=opportunity(p.oppId),pr=latest(s,o.id);assert(pr && pr.status==='aceita','A contratação exige uma proposta aceita.');assert(!s.contracts.some(c=>c.oppId===o.id),'Já existe contrato para este atendimento.');assert(p.signed===true,'Confirme o registro manual da assinatura.');
      if(pr.terms){assert(p.down===undefined||Math.round(Number(p.down)*100)===pr.terms.down,'A entrada deve corresponder à proposta aceita.');assert(p.count===undefined||Number(p.count)===pr.terms.count,'As parcelas devem corresponder à proposta aceita.');}
      const raw=pr.terms?pr.terms.down/100:Number(p.down || 0);assert(Number.isFinite(raw)&&raw>=0,'Entrada inválida.');const down=Math.round(raw*100);assert(down<=pr.amount,'A entrada não pode superar os honorários.');const remaining=pr.amount-down,count=remaining>0?(pr.terms?pr.terms.count:Number(p.count)):0;
      assert(!remaining || (Number.isInteger(count)&&count>=1&&count<=36&&count<=remaining),'Informe entre 1 e 36 parcelas, com valor de pelo menos um centavo.');const first=date(p.firstDue),signedAt=date(p.signedAt || day);assert(signedAt<=day,'A assinatura não pode estar no futuro.');
      const c={id:uid('ctr'),oppId:o.id,proposalId:pr.id,amount:pr.amount,scope:pr.scope,terms:pr.terms||null,signedAt,created:day};s.contracts.push(c);let schedule=[];
      if(down)schedule.push({amount:down,due:first,label:'Entrada'});
      for(let i=0;i<count;i++)schedule.push({amount:Math.floor(remaining/count)+(i<remaining%count?1:0),due:month(first,i+(down?1:0)),label:'Parcela '+(i+1)+'/'+count});
      schedule.forEach(x=>s.installments.push(Object.assign({id:uid('par'),contractId:c.id,paidAt:null},x)));
      o.stage='contratado';o.next='Realizar kick-off e conferir documentos';o.due=day;
      s.tasks.filter(t=>t.oppId===o.id&&!t.done&&['secretaria','especialista'].includes(t.owner)).forEach(t=>{t.done=true;t.closedReason='Contratação registrada';});
      s.tasks.push({id:uid('task'),oppId:o.id,title:'Kick-off: conferir documentos e definir atuação',owner:'juridico',due:shift(day,1),done:false,created:day});
      s.tasks.push({id:uid('task'),oppId:o.id,title:'Conferir entrada e condições de recebimento',owner:'financeiro',due:first,done:false,created:day});
      s.cases.push({id:uid('cas'),oppId:o.id,contractId:c.id,status:'Kick-off',owner:'juridico',created:day});result=c;description='Contrato registrado; parcelas, caso e tarefas criados';
    } else if(action==='payment') {
      const i=get(s.installments,p.id);
      if(p.operation==='undo') {assert(i.paidAt,'Esta parcela ainda não está recebida.');i.reversalReason=required(p.reason,'Motivo do estorno');i.paidAt=null;description='Recebimento estornado: '+i.reversalReason;}
      else {assert(!i.paidAt,'Recebimento já confirmado.');const paidAt=date(p.paidAt);assert(paidAt<=day,'Recebimento não pode estar no futuro.');i.paidAt=paidAt;description='Recebimento integral confirmado manualmente';}result=i;
    } else if(action==='legal') {const c=get(s.cases,p.id);assert(['Kick-off','Documentação pendente','Em análise','Em execução','Concluído'].includes(p.status),'Etapa jurídica inválida.');c.status=p.status;result=c;description='Acompanhamento jurídico: '+p.status;
    } else if(action==='task') {
      if(p.id) {const t=get(s.tasks,p.id);assert(role==='gestor'||t.owner===role,'Conclua apenas tarefas do seu perfil.');assert(!t.done,'Tarefa já concluída.');t.done=true;t.completedAt=day;result=t;description='Tarefa concluída';}
      else {if(p.oppId)opportunity(p.oppId);assert(roles[p.owner],'Responsável inválido.');assert(role==='gestor'||p.owner===role,'Atribua tarefas ao seu perfil.');result={id:uid('task'),oppId:p.oppId || null,title:required(p.title,'Tarefa'),owner:p.owner,due:date(p.due),done:false,created:day};s.tasks.push(result);description='Tarefa criada';}
    }
    assert(result,'Ação inválida.');
    if(['stage','meeting','proposal','followup'].includes(action)){const o=opportunity(result.oppId||result.id);if(!['contratado','perdido'].includes(o.stage)){const t=s.tasks.find(t=>t.oppId===o.id&&t.kind==='followup'&&!t.done);if(t){t.title=o.next;t.due=o.due;t.owner=o.owner;}else s.tasks.push({id:uid('task'),oppId:o.id,kind:'followup',title:o.next,owner:o.owner,due:o.due,done:false,created:day});}}
    s.audit.unshift({id:uid('log'),role,action,description,targetId:result.id,at:new Date().toISOString()});s.updatedAt=new Date().toISOString();return {state:s,result};
  }
  function metrics(s,day) {
    day=day || today();const current=day.slice(0,7),open=s.installments.filter(i=>!i.paidAt);
    const proposals=s.opportunities.filter(o=>!['contratado','perdido'].includes(o.stage)).map(o=>latest(s,o.id)).filter(p=>p&&['rascunho','apresentada','aceita'].includes(p.status));
    const total=list=>list.reduce((n,x)=>n+x.amount,0);
    return {negotiating:total(proposals),contracted:total(s.contracts.filter(c=>c.signedAt.slice(0,7)===current)),received:total(s.installments.filter(i=>i.paidAt&&i.paidAt.slice(0,7)===current)),receivable:total(open),overdue:total(open.filter(i=>i.due<day)),dueSoon:total(open.filter(i=>i.due>=day && i.due<=shift(day,7)))};
  }
  function seed(day) {
    day=day || today();let s={schema:1,clients:[],debts:[],opportunities:[],meetings:[],proposals:[],contracts:[],installments:[],cases:[],tasks:[],audit:[]};
    const names=['Marina Exemplo','Rafael Exemplo','Camila Exemplo','Paulo Exemplo','Helena Exemplo','Lucas Exemplo','Sofia Exemplo','Bruno Exemplo'];
    names.forEach((name,i)=>{const r=execute(s,'gestor','client',{name,source:['Indicação','Site do escritório','Contato espontâneo'][i%3],area:i%3===0?'Superendividamento':'Passivo bancário',owner:i%2?'especialista':'secretaria',next:['Confirmar interesse e organizar diagnóstico','Conferir documentos para atendimento','Retornar sobre condições da proposta'][i%3],due:shift(day,i%3-1)},day);s=r.state;const id=r.result.id;
      s=execute(s,'gestor','debt',{oppId:id,creditor:'Banco Exemplo '+String.fromCharCode(65+i%3),kind:['Empréstimo pessoal','Financiamento de veículo','Cartão de crédito'][i%3],amount:18000+i*8750,situation:i%2?'Em atraso':'Em dia'},day).state;
      if(i===0||i===2||i===3){s=execute(s,'gestor','meeting',{oppId:id,date:shift(day,i===2?1:0),time:i===0?'10:30':i===2?'14:00':'16:30',owner:'especialista',subject:'Diagnóstico do passivo bancário'},day).state;}
      if([1,4,5,6].includes(i)){s=execute(s,'gestor','proposal',{oppId:id,scope:'Análise documental e acompanhamento da negociação bancária. Atuação judicial depende de avaliação e contratação específica.',amount:[0,3200,0,0,4500,2700,3600][i],validUntil:shift(day,7)},day).state;let pr=latest(s,id);s=execute(s,'gestor','proposal',{oppId:id,id:pr.id,operation:'send'},day).state;
        if(i===5||i===6){s=execute(s,'gestor','proposal',{oppId:id,id:pr.id,operation:'accept'},day).state;s=execute(s,'gestor','contract',{oppId:id,signed:true,signedAt:shift(day,-3),down:900,count:3,firstDue:shift(day,-2)},day).state;
          if(i===6){const c=s.contracts.find(c=>c.oppId===id),ins=s.installments.find(x=>x.contractId===c.id);s=execute(s,'gestor','payment',{id:ins.id,paidAt:shift(day,-1)},day).state;}
        }
      }
      if(i===7)s=execute(s,'gestor','stage',{oppId:id,stage:'diagnostico',next:'Concluir análise e definir escopo',due:day},day).state;
    });return s;
  }
  function meetingOverdue(m, now = new Date()) {
    if (!['agendada','confirmada'].includes(m.status)) return false;
    const scheduled = new Date(m.date+'T'+m.time+':00-03:00').getTime();
    return Number.isFinite(scheduled) && scheduled < new Date(now).getTime();
  }
  function validate(s) {assert(s&&s.schema===1,'Formato de dados incompatível.');['clients','debts','opportunities','meetings','proposals','contracts','installments','cases','tasks','audit'].forEach(k=>assert(Array.isArray(s[k]),'Dados incompletos: '+k));return s;}
  return {meetingOverdue,roles,stages,can,today,shift,month,cents,money,latest,execute,metrics,seed,validate};
});

