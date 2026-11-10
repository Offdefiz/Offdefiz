'use strict';
// Núcleo puro: nenhuma consulta externa e nenhuma regra específica de área no código.
// Configurações iniciais são sugestões editáveis de cada escritório.
const {createHash}=require('node:crypto');
const area=(code,name,stages=[],fields=[],classes=[],subjects=[])=>({
  code,name,stages,fields,classes,subjects,templates:[]
});
const f=(key,label,type='text',extra={})=>({key,label,type,...extra});
const DEFAULT_AREAS=Object.freeze([
  area('bancario','Bancário',['Análise inicial','Administrativo','Conhecimento','Recurso','Cumprimento','Encerrado'],[
    f('instituicao','Instituição financeira'),f('contrato','Contrato'),f('tipo_divida','Tipo de dívida'),
    f('taxa_contratada','Taxa contratada','decimal')]),
  area('civel','Cível',['Inicial','Contestação','Saneamento','Instrução','Sentença','Recurso','Cumprimento','Encerrado']),
  area('penal','Penal',['Inquérito','Denúncia','Instrução','Pronúncia','Júri','Recurso','Execução penal'],[
    f('tipo_penal','Tipo penal'),f('delegacia','Delegacia'),f('inquerito','Inquérito'),
    f('vara_criminal','Vara criminal'),f('reu_preso','Réu preso','boolean')]),
  area('trabalhista','Trabalhista',['Inicial','Audiência inicial ou una','Instrução','Sentença','Recurso','Liquidação','Execução','Cumprimento'],[
    f('reclamante','Reclamante'),f('reclamada','Reclamada'),
    f('admissao','Admissão','date'),f('demissao','Demissão','date'),
    f('salario_centavos','Salário (centavos)','money'),
    f('verbas_pleiteadas','Verbas pleiteadas','textarea')]),
  area('tributario','Tributário',['Administrativo','Impugnação','CARF','Judicial','Execução fiscal','Parcelamento'],[
    f('tributo','Tributo'),f('periodo_apuracao','Período de apuração'),
    f('auto_infracao','Auto de infração'),
    f('orgao','Órgão','select',{options:['Receita Federal','PGFN','CARF','Fazenda Municipal','Fazenda Estadual','Outro']})]),
  area('previdenciario','Previdenciário',['Requerimento','Recurso administrativo','Judicial','Recurso','Implantação','Encerrado']),
  area('familia_sucessoes','Família e Sucessões',['Atendimento','Consensual','Judicial','Instrução','Sentença','Cumprimento','Encerrado']),
  area('empresarial_societario','Empresarial e Societário',['Consultivo','Negociação','Procedimento','Contencioso','Recurso','Encerrado']),
  area('administrativo','Administrativo',['Requerimento','Defesa','Recurso administrativo','Judicial','Encerrado']),
  area('consumidor','Consumidor',['Reclamação','Negociação','Inicial','Instrução','Sentença','Cumprimento']),
  area('imobiliario','Imobiliário',['Extrajudicial','Inicial','Instrução','Sentença','Cumprimento','Encerrado']),
  area('ambiental','Ambiental',['Fiscalização','Defesa administrativa','Recurso','Judicial','Encerrado']),
  area('digital_dados','Digital e Proteção de Dados',['Diagnóstico','Adequação','Administrativo','Contencioso','Encerrado']),
  area('outra','Outra',['Recebido','Em andamento','Concluído'])
]);
const digits=value=>String(value||'').replace(/\D/g,'');
function cpfValid(raw){
  const n=digits(raw);
  if(n.length!==11||/^(\d)\1{10}$/.test(n))return false;
  const calc=len=>{const sum=Array.from(n.slice(0,len),(x,i)=>Number(x)*(len+1-i)).reduce((a,b)=>a+b,0);const mod=(sum*10)%11;return mod===10?0:mod;};
  return calc(9)===Number(n[9])&&calc(10)===Number(n[10]);
}
function normalizedCnpj(raw){return String(raw||'').replace(/[^a-zA-Z0-9]/g,'').toUpperCase();}
function cnpjValid(raw){
  const n=normalizedCnpj(raw);
  if(!/^[A-Z0-9]{12}[0-9]{2}$/.test(n)||/^(.)\1{13}$/.test(n))return false;
  const value=c=>c.charCodeAt(0)-48;
  const digit=(base,weights)=>{
    const total=Array.from(base,(x,i)=>value(x)*weights[i]).reduce((a,b)=>a+b,0);
    const rem=total%11;return rem<2?0:11-rem;
  };
  const first=digit(n.slice(0,12),[5,4,3,2,9,8,7,6,5,4,3,2]);
  const second=digit(n.slice(0,12)+first,[6,5,4,3,2,9,8,7,6,5,4,3,2]);
  return n.slice(12)===String(first)+String(second);
}
function mod97(value){
  let rem=0;
  for(const char of value)rem=(rem*10+Number(char))%97;
  return rem;
}
function cnjDigits(base){
  if(!/^\d{18}$/.test(base))throw Error('Base CNJ deve conter 18 dígitos.');
  return String(98-mod97(base+'00')).padStart(2,'0');
}
function cnjValid(raw){
  const n=digits(raw);
  if(n.length!==20)return false;
  const base=n.slice(0,7)+n.slice(9);
  return n.slice(7,9)===cnjDigits(base);
}
function isoDate(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('Data inválida.');
  const d=new Date(value+'T12:00:00Z');
  if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==value)throw Error('Data inválida.');
  return value;
}
function addDays(value,amount){
  const d=new Date(isoDate(value)+'T12:00:00Z');
  d.setUTCDate(d.getUTCDate()+amount);
  return d.toISOString().slice(0,10);
}
function inSuspension(day,span){
  if(span.startDate&&span.endDate)return day>=span.startDate&&day<=span.endDate;
  if(!/^\d{2}-\d{2}$/.test(span.start||'')||!/^\d{2}-\d{2}$/.test(span.end||''))throw Error('Suspensão inválida.');
  const md=day.slice(5);
  return span.start<=span.end?md>=span.start&&md<=span.end:md>=span.start||md<=span.end;
}
function holidayApplies(holiday,day,location){
  if(!holiday||holiday.date!==day)return false;
  if(holiday.scope==='state')return Boolean(location?.state)&&location.state===holiday.state;
  if(holiday.scope==='city')return Boolean(location?.state&&location?.city)&&location.state===holiday.state&&location.city===holiday.city;
  return holiday.scope==='national';
}
function deadlineSuggestion(input){
  const rule=input.rule||{},days=input.days;
  if(!Number.isInteger(days)||days<1||days>3650)throw Error('Quantidade de dias inválida.');
  if(!['business','calendar'].includes(rule.unit)||typeof rule.excludeStart!=='boolean')throw Error('Regra de contagem incompleta.');
  if(!Array.isArray(input.holidays)||!Array.isArray(rule.suspensions||[]))throw Error('Calendário de prazos inválido.');
  const notice=isoDate(input.notificationDate);
  const start=isoDate(input.startDate||notice);
  if(start<notice)throw Error('Início anterior à intimação.');
  let day=rule.excludeStart?addDays(start,1):start,count=0,attempts=0;
  while(count<days){
    if(++attempts>20000)throw Error('Calendário inviabiliza a contagem.');
    const weekday=new Date(day+'T12:00:00Z').getUTCDay();
    const weekend=weekday===0||weekday===6;
    const holiday=input.holidays.some(h=>holidayApplies(h,day,input.location));
    const blocked=(rule.suspensions||[]).some(s=>inSuspension(day,s));
    if(!blocked&&(rule.unit==='calendar'||(!weekend&&!holiday)))count++;
    if(count<days)day=addDays(day,1);
  }
  return {notificationDate:notice,startDate:start,suggestedDate:day,
    status:'pending_human_review',isFatal:false,ruleVersion:String(rule.version||'draft'),
    holidayCalendarVersion:String(input.calendarVersion||'draft')};
}
const normalText=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
function movementFingerprint({workspaceId,processId,date,description,tpuCode}){
  if(!workspaceId||!processId||!normalText(description))throw Error('Andamento incompleto.');
  isoDate(date);
  return createHash('sha256').update([workspaceId,processId,date,normalText(description),String(tpuCode||'')].join('|')).digest('hex');
}
function validateCustomValues(schema,values){
  if(!Array.isArray(schema)||!values||typeof values!=='object'||Array.isArray(values))throw Error('Campos personalizados inválidos.');
  const fields=new Map();
  for(const field of schema){
    if(!field||typeof field.key!=='string'||!/^[a-z][a-z0-9_]{0,59}$/.test(field.key)
      ||!['text','textarea','date','boolean','decimal','money','select'].includes(field.type)
      ||fields.has(field.key))throw Error('Configuração de campos inválida.');
    fields.set(field.key,field);
  }
  for(const [key,value] of Object.entries(values)){
    const field=fields.get(key);
    if(!field)throw Error('Campo não configurado: '+key);
    if(value===null||value===''){if(field.required)throw Error('Campo obrigatório: '+key);continue;}
    if(field.type==='boolean'&&typeof value!=='boolean')throw Error('Tipo inválido: '+key);
    if(['text','textarea','select'].includes(field.type)&&(typeof value!=='string'||value.length>4000))throw Error('Tipo inválido: '+key);
    if(field.type==='select'&&(!Array.isArray(field.options)||!field.options.includes(value)))throw Error('Opção inválida: '+key);
    if(field.type==='date')isoDate(value);
    if(field.type==='money'&&(!Number.isSafeInteger(value)||value<0))throw Error('Valor monetário deve ser centavos inteiros.');
    if(field.type==='decimal'&&(typeof value!=='string'||!/^\d+(?:\.\d{1,6})?$/.test(value)))throw Error('Decimal inválido: '+key);
  }
  for(const field of fields.values())if(field.required&&(values[field.key]===undefined||values[field.key]===null||values[field.key]===''))throw Error('Campo obrigatório: '+field.key);
  return values;
}
const RIGHTS=Object.freeze({
  admin:['gestor','socio_admin'],
  legalRead:['gestor','socio_admin','advogado','juridico','estagiario','secretaria'],
  legalWrite:['gestor','socio_admin','advogado','juridico'],
  legalAdmin:['gestor','socio_admin']
});
function may(role,action){return (RIGHTS[action]||[]).includes(role);}
module.exports={DEFAULT_AREAS,cpfValid,cnpjValid,normalizedCnpj,cnjDigits,cnjValid,
  isoDate,deadlineSuggestion,movementFingerprint,validateCustomValues,may};
