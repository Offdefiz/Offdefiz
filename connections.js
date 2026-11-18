'use strict';
const page=document.body.dataset.connections;
async function api(url,options){
 const res=await fetch(url,options),data=await res.json().catch(()=>({}));
 if(res.status===401&&page==='admin'){location.href='/login';throw Error('Entre para continuar.');}
 if(!res.ok)throw Error(data.error||'Não foi possível concluir. Tente novamente.');
 return data;
}
const $=id=>document.getElementById(id);
const setText=(id,value)=>{$(id).textContent=value||'';};
const slugFromPath=()=>decodeURIComponent(location.pathname.split('/').pop()||'');
const linkTypes={whatsapp:'WhatsApp',instagram:'Instagram',linkedin:'LinkedIn',youtube:'YouTube',site:'Site profissional',agenda:'Agendamento',artigo:'Artigo',imprensa:'Imprensa',email:'E-mail',outro:'Outro link'};
const safeCardUrl=value=>{try{const u=new URL(value);return u.protocol==='https:'||u.protocol==='mailto:'?u.href:null;}catch{return null;}};
function cardButton(item,preview=false){
 const el=document.createElement(preview?'div':'a');el.className='card-button';el.textContent=item.label||linkTypes[item.type]||'Link';
 if(!preview){const href=safeCardUrl(item.url);if(!href)return null;el.href=href;el.target='_blank';el.rel='noopener noreferrer nofollow';}
 return el;
}
if(page==='admin'){
 let links=[];
 let profile;
 async function load(){
  try{
   const data=await api('/api/conexoes');
   profile=data.profile;
   if(profile){
    for(const key of ['slug','professional_name','oab_registration','city','state','presentation'])$(key).value=profile[key]||'';
    $('published').checked=profile.published===true;
    document.querySelectorAll('[name=areas]').forEach(el=>{el.checked=(profile.areas||[]).includes(el.value);});
    links=Array.isArray(profile.links)?profile.links.map(x=>({...x})):[];
    $('theme').value=profile.theme||'violeta';
    showLink();
   }
   renderEditor();renderPreview();
   if(data.contactEnabled){$('inbox-panel').hidden=false;await loadInbox();}
  }catch(err){setText('profile-status',err.message);}
 }
 function showLink(){
  const box=$('share-box');
  box.hidden=!profile?.published;
  if(!box.hidden){const link=location.origin+'/adv/'+encodeURIComponent(profile.slug);$('share-link').href=link;$('share-link').textContent=link;
   const target=$('qr-target');target.replaceChildren();if(typeof QRCode!=='undefined')new QRCode(target,{text:link,width:180,height:180,correctLevel:QRCode.CorrectLevel.M});}
 }
 function renderPreview(){
  const name=$('professional_name').value.trim()||'Seu nome profissional';
  setText('preview-name',name);setText('preview-oab',$('oab_registration').value.trim()||'OAB/UF');
  setText('preview-avatar',name[0].toUpperCase());setText('preview-bio',$('presentation').value.trim());
  $('card-preview').dataset.theme=$('theme').value;
  const target=$('preview-links');target.replaceChildren();
  for(const link of links){if(link.label.trim())target.append(cardButton(link,true));}
 }
 function renderEditor(){
  const root=$('card-links-editor');root.replaceChildren();
  $('add-card-link').disabled=links.length>=8;
  links.forEach((link,index)=>{
   const row=document.createElement('div');row.className='card-link-row';
   const title=document.createElement('div');title.className='row-title';
   const label=document.createElement('strong');label.textContent='Botão '+(index+1);
   const actions=document.createElement('div');actions.className='row-actions';
   for(const [text,delta] of [['↑',-1],['↓',1]]){
    const btn=document.createElement('button');btn.type='button';btn.textContent=text;
    btn.setAttribute('aria-label',delta<0?'Mover para cima':'Mover para baixo');
    btn.disabled=index+delta<0||index+delta>=links.length;
    btn.addEventListener('click',()=>{const next=index+delta;[links[index],links[next]]=[links[next],links[index]];renderEditor();renderPreview();});
    actions.append(btn);
   }
   const remove=document.createElement('button');remove.type='button';remove.textContent='Excluir';
   remove.addEventListener('click',()=>{links.splice(index,1);renderEditor();renderPreview();});
   actions.append(remove);title.append(label,actions);row.append(title);
   const fields=document.createElement('div');fields.className='row-fields';
   function field(caption,element,wide=false){
    const wrap=document.createElement('div');wrap.className='field'+(wide?' wide':'');
    const lbl=document.createElement('label');lbl.textContent=caption;lbl.htmlFor=element.id;
    wrap.append(lbl,element);return wrap;
   }
   const type=document.createElement('select');type.id='card-type-'+index;
   for(const [value,title] of Object.entries(linkTypes)){const option=document.createElement('option');option.value=value;option.textContent=title;type.append(option);}
   type.value=link.type;
   type.addEventListener('change',()=>{link.type=type.value;renderPreview();});
   const text=document.createElement('input');text.id='card-label-'+index;text.maxLength=48;text.required=true;text.value=link.label;
   text.placeholder='Ex.: Meu WhatsApp';text.addEventListener('input',()=>{link.label=text.value;renderPreview();});
   const url=document.createElement('input');url.id='card-url-'+index;url.maxLength=600;url.required=true;url.value=link.url;
   url.placeholder=link.type==='email'?'mailto:contato@escritorio.com.br':'https://...';
   url.addEventListener('input',()=>{link.url=url.value;renderPreview();});
   fields.append(field('Canal',type),field('Texto do botão',text),field('Endereço (HTTPS ou mailto)',url,true));row.append(fields);root.append(row);
  });
 }
 $('add-card-link').addEventListener('click',()=>{if(links.length>=8)return;links.push({type:'site',label:'Meu site',url:'https://'});renderEditor();renderPreview();});
 for(const id of ['professional_name','oab_registration','presentation','theme'])$(id).addEventListener('input',renderPreview);
 $('profile-form').addEventListener('submit',async e=>{
  e.preventDefault();
  const button=$('save-profile');button.disabled=true;setText('profile-status','Salvando…');
  try{
   const fields=Object.fromEntries(new FormData(e.currentTarget));
   fields.areas=[...document.querySelectorAll('[name=areas]:checked')].map(el=>el.value);
   fields.links=links.map(item=>({type:item.type,label:item.label.trim(),url:item.url.trim()}));
   fields.published=$('published').checked;
   fields.ethical_attestation=$('ethical_attestation').checked;
   const result=await api('/api/conexoes/perfil',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(fields)});
   profile=result.profile;links=profile.links.map(x=>({...x}));renderEditor();renderPreview();setText('profile-status',profile.published?'Perfil publicado. Compartilhe seu link.':'Rascunho salvo. Seu perfil não está público.');showLink();
  }catch(err){setText('profile-status',err.message);}finally{button.disabled=false;}
 });
 $('download-qr').addEventListener('click',()=>{
  const canvas=$('qr-target').querySelector('canvas');if(!canvas){setText('profile-status','Não foi possível gerar o QR Code.');return;}
  const anchor=document.createElement('a');anchor.href=canvas.toDataURL('image/png');anchor.download='cartao-profissional-partelis.png';document.body.append(anchor);anchor.click();anchor.remove();
 });
 $('copy-link').addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText($('share-link').href);setText('profile-status','Link copiado.');}
  catch{setText('profile-status','Selecione o endereço acima para copiar.');}
 });
 async function loadInbox(){
  try{
   const data=await api('/api/conexoes/solicitacoes');
   const container=$('inbox');container.replaceChildren();
   if(!data.requests.length){setText('inbox-status','Nenhuma solicitação recebida.');return;}
   setText('inbox-status',data.requests.length+' solicitação(ões) recente(s).');
   for(const item of data.requests){
    const article=document.createElement('article');article.className='request';
    const heading=document.createElement('strong');heading.textContent=item.name;
    const meta=document.createElement('p');meta.textContent=item.subject+' · '+new Date(item.created_at).toLocaleDateString('pt-BR');
    const email=document.createElement('a');email.href='mailto:'+encodeURIComponent(item.email);email.textContent=item.email;
    article.append(heading,meta,email);
    if(item.phone){const tel=document.createElement('p');tel.textContent=item.phone;article.append(tel);}
    const select=document.createElement('select');select.setAttribute('aria-label','Etapa da solicitação de '+item.name);
    for(const [value,label] of [['new','Nova'],['contacted','Contatado'],['closed','Concluída']]){
     const opt=document.createElement('option');opt.value=value;opt.textContent=label;opt.selected=value===item.status;select.append(opt);
    }
    select.addEventListener('change',async()=>{select.disabled=true;try{await api('/api/conexoes/solicitacoes/status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:item.id,status:select.value})});}catch(err){setText('inbox-status',err.message);}finally{select.disabled=false;}});
    article.append(select);container.append(article);
   }
  }catch(err){setText('inbox-status',err.message);}
 }
 load();
}
if(page==='public'){
 const slug=slugFromPath();
 (async()=>{
  try{
   const {profile,contactEnabled}=await api('/api/public/conexoes/'+encodeURIComponent(slug));
   setText('public-name',profile.professional_name);setText('public-oab',profile.oab_registration);
   setText('public-location',profile.city+' · '+profile.state);setText('public-presentation',profile.presentation);
   document.title=profile.professional_name+' · Perfil profissional | Partelís';
   const tags=$('public-areas');tags.replaceChildren();
   for(const area of profile.areas||[]){const el=document.createElement('span');el.textContent=area;tags.append(el);}
   $('digital-card').dataset.theme=profile.theme||'violeta';
   setText('public-avatar',(profile.professional_name||'A').charAt(0).toUpperCase());
   const linksContainer=$('public-links');linksContainer.replaceChildren();
   for(const link of profile.links||[]){const button=cardButton(link);if(button)linksContainer.append(button);}
   const vcard=$('download-vcard');vcard.hidden=false;
   vcard.addEventListener('click',()=>{
    const escapeV=v=>String(v||'').replace(/\\/g,'\\\\').replace(/\r\n|[\r\n]/g,'\\n').replace(/[;,]/g,m=>'\\'+m);
    const content=['BEGIN:VCARD','VERSION:3.0','FN:'+escapeV(profile.professional_name),
     'ORG:'+escapeV(profile.professional_name),'NOTE:'+escapeV(profile.oab_registration),
     'URL:'+location.href,'END:VCARD'].join('\r\n');
    const blob=new Blob([content],{type:'text/vcard;charset=utf-8'});
    const objectUrl=URL.createObjectURL(blob);const anchor=document.createElement('a');
    anchor.href=objectUrl;anchor.download='contato-profissional.vcf';document.body.append(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(objectUrl),1000);
   });
   $('contact-panel').hidden=!contactEnabled;
  }catch{setText('public-name','Perfil indisponível');setText('public-location','O endereço pode estar incorreto ou o perfil não está publicado.');}
 })();
 $('contact-form').addEventListener('submit',async e=>{
  e.preventDefault();const button=$('send-request');button.disabled=true;setText('contact-status','Enviando…');
  try{
   const fields=Object.fromEntries(new FormData(e.currentTarget));fields.consent=$('consent').checked;
   await api('/api/public/conexoes/'+encodeURIComponent(slug)+'/solicitacoes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(fields)});
   e.currentTarget.reset();setText('contact-status','Solicitação enviada ao escritório. Aguarde o contato pelo canal informado.');
  }catch(err){setText('contact-status',err.message);}finally{button.disabled=false;}
 });
}
