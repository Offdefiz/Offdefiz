'use strict';
// Draft renderer: generates HTML for server-side PDF conversion only.
// Never accept executable templates or raw user HTML.
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const allowed=['escritorio_nome','escritorio_documento','cliente_nome','cliente_documento','objeto','escopo','honorarios_total','entrada','parcelas','honorarios_exito','foro','data'];
function renderTemplate(template,values){
 if(typeof template!=='string'||template.length>100000)throw Error('Template inválido.');
 for(const key of Object.keys(values||{}))if(!allowed.includes(key))throw Error('Campo de contrato não permitido: '+key);
 const missing=[];
 const html=template.replace(/\{\{\s*([a-z_]+)\s*\}\}/g,(_,key)=>{
  if(!allowed.includes(key))throw Error('Variável não reconhecida: '+key);
  if(values[key]===null||values[key]===undefined||values[key]==='')missing.push(key);
  return escapeHtml(values[key]);
 });
 if(missing.length)throw Error('Campos obrigatórios sem preenchimento: '+[...new Set(missing)].join(', '));
 if(/\{\{/.test(html))throw Error('Template contém variáveis inválidas.');
 return html;
}
const sha256=content=>require('node:crypto').createHash('sha256').update(content).digest('hex');
module.exports={renderTemplate,sha256,allowed};
