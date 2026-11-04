(()=>{'use strict';
const cases=document.querySelector('#cases'),updates=document.querySelector('#updates');
function title(text,as='h3'){const el=document.createElement(as);el.textContent=text;return el;}
function empty(into,message){const p=document.createElement('p');p.className='empty';p.textContent=message;into.replaceChildren(p);}
(async()=>{try{
 const resp=await fetch('/api/portal/updates',{credentials:'same-origin'}),data=await resp.json();
 if(!resp.ok)throw Error(data.error||'Não foi possível consultar seu acesso.');
 cases.replaceChildren();updates.replaceChildren();
 if(!data.cases?.length)empty(cases,'Nenhum caso está autorizado para sua conta.');
 else for(const c of data.cases){
  const block=document.createElement('section');block.className='card';
  block.append(title('Caso '+String(c.case_id).slice(0,32)));
  const p=document.createElement('p');p.textContent='Escritório vinculado: '+String(c.workspace_id).slice(0,8);block.append(p);cases.append(block);
 }
 if(!data.updates?.length)empty(updates,'Nenhuma atualização aprovada foi publicada para sua conta.');
 else for(const item of data.updates){
  const block=document.createElement('article');block.className='card';
  block.append(title(item.title));
  const p=document.createElement('p');p.textContent=item.summary;block.append(p);
  const stamp=document.createElement('small');stamp.textContent='Publicado em '+String(item.published_at||'').slice(0,10);block.append(stamp);
  updates.append(block);
 }
}catch(e){empty(cases,e.message);empty(updates,'Consulte o escritório para receber informações do seu caso.');}})();
})();