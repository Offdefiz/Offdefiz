(()=>{'use strict';
const select=document.querySelector('#modelo'),fields=document.querySelector('#fields'),form=document.querySelector('#contract-preflight'),button=document.querySelector('#check'),result=document.querySelector('#result');
let models=[];
const show=(lines,state)=>{result.dataset.state=state||'';result.textContent=Array.isArray(lines)?lines.join('\n'):String(lines);};
function render(){
 fields.replaceChildren();show('A conferência utiliza apenas os valores digitados nesta página.','');
 const model=models[Number(select.value)];if(!model){button.disabled=true;return;}
 for(const field of model.fields){
  const wrapper=document.createElement('label'),name=document.createElement('span'),input=document.createElement('input');
  name.textContent=field.label;input.name=field.variable;input.id='field-'+field.order+'-'+model.tipo;
  input.autocomplete='off';input.type=field.input_type==='email'?'email':'text';
  input.required=Boolean(field.required);input.maxLength=500;input.setAttribute('aria-label',field.label);
  if(field.input_type==='dinheiro')input.placeholder='R$ 1.000,00';
  if(field.input_type==='date')input.placeholder='DD/MM/AAAA';
  if(field.input_type==='cpf')input.placeholder='000.000.000-00';
  if(field.input_type==='cnpj')input.placeholder='00.000.000/0000-00';
  if(field.input_type==='phone_br')input.placeholder='(31) 99999-9999';
  wrapper.append(name,input);fields.append(wrapper);
 }
 button.disabled=false;
}
select.addEventListener('change',render);
form.addEventListener('submit',async ev=>{
 ev.preventDefault();const model=models[Number(select.value)];if(!model)return;
 button.disabled=true;show('Conferindo campos, sem criar documentos...','');
 try{
  const values=Object.fromEntries(new FormData(form).entries());
  const resp=await fetch('/api/contracts/preflight',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({modalidade:model.modalidade,tipo:model.tipo,values})});
  const data=await resp.json();if(resp.status===401){show('Sua sessão expirou. Entre novamente.','error');return;}
  if(!resp.ok&&resp.status!==422)throw Error(data.error||'Falha na conferência');
  const lines=[data.ok?'Dados aceitos na pré-validação.':'Campos que precisam de correção:',...(data.errors||[])];
  lines.push('Criação de documentos: BLOQUEADA. Produção: DESABILITADA.');
  for(const issue of data.blockers||[])lines.push('Bloqueio: '+issue);
  show(lines,data.ok?'ok':'error');
 }catch(e){show(e.message,'error');}finally{button.disabled=false;}
});
(async()=>{try{const resp=await fetch('/api/contracts/catalog',{credentials:'same-origin'});const data=await resp.json();if(!resp.ok)throw Error(data.error||'Não foi possível obter os modelos');models=data.models||[];select.replaceChildren();models.forEach((model,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=model.modalidade.replaceAll('_',' ')+' · '+model.tipo;select.append(option);});render();}catch(e){show(e.message,'error');select.replaceChildren();button.disabled=true;}})();
})();