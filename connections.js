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
if(page==='admin'){
 let profile;
 async function load(){
  try{
   const data=await api('/api/conexoes');
   profile=data.profile;
   if(profile){
    for(const key of ['slug','professional_name','oab_registration','city','state','presentation'])$(key).value=profile[key]||'';
    $('published').checked=profile.published===true;
    document.querySelectorAll('[name=areas]').forEach(el=>{el.checked=(profile.areas||[]).includes(el.value);});
    showLink();
   }
   await loadInbox();
  }catch(err){setText('profile-status',err.message);}
 }
 function showLink(){
  const box=$('share-box');
  box.hidden=!profile?.published;
  if(!box.hidden){const link=location.origin+'/profissional/'+encodeURIComponent(profile.slug);$('share-link').href=link;$('share-link').textContent=link;}
 }
 $('profile-form').addEventListener('submit',async e=>{
  e.preventDefault();
  const button=$('save-profile');button.disabled=true;setText('profile-status','Salvando…');
  try{
   const fields=Object.fromEntries(new FormData(e.currentTarget));
   fields.areas=[...document.querySelectorAll('[name=areas]:checked')].map(el=>el.value);
   fields.published=$('published').checked;
   fields.ethical_attestation=$('ethical_attestation').checked;
   const result=await api('/api/conexoes/perfil',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(fields)});
   profile=result.profile;setText('profile-status',profile.published?'Perfil publicado. Compartilhe seu link.':'Rascunho salvo. Seu perfil não está público.');showLink();
  }catch(err){setText('profile-status',err.message);}finally{button.disabled=false;}
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
   const {profile}=await api('/api/public/conexoes/'+encodeURIComponent(slug));
   setText('public-name',profile.professional_name);setText('public-oab',profile.oab_registration);
   setText('public-location',profile.city+' · '+profile.state);setText('public-presentation',profile.presentation);
   document.title=profile.professional_name+' · Perfil profissional | Partelís';
   const tags=$('public-areas');tags.replaceChildren();
   for(const area of profile.areas||[]){const el=document.createElement('span');el.textContent=area;tags.append(el);}
   $('contact-panel').hidden=false;
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
