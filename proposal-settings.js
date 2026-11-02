(()=>{'use strict';const KEY='partelis-proposal-settings-v1',def=window.PartelisProposal?.DEFAULT||{primary:'#0f2a44',secondary:'#b08d57',days:15,payment:'Cartão de crédito ou boleto bancário',responsible:'',oab:'',logo:'',cover:''};
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
function current(){let local={};try{local=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(_){}return {...def,...(window.CLOUD?(window.CJ_THEME?.proposal||{}):local)};}
function alertStatus(msg,err=false){const node=$('#crm-proposal-settings-message');if(node){node.textContent=msg;node.style.color=err?'#b42346':'#287d59';}else window.alert(msg);}
function paint(){
 const grid=$('#crm-settings-root .crm-setting-grid');if(!grid||$('#crm-proposal-settings-card'))return;
 const card=document.createElement('section');card.className='crm-setting-card';card.id='crm-proposal-settings-card';
 const p=current();const manager=window.CJ_USER?.role==='gestor'||!window.CLOUD;
 card.innerHTML='<div class="crm-setting-card-icon">▧</div><h3>Propostas comerciais</h3><p>Configure uma identidade para os quatro modelos de sete slides, sem alterar o tema do aplicativo.</p><div class="crm-theme-preview"><span class="crm-color-dot" style="background:'+esc(p.primary)+'"></span><span class="crm-color-dot" style="background:'+esc(p.secondary)+'"></span><span>Apresentações do escritório</span></div>'+(manager?'<button type="button" class="btn crm-card-link" id="crm-proposal-settings-open">Configurar modelos <span>→</span></button>':'<p class="crm-permission-hint">Somente o gestor configura as apresentações.</p>');
 grid.append(card);card.querySelector('button')?.addEventListener('click',open);
}
const encodePhoto=async(file,type)=>{
 if(!file)return null;const limit=type==='cover'?5*1024*1024:2*1024*1024;
 if(file.size>limit)throw Error(type==='cover'?'A foto pode ter até 5 MB.':'O logotipo pode ter até 2 MB.');
 if(!['image/png','image/jpeg','image/svg+xml','image/webp'].includes(file.type))throw Error('Formato inválido. Use PNG, JPG ou SVG.');
 let source=file;
 if(file.type==='image/svg+xml'){
  const svg=await file.text();
  if(!/<svg[\s>]/i.test(svg)||/<(?:script|foreignObject|iframe|object|embed|image)\b|\son[a-z]+\s*=|(?:xlink:)?href\s*=|url\s*\(|@import/i.test(svg))throw Error('SVG contém recursos externos ou código não permitido. Envie um arquivo SVG simples.');
  source=new Blob([svg],{type:'image/svg+xml'});
 }
 const img=new Image(),blobUrl=URL.createObjectURL(source);
 try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Não foi possível abrir esta imagem.'));img.src=blobUrl;});
 const origW=img.naturalWidth,origH=img.naturalHeight;if(!origW||!origH)throw Error('Imagem inválida.');
 const max=type==='cover'?1280:500;let scale=Math.min(1,max/Math.max(origW,origH));
 for(let n=0;n<6;n++){const c=document.createElement('canvas');c.width=Math.max(1,Math.round(origW*scale));c.height=Math.max(1,Math.round(origH*scale));const ctx=c.getContext('2d');if(!ctx)throw Error('Canvas indisponível.');ctx.drawImage(img,0,0,c.width,c.height);
 const content=type==='cover'?c.toDataURL('image/jpeg',.78-n*.06):c.toDataURL('image/png');if(content.length<(type==='cover'?540000:270000))return content;scale*=.72;
 }throw Error('Imagem muito complexa. Use uma resolução menor.');
 }finally{URL.revokeObjectURL(blobUrl);}
};
function open(){
 let d=$('#crm-proposal-settings-dialog');d?.remove();d=document.createElement('dialog');d.id='crm-proposal-settings-dialog';d.className='crm-feedback-dialog';
 const p=current();
 d.innerHTML='<form id="crm-proposal-brand-form" class="crm-proposal-settings-form"><div class="crm-dialog-head"><div><span class="crm-kicker">IDENTIDADE DAS PROPOSTAS</span><h2>Modelos do escritório</h2><p>Estas configurações são compartilhadas por todas as propostas do escritório.</p></div><button type="button" class="crm-icon-btn" id="crm-proposal-close" aria-label="Fechar">×</button></div><div class="crm-proposal-settings-grid">'+
 '<div class="crm-form-field"><label for="proposalOffice">Nome do escritório</label><input id="proposalOffice" name="office" maxlength="60" required value="'+esc(window.CJ_THEME?.name||'Escritório demonstrativo')+'"></div>'+
 '<div class="crm-form-field"><label for="proposalResponsible">Advogado responsável</label><input id="proposalResponsible" name="responsible" maxlength="100" required placeholder="Nome do responsável" value="'+esc(p.responsible)+'"></div>'+
 '<div class="crm-form-field"><label for="proposalOab">Registro OAB</label><input id="proposalOab" name="oab" maxlength="50" required placeholder="MG 000.000" value="'+esc(p.oab)+'"></div>'+
 '<div class="crm-form-field"><label for="proposalDays">Validade padrão (dias)</label><input id="proposalDays" name="days" type="number" min="1" max="90" step="1" value="'+esc(p.days)+'" required></div>'+
 '<div class="crm-form-field"><label for="proposalPrimary">Cor principal</label><input id="proposalPrimary" type="color" name="primary" value="'+esc(p.primary)+'"></div>'+
 '<div class="crm-form-field"><label for="proposalSecondary">Cor secundária</label><input id="proposalSecondary" type="color" name="secondary" value="'+esc(p.secondary)+'"></div>'+
 '<div class="crm-form-field"><label for="proposalPayment">Forma de pagamento</label><input id="proposalPayment" name="payment" maxlength="140" required value="'+esc(p.payment)+'"></div>'+
 '<div class="crm-form-field"><label for="proposalLogo">Logotipo (PNG, JPG ou SVG até 2 MB)</label><input id="proposalLogo" type="file" accept=".svg,image/png,image/jpeg,image/svg+xml"><small>O logotipo é otimizado e convertido para PNG.</small></div>'+
 '<div class="crm-form-field"><label for="proposalCover">Fotografia da capa (JPG ou PNG até 5 MB)</label><input id="proposalCover" type="file" accept="image/png,image/jpeg"><small>Opcional. Sem imagem, permanece o fundo original com pilares.</small></div>'+
 '</div><label class="crm-proposal-check"><input type="checkbox" id="proposalRemoveCover"> Remover fotografia atual da capa</label><p id="crm-proposal-settings-message" role="status"></p><div class="crm-dialog-actions"><button type="button" class="btn" id="crm-proposal-cancel">Cancelar</button><button type="submit" class="btn primary">Salvar para o escritório</button></div></form>';
 document.body.append(d);d.querySelector('#crm-proposal-close').onclick=d.querySelector('#crm-proposal-cancel').onclick=()=>d.close();
 d.addEventListener('close',()=>d.remove(),{once:true});
 d.querySelector('form').onsubmit=async ev=>{ev.preventDefault();const f=ev.currentTarget,submit=f.querySelector('[type=submit]'),data=Object.fromEntries(new FormData(f));submit.disabled=true;alertStatus('Salvando personalização…');
 try{
 const next={primary:data.primary,secondary:data.secondary,responsible:String(data.responsible).trim(),oab:String(data.oab).trim(),days:Number(data.days),payment:String(data.payment).trim(),logo:p.logo,cover:p.cover};
 if(!/^#[0-9a-f]{6}$/i.test(next.primary)||!/^#[0-9a-f]{6}$/i.test(next.secondary)||next.responsible.length<3||!next.oab||!Number.isInteger(next.days)||next.days<1||next.days>90||!next.payment)throw Error('Confira nome, OAB, cores, prazo e pagamento.');
 const logo=f.querySelector('#proposalLogo').files[0],cover=f.querySelector('#proposalCover').files[0];if(logo)next.logo=await encodePhoto(logo,'logo');if(cover)next.cover=await encodePhoto(cover,'cover');if(f.querySelector('#proposalRemoveCover').checked)next.cover='';
 if(window.CLOUD){
  const theme=window.CJ_THEME||{},res=await fetch('/api/theme',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:String(data.office).trim(),accent:theme.accent||'#30145F',proposal:next})}),out=await res.json();
  if(!res.ok)throw Error(out.error||'Não foi possível salvar a configuração.');window.CJ_THEME=out.theme;window.dispatchEvent(new CustomEvent('caixa-theme-saved',{detail:out}));
 }else{localStorage.setItem(KEY,JSON.stringify(next));}
 d.close();const card=$('#crm-proposal-settings-card');if(card)card.remove();paint();
 document.dispatchEvent(new CustomEvent('crm-notice',{detail:{message:'Configurações das propostas atualizadas.'}}));
 }catch(e){alertStatus(e.message,true);}finally{submit.disabled=false;}};
 d.showModal();
}
window.PartelisProposalSettings={current,open};
window.addEventListener('caixa-render',e=>{if(e.detail.page==='settings')paint();});
})();