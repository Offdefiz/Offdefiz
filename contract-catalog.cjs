'use strict';
// Somente a apresentação: o catálogo original nunca é alterado.
const originals=require('./zapsign-formularios.json');
function models(){
 return originals.map(model=>{
  const fields=new Map(model.update_form_payload.inputs.map(field=>[field.variable.slice(2,-2),field]));
  return {
   modalidade:model.modalidade,tipo:model.tipo,arquivo:model.arquivo,
   fields:model.variaveis.map(variable=>{
    const info=fields.get(variable)||{};
    return {variable,label:info.label||variable,input_type:info.input_type||'input',required:info.required!==false,order:info.order??null};
   })
  };
 });
}
module.exports={models};
