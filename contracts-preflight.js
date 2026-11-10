(()=>{'use strict';
const $=s=>document.querySelector(s),modelsEl=$('#model'),clientEl=$('#client'),fieldsEl=$('#fields'),form=$('#document-form'),output=$('#result');
let models=[],clients=[];
const map={ 'NOME COMPLETO':'name','EMAIL DO CLIENTE':'email','TELEFONE DO CLIENTE':'phone','CPF DO CLIENTE':'taxId' };
function show(msg,error=false){output.textContent=msg;output.setAttribute('aria-invalid',error?'true':'false');}
const title=x=>x.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
async function get(route){const r=await fetch(route,{credentials:'same-origin'}),data=await r.json();if(!r.ok)throw Error(data.error||'Falha de comunicação');return data;}
const current=()=>models.find((_,i)=>String(i)===modelsEl.value);
function selectClient(){
 const c=clients.find(c=>String(c.id)===clientEl.value);if(!c)return;
 for(const [field,prop] of Object.entries(map)){const node=[...fieldsEl.querySelectorAll('input')].find(n=>n.dataset.field===field);if(!node)continue;
  let val=c[prop];if(typeof val!=='string')continue;
  if(field==='CPF DO CLIENTE'&&!/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(val))continue;
  node.value=val;
 }
 show('Dados cadastrais disponíveis foram preenchidos. Confira e complete as informações obrigatórias.');
}
function render(){
 const model=current();fieldsEl.replaceChildren();form.hidden=!model;if(!model)return;
 for(const field of model.fields){
   const label=document.createElement('label');label.textContent=field.label||field.variable;
   const input=document.createElement('input');input.dataset.field=field.variable;input.name=field.variable;input.type=field.input_type==='email'?'email':'text';input.required=Boolean(field.required);
   input.autocomplete='off';input.maxLength=500;input.placeholder=field.input_type==='dinheiro'?'R$ 0,00':field.input_type==='date'?'dd/mm/aaaa':'';
   label.append(input);fieldsEl.append(label);
 }
 show('Modelo carregado. Preencha os campos e execute a pré-validação.');
 if(clientEl.value)selectClient();
}
modelsEl.onchange=render;clientEl.onchange=selectClient;
form.onsubmit=async e=>{
 e.preventDefault();const m=current();if(!m)return;
 const btn=$('#validate');btn.disabled=true;show('Validando campos, sem gerar arquivos…');
 try{
  const values={};for(const node of fieldsEl.querySelectorAll('input'))values[node.dataset.field]=node.value;
  const r=await fetch('/api/contracts/preflight',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({modalidade:m.modalidade,tipo:m.tipo,values})});
  const result=await r.json();
  if(![200,422].includes(r.status))throw Error(result.error||'Não foi possível validar.');
  let message=(result.ok?'Campos preenchidos e formatos aceitos.':'Existem inconsistências:')+'\n';
  if(result.errors?.length)message+=result.errors.join('\n')+'\n';
  message+='\nCRIAÇÃO BLOQUEADA: '+(result.blockers||[]).join('; ');
  if(result.parcelamento)message+='\nParcelamento: '+result.parcelamento.count+' parcelas; valor regular '+result.parcelamento.regularCents+' centavos, última '+result.parcelamento.lastCents+' centavos.';
  message+='\nNenhum documento ou assinatura foi criado.';
  show(message,!result.ok||result.blockers?.length>0);
 }catch(error){show(error.message,true);}finally{btn.disabled=false;}
};
(async()=>{
 try{
  const catalog=await get('/api/contracts/catalog');models=catalog.models||[];
  modelsEl.replaceChildren();modelsEl.add(new Option('Selecione o modelo',''));
  models.forEach((m,i)=>modelsEl.add(new Option(title(m.modalidade)+' · '+title(m.tipo),String(i))));
  const state=await get('/api/state');
  clients=Array.isArray(state.data?.clients)?state.data.clients:[];
  for(const c of clients){if(typeof c.name==='string')clientEl.add(new Option(c.name,String(c.id)));}
  show('Escolha um modelo para iniciar a pré-validação. Os campos não são salvos nesta página.');
 }catch(error){modelsEl.replaceChildren();modelsEl.add(new Option('Acesso indisponível',''));show(error.message+' Entre com um perfil autorizado no escritório.',true);}
})();
})();