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
function cardInitials(name){
 return name.trim().split(/\s+/).slice(0,2).map(word=>word[0]).join('').toUpperCase();
}
const safeCardUrl=value=>{try{const u=new URL(value);return u.protocol==='https:'||u.protocol==='mailto:'?u.href:null;}catch{return null;}};
const cardIcons={
 contact:'M20 11a7 7 0 0 1-7 7H8l-5 3 1.7-5.5A7 7 0 0 1 6 5h7a7 7 0 0 1 7 6Z',
 agenda:'M5 5h14a2 2 0 0 1 2 2v12H3V7a2 2 0 0 1 2-2Zm2-2v4m10-4v4M3 10h18',
 about:'M19 21H5v-2a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6ZM12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
 article:'M5 3h9l5 5v13H5Zm8 0v6h6M8 13h8m-8 4h8',
 press:'M6 4h15v16H6Zm-3 3v13h3m3-12h9m-9 4h9m-9 4h6',
 areas:'m12 3 9 5-9 5-9-5Zm-9 9 9 5 9-5m-18 4 9 5 9-5',
 external:'M6 18 18 6M8 6h10v10'
};
function cardIcon(name){
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
 svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
 const path=document.createElementNS(ns,'path');path.setAttribute('d',cardIcons[name]);svg.append(path);return svg;
}
function cardElement(tag,cls,text){
 const node=document.createElement(tag);
 if(cls)node.className=cls;
 if(text)node.textContent=text;
 return node;
}
function renderProfessionalCard(root,profile,preview=false){
 const details=profile.card_details||{},name=profile.professional_name||'Seu nome profissional';
 const links=(profile.links||[]).filter(link=>preview||safeCardUrl(link.url));
 const hero=cardElement('header','professional-hero'),avatar=cardElement('div','professional-photo');
 if(/^data:image\/jpeg;base64,/.test(details.photo||'')){
  const img=cardElement('img');img.src=details.photo;img.alt='';avatar.append(img);
 }else avatar.textContent=cardInitials(name);
 const title=cardElement(preview?'h2':'h1','professional-name',name);title.id=preview?'preview-name':'public-name';
 hero.append(avatar,title);
 if(details.headline)hero.append(cardElement('p','professional-headline',details.headline));
 if(details.intro)hero.append(cardElement('p','professional-intro',details.intro));
 const contact=links.find(link=>link.type==='whatsapp')||links.find(link=>link.type==='email');
 const agenda=links.find(link=>link.type==='agenda');
 function linkButton(link,label,icon,style=''){
  const el=cardElement(preview?'div':'a','professional-link '+style);
  if(!preview){el.href=safeCardUrl(link.url);el.rel='noopener noreferrer nofollow';if(el.protocol==='https:')el.target='_blank';}
  el.append(cardIcon(icon),cardElement('span','',label));return el;
 }
 if(contact||agenda){
  const actions=cardElement('div','professional-actions');
  if(contact)actions.append(linkButton(contact,'Entrar em contato','contact','professional-contact'));
  if(agenda)actions.append(linkButton(agenda,'Agendar conversa','agenda','professional-agenda'));
  hero.append(actions);
 }
 root.replaceChildren(hero);
 function section(title,icon){
  const group=cardElement('section','professional-section');
  const heading=cardElement(preview?'h3':'h2','professional-section-title');
  const badge=cardElement('span','professional-section-icon');badge.append(cardIcon(icon));
  heading.append(badge,cardElement('span','',title));group.append(heading);root.append(group);
  return group;
 }
 if(profile.presentation)section('Sobre','about').append(cardElement('p','professional-about',profile.presentation));
 function linkSection(items,title,icon,style){
  if(!items.length)return;
  const list=cardElement('div','professional-links '+style);
  if(style==='professional-other')list.id=preview?'preview-links':'public-links';
  for(const item of items)list.append(linkButton(item,item.label||linkTypes[item.type]||'Link',icon));
  section(title,icon).append(list);
 }
 linkSection(links.filter(link=>link.type==='artigo'),'Artigos','article','professional-articles');
 linkSection(links.filter(link=>link.type==='imprensa'),'Na imprensa','press','professional-press');
 if(profile.areas?.length){
  const tags=cardElement('div','professional-areas');tags.id=preview?'preview-areas':'public-areas';
  for(const area of profile.areas)tags.append(cardElement('span','',area));
  section('Áreas de atuação','areas').append(tags);
 }
 linkSection(links.filter(link=>link!==contact&&link!==agenda&&!['artigo','imprensa'].includes(link.type)),
  'Outros links','external','professional-other');
 const footer=cardElement('footer','professional-footer');
 const identity=[profile.oab_registration,[profile.city,profile.state].filter(Boolean).join(' · ')].filter(Boolean).join('  |  ');
 if(identity)footer.append(cardElement('p','professional-registration',identity));
 const credit=cardElement('p','','Página criada com ');credit.append(cardElement('strong','','Partelís'));
 footer.append(credit);root.append(footer);
 return footer;
}
async function preparePhoto(file){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024)
  throw Error('Selecione uma foto JPEG, PNG ou WebP de até 8 MB.');
 const bitmap=await createImageBitmap(file);
 try{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=480;
  const size=Math.min(bitmap.width,bitmap.height),ctx=canvas.getContext('2d');
  ctx.fillStyle='#f8f1ed';ctx.fillRect(0,0,480,480);
  ctx.drawImage(bitmap,(bitmap.width-size)/2,(bitmap.height-size)/2,size,size,0,0,480,480);
  let data=canvas.toDataURL('image/jpeg',.84);
  if(data.length>160000)data=canvas.toDataURL('image/jpeg',.66);
  if(data.length>160000)throw Error('A foto continua grande após compactar. Escolha outra.');
  return data;
 }finally{bitmap.close();}
}
if(page==='admin'){
 let links=[];
 let profile;
 let photo='',photoSelection=0;
 async function load(){
  try{
   const data=await api('/api/conexoes');
   profile=data.profile;
   if(profile){
    for(const key of ['slug','professional_name','oab_registration','city','state','presentation'])$(key).value=profile[key]||'';
    $('published').checked=profile.published===true;
    $('areas').value=(profile.areas||[]).join('\n');
    $('headline').value=profile.card_details?.headline||'';
    $('intro').value=profile.card_details?.intro||'';
    photo=profile.card_details?.photo||'';
    $('remove-photo').hidden=!photo;
    links=Array.isArray(profile.links)?profile.links.map(x=>({...x})):[];
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
 function selectedAreas(){return $('areas').value.split(/\r?\n/).map(area=>area.trim()).filter(Boolean);}
 function details(){return {photo,headline:$('headline').value.trim(),intro:$('intro').value.trim()};}
 function renderPreview(){
  renderProfessionalCard($('card-preview'),{
   professional_name:$('professional_name').value.trim(),
   oab_registration:$('oab_registration').value.trim(),city:$('city').value.trim(),
   state:$('state').value.trim().toUpperCase(),presentation:$('presentation').value.trim(),
   areas:selectedAreas(),links:links.filter(link=>link.label.trim()),card_details:details()
  },true);
 }
 $('profile-photo').addEventListener('change',async event=>{
  const input=event.currentTarget,file=input.files[0];
  if(!file)return;
  const selection=++photoSelection;
  $('save-profile').disabled=true;
  try{
   const prepared=await preparePhoto(file);
   if(selection!==photoSelection)return;
   photo=prepared;$('remove-photo').hidden=false;
   setText('photo-status','Foto pronta. Salve para aplicar.');renderPreview();
  }catch(error){if(selection===photoSelection)setText('photo-status',error.message);}
  finally{if(selection===photoSelection){input.value='';$('save-profile').disabled=false;}}
 });
 $('remove-photo').addEventListener('click',()=>{
  photoSelection++;photo='';$('profile-photo').value='';$('remove-photo').hidden=true;$('save-profile').disabled=false;
  setText('photo-status','Foto removida da prévia. Salve para aplicar.');renderPreview();
 });
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
 $('profile-form').addEventListener('input',renderPreview);
 $('profile-form').addEventListener('submit',async e=>{
  e.preventDefault();
  const button=$('save-profile');button.disabled=true;setText('profile-status','Salvando…');
  try{
   const fields=Object.fromEntries(new FormData(e.currentTarget));
   fields.areas=selectedAreas();
   fields.card_details=details();
   fields.theme=profile?.theme||'claro';
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
   const footer=renderProfessionalCard($('digital-card'),profile);
   document.title=profile.professional_name+' · Perfil profissional | Partelís';
   const vcard=cardElement('button','professional-vcard','Salvar contato no celular');
   vcard.id='download-vcard';vcard.type='button';footer.prepend(vcard);
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
  e.preventDefault();const form=e.currentTarget,button=$('send-request');button.disabled=true;setText('contact-status','Enviando…');
  try{
   const fields=Object.fromEntries(new FormData(form));fields.consent=$('consent').checked;
   await api('/api/public/conexoes/'+encodeURIComponent(slug)+'/solicitacoes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(fields)});
   form.reset();setText('contact-status','Solicitação enviada ao escritório. Aguarde o contato pelo canal informado.');
  }catch(err){setText('contact-status',err.message);}finally{button.disabled=false;}
 });
}
