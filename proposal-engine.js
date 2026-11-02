/* Partelís — renderer for the four immutable proposal designs. No private data leaves the browser. */
(function(factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(typeof window!=='undefined')window.PartelisProposal=api;})(function(){'use strict';
const TEMPLATES={passivo:'proposta_passivo_bancario.html',revisional:'proposta_acao_revisional.html',superendividamento:'proposta_superendividamento.html',holding:'proposta_holding.html'};
const DEFAULT={primary:'#0f2a44',secondary:'#b08d57',days:15,payment:'Cartão de crédito ou boleto bancário',responsible:'',oab:'',logo:'',cover:''};
const money=cents=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
const escaped=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const brazilDate=d=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(String(d||'')))return '';const [y,m,day]=d.split('-');return day+'/'+m+'/'+y;};
const number=(v)=>Number.isFinite(Number(v))?Number(v):0;
const kindFromArea=area=>{const a=String(area||'').toLowerCase();return a.includes('superendivid')?'superendividamento':a.includes('revisional')?'revisional':a.includes('holding')?'holding':'passivo';};
function toWords(cents){
 if(!Number.isSafeInteger(cents)||cents<0||cents>100000000000)throw Error('Valor fora dos limites para escrita por extenso.');
 const u=['zero','um','dois','três','quatro','cinco','seis','sete','oito','nove'],teens=['dez','onze','doze','treze','quatorze','quinze','dezesseis','dezessete','dezoito','dezenove'],tens=['','','vinte','trinta','quarenta','cinquenta','sessenta','setenta','oitenta','noventa'],hundreds=['','cento','duzentos','trezentos','quatrocentos','quinhentos','seiscentos','setecentos','oitocentos','novecentos'];
 const trip=n=>{if(n===100)return'cem';const h=Math.floor(n/100),r=n%100,t=Math.floor(r/10),o=r%10;return [h?hundreds[h]:'',r?(r<10?u[r]:r<20?teens[r-10]:tens[t]+(o?' e '+u[o]:'')):''].filter(Boolean).join(' e ');};
 const integer=Math.floor(cents/100),cent=cents%100;const parts=[];
 const milhao=Math.floor(integer/1000000),milhar=Math.floor(integer%1000000/1000),rest=integer%1000;
 if(milhao)parts.push(trip(milhao)+(milhao===1?' milhão':' milhões'));
 if(milhar)parts.push(milhar===1?'mil':trip(milhar)+' mil');
 if(rest)parts.push(trip(rest));
 const complete=parts.length?parts.join(rest&&rest<100?' e ':', '):'zero';
 const currency=integer===1?'real':'reais';
 return complete+' '+currency+(cent?' e '+trip(cent)+(cent===1?' centavo':' centavos'):'');
}
function installments(total,count,down=0){
 if(!Number.isSafeInteger(total)||total<=0||!Number.isInteger(count)||count<1||count>36||down<0||down>=total)throw Error('Honorários e parcelamento inválidos: informe pelo menos uma parcela.');
 const remaining=total-down,base=Math.floor(remaining/count),last=remaining-base*(count-1);
 if(base<1)throw Error('Cada parcela precisa ser de pelo menos R$ 0,01.');
 return {count,amount:base,last,down,adjusted:last!==base};
}
function rawChart(input){if(!input)return null;let o=typeof input==='string'?JSON.parse(input):input;if(!o||Array.isArray(o)||typeof o!=='object')throw Error('Dados dos gráficos precisam ser um objeto JSON.');return o;}
function chartFor(kind,values,debts){
 const safeEntries=a=>Array.isArray(a)?a.slice(0,25).filter(x=>x&&typeof x.l==='string'&&x.l.length<=60&&Number.isFinite(x.v)&&x.v>=0).map(x=>({l:x.l,v:x.v})):[];
 const result={};
 if(kind==='passivo'){
  const groups=new Map();for(const d of debts||[]){const key=String(d.kind||'Não classificado').slice(0,60),v=number(d.amount)/100;if(v>0)groups.set(key,(groups.get(key)||0)+v);}
  result.composicao=safeEntries(values?.composicao||[...groups.entries()].map(([l,v])=>({l,v})));result.centro=typeof values?.centro==='string'?values.centro.slice(0,50):(groups.size?money(Math.round([...groups.values()].reduce((a,b)=>a+b,0)*100)):'Não informado');
  result.cenarios=safeEntries(values?.cenarios);
 }else if(kind==='revisional'){
  const months=values?.meses,first=values?.contratada,second=values?.referencia;
  const validSeries=Array.isArray(months)&&Array.isArray(first)&&Array.isArray(second)&&months.length===12&&first.length===12&&second.length===12&&[...first,...second].every(x=>Number.isFinite(x)&&x>=0&&x<=100);
  result.meses=validSeries?months.map(x=>String(x).slice(0,15)):Array(12).fill('—');
  result.contratada=validSeries?first:Array(12).fill(0);result.referencia=validSeries?second:Array(12).fill(0);result.recuperar=safeEntries(values?.recuperar);
 }else if(kind==='superendividamento'){
  result.renda=safeEntries(values?.renda);
  const q=values?.quitacao;
  result.quitacao=Array.isArray(q?.labels)&&Array.isArray(q?.saldo)&&q.labels.length>=2&&q.labels.length===q.saldo.length&&q.labels.length<=18&&q.saldo.every(x=>Number.isFinite(x)&&x>=0&&x<=100)?{labels:q.labels.map(x=>String(x).slice(0,20)),saldo:q.saldo}:{labels:['0','12'],saldo:[0,0]};
  result.cenarios=safeEntries(values?.cenarios);
 }else{
  result.patrimonio=safeEntries(values?.patrimonio);result.tributacao=safeEntries(values?.tributacao);
 }
 return result;
}
function buildValues({proposal,client,office,settings,debts}){
 const p=proposal||{},t=p.terms||{},visual=p.visual||{},brand={...DEFAULT,...(settings||{})};
 if(!client?.name||!office?.name)throw Error('Informe o cliente e a identidade do escritório antes de gerar a proposta.');
 if(!brand.responsible?.trim()||!brand.oab?.trim())throw Error('Configure o advogado responsável e sua OAB nas Configurações → Propostas.');
 const amount=Number(p.amount),count=Number(t.count),down=Number(t.down||0);
 if(!Number.isSafeInteger(amount)||amount<1)throw Error('Honorários não informados. Preencha a proposta.');
 if(!Number.isFinite(Number(t.successPercent))||Number(t.successPercent)<0||Number(t.successPercent)>100||!t.successBase)throw Error('Informe o percentual e a base do êxito (use 0% e Não previsto quando não houver).');
 const split=installments(amount,count,down);
 const kind=TEMPLATES[visual.template]?visual.template:kindFromArea(visual.area||proposal.area||'');
 const chart=chartFor(kind,rawChart(visual.chartJson),debts||[]);
 const date=String(p.created||new Date().toISOString().slice(0,10)),valid=String(p.validUntil||'');
 const data={
 ESCRITORIO_NOME:office.name,CLIENTE_NOME:client.name,DATA_PROPOSTA:brazilDate(date),VALIDADE:brazilDate(valid),
 RESPONSAVEL:brand.responsible||'Responsável a confirmar',OAB:brand.oab||'OAB a informar',
 HONORARIO_INICIAL:money(amount),HONORARIO_INICIAL_EXTENSO:toWords(amount),
 PARCELAS_QTD:String(split.count),PARCELA_VALOR:money(split.amount),PARCELA_VENCIMENTO_PRIMEIRA:brazilDate(visual.firstDue||'' )||'A definir em contrato',
 FORMA_PAGAMENTO:brand.payment,EXITO_PERCENTUAL:String(number(t.successPercent)).replace('.',',')+'%',
 EXITO_BASE: t.successBase,EXITO_CONDICOES:visual.successConditions|| (number(t.successPercent) ? 'Conforme condição de êxito prevista no contrato, sem garantia de resultado.' : 'Não há honorários de êxito previstos.'),
 DIAGNOSTICO_TEXTO:visual.diagnosis||'Diagnóstico a complementar com os documentos e dados do cliente.'
 };
 const totalDebt=(debts||[]).reduce((a,d)=>a+Number(d.amount||0),0);
 const extras={
 passivo:{QTD_CONTRATOS:(debts||[]).length||'Não informado',PASSIVO_ESTIMADO:totalDebt?money(totalDebt):'Não informado',ECONOMIA_ESTIMADA:'Estimativa não informada'},
 revisional:{CONTRATO_TIPO:(debts||[])[0]?.kind||'Não informado',TAXA_CONTRATADA:'Não informada',TAXA_REFERENCIA:'Não informada'},
 superendividamento:{DIVIDA_TOTAL:totalDebt?money(totalDebt):'Não informado',RENDA_COMPROMETIDA:'Não informada',QTD_CREDORES:new Set((debts||[]).map(d=>d.creditor)).size||'Não informado'},
 holding:{PATRIMONIO_ESTIMADO:'Não informado',QTD_BENS:'Não informado',REGIME_ATUAL:'Não informado',NOME_HOLDING:'A definir',QUOTISTAS:'A definir'}
 };
 const optional=visual.fields&&typeof visual.fields==='object'?visual.fields:{};
 for(const [key,value] of Object.entries({...extras[kind],...optional})){
  if(typeof value==='string'||typeof value==='number')data[key]=String(value).slice(0,300);
 }
 const scope=visual.scopeItems||String(p.scope||'').split(/\n+/).map(x=>({title:'Serviço contratado',description:x}));
 const steps=visual.steps||[],next=visual.nextSteps||[];
 return {kind,data,chart,scope,steps,next,settings:brand,split,office};
}
function renderTemplate(source,opts,parse){
 if(typeof parse!=='function')throw Error('Renderização HTML exige DOMParser.');
 const model=buildValues(opts),doc=parse(source),root=doc.documentElement;
 const color=c=>/^#[0-9a-f]{6}$/i.test(c||'');
 if(color(model.settings.primary)||color(model.settings.secondary)){
  const style=[...doc.querySelectorAll('style')][0];
  let x=style.textContent;x=x.replace(/(--cor:)\s*#[0-9a-f]{6}/i,'$1'+(color(model.settings.primary)?model.settings.primary:DEFAULT.primary)).replace(/(--sec:)\s*#[0-9a-f]{6}/i,'$1'+(color(model.settings.secondary)?model.settings.secondary:DEFAULT.secondary));style.textContent=x;
 }
 for(const node of doc.querySelectorAll('[data-t]')){
  const key=node.getAttribute('data-t');
  if(node.tagName.toLowerCase()==='img'){
   const uri=key==='ESCRITORIO_LOGO'?model.settings.logo:key==='FOTO_CAPA'?model.settings.cover:'';
   if(uri&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/i.test(uri)&&uri.length<=800000)node.setAttribute('src',uri);else node.setAttribute('src','');
  }else node.textContent=String(model.data[key]??'Não informado');
 }
 const make=(tag,text,cls)=>{const el=doc.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=String(text);return el;};
 for(const node of doc.querySelectorAll('[data-field]')){
  const key=node.getAttribute('data-field'),items=(key==='ESCOPO'?model.scope:key==='ETAPAS'?model.steps:model.next);
  if(!Array.isArray(items)||items.length===0)continue;
  node.replaceChildren();
  if(key==='ESCOPO'){for(const [i,it] of items.slice(0,6).entries()){
   const card=make('div',undefined,'card');card.append(make('span',String(i+1).padStart(2,'0'),'num'),make('h3',String(it.title||'Atuação contratada').slice(0,90)),make('p',String(it.description||'').slice(0,1000)));node.append(card);
  }}else if(key==='ETAPAS'){for(const [i,it] of items.slice(0,8).entries()){
    const div=make('div',undefined,'etapa');div.append(make('span',undefined,'dot'),make('span','Etapa '+(i+1),'tag'),make('h3',String(it.title||'').slice(0,80)),make('p',String(it.deadline||'A definir').slice(0,130)));node.append(div);
  }}else{for(const item of items.slice(0,8))node.append(make('li',String(item).slice(0,200)));}
 }
 const chartText=JSON.stringify(model.chart).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
 const scripts=[...doc.querySelectorAll('script')];if(!scripts.length)throw Error('Modelo sem script de gráficos.');
 const script=scripts[scripts.length-1],raw=script.textContent;
 if(!/\/\*DADOS_INICIO\*\/[\s\S]*?\/\*DADOS_FIM\*\//.test(raw))throw Error('Modelo sem marcadores DADOS.');
 script.textContent=raw.replace(/\/\*DADOS_INICIO\*\/[\s\S]*?\/\*DADOS_FIM\*\//,'/*DADOS_INICIO*/'+chartText+'/*DADOS_FIM*/');
 if(model.kind==='holding'&&!doc.getElementById('donut'))script.textContent=script.textContent.replace("donut('#donut',DADOS.patrimonio,'R$ 2,4 mi','patrimônio');",''); // Original holding template references a nonexistent chart.
 const chartAvailability=model.kind==='passivo'?{donut:model.chart.composicao.length,legend:model.chart.composicao.length,cenarios:model.chart.cenarios.length}:model.kind==='revisional'?{grafico:model.chart.meses[0]!=='—',recuperar:model.chart.recuperar.length}:model.kind==='superendividamento'?{renda:model.chart.renda.length,quitacao:Array.isArray(rawChart(opts.proposal?.visual?.chartJson)?.quitacao?.labels),cenarios:model.chart.cenarios.length}:{patrimonio:model.chart.patrimonio.length,tributacao:model.chart.tributacao.length};
 // The static SVG templates remain unchanged. Empty charts are clearly labelled as lacking supporting evidence.
 const blank=[];
 for(const [key,available] of Object.entries(chartAvailability))if(!available)blank.push(key);
 if(blank.length){
  const caution=make('script');caution.textContent="document.addEventListener('DOMContentLoaded',function(){for(const id of "+JSON.stringify(blank)+"){const node=document.getElementById(id);if(node){node.replaceChildren();const p=document.createElement('p');p.textContent='Dados não informados — gráfico não disponível';p.style.cssText='padding:2rem 0;font-size:.92rem;color:#6b7280';node.append(p);}}});";
  doc.body.append(caution);
 }
 const printStyle=make('style');
 printStyle.textContent="@page{size:320mm 180mm;margin:0}@media print{html,body{overflow:visible!important;height:auto!important;background:white!important}.deck{position:static!important;height:auto!important}.slide{display:flex!important;position:relative!important;inset:auto!important;width:320mm!important;height:180mm!important;break-after:page!important;page-break-after:always!important;overflow:hidden!important;animation:none!important}.slide:last-child{break-after:auto!important}.prog,.partelis-proposal-toolbar{display:none!important}.slide .up{animation:none!important;opacity:1!important}}.partelis-proposal-toolbar{position:fixed;z-index:100;top:18px;right:20px;display:flex;gap:8px}.partelis-proposal-toolbar button{padding:10px 15px;background:#fff;border:1px solid #ddd;border-radius:12px;cursor:pointer;color:#0f2a44;font:600 12px Inter,system-ui;box-shadow:0 6px 18px #0003}.partelis-proposal-toolbar button.primary{background:#b08d57;border-color:#b08d57;color:#fff}@media(max-width:640px){.partelis-proposal-toolbar{top:8px;right:8px}.partelis-proposal-toolbar button{padding:8px;font-size:10px}}";
 doc.head.append(printStyle);
 const nav=make('div',undefined,'partelis-proposal-toolbar');nav.innerHTML='<button type="button" id="partelis-proposal-back">Anterior</button><button type="button" id="partelis-proposal-next">Próximo</button><button type="button" id="partelis-proposal-save">Baixar HTML</button><button type="button" class="primary" id="partelis-proposal-print">Exportar PDF</button>';
 doc.body.append(nav);
 const controls=make('script');const fname='partelis-proposta-'+String(model.data.CLIENTE_NOME).normalize('NFKD').replace(/[^a-z0-9-]/gi,'-').replace(/-+/g,'-').slice(0,38)+'-v'+String(opts.proposal.version||1)+'.html';
 controls.textContent="document.querySelectorAll('.partelis-proposal-toolbar button').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();if(b.id==='partelis-proposal-print'){window.print();return;}if(b.id==='partelis-proposal-save'){const blob=new Blob(['<!DOCTYPE html>\\n'+document.documentElement.outerHTML],{type:'text/html;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download="+JSON.stringify(fname)+";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);return;}document.dispatchEvent(new KeyboardEvent('keydown',{key:b.id==='partelis-proposal-next'?'ArrowRight':'ArrowLeft',bubbles:true}));}));";
 doc.body.append(controls);
 // ensure the generated document never contains example placeholder values from the original HTML.
 for(const node of doc.querySelectorAll('[data-t]:not(img)'))if(!node.textContent?.trim())throw Error('Campo obrigatório não preenchido: '+node.getAttribute('data-t'));
 for(const node of doc.querySelectorAll('img[data-t]'))if(node.getAttribute('src')?.includes('SUA MARCA'))throw Error('Logotipo de exemplo não pode ser usado.');
 return '<!DOCTYPE html>\n'+root.outerHTML;
}
async function generate(options){
 const kind=TEMPLATES[options?.proposal?.visual?.template]?options.proposal.visual.template:kindFromArea(options?.proposal?.visual?.area||options?.proposal?.area);
 const response=await fetch('/templates/'+TEMPLATES[kind],{cache:'no-store'});if(!response.ok)throw Error('Modelo de proposta indisponível: '+kind);
 const html=await response.text();return renderTemplate(html,options,text=>new DOMParser().parseFromString(text,'text/html'));
}
return {TEMPLATES,DEFAULT,kindFromArea,money,toWords,installments,chartFor,buildValues,renderTemplate,generate};
});
