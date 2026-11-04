(()=>{'use strict';
const $=x=>document.querySelector(x),cases=$('#cases'),status=$('#status'),login=$('#login');
function empty(el){el.replaceChildren();}
function node(tag,text,className){const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;return el;}
async function load(){
 try{
  const r=await fetch('/api/portal/cases',{credentials:'same-origin'}),d=await r.json();
  if(r.status===401){login.hidden=false;status.textContent='Entre para acessar seus casos publicados.';return;}
  if(!r.ok)throw Error(d.error||'Acesso indisponível.');
  login.hidden=true;empty(cases);
  if(!d.cases?.length){status.textContent='Não há casos autorizados para esta conta. Solicite ao escritório que confira seu convite.';return;}
  status.textContent='Informações publicadas pelo escritório. Não são notificações oficiais dos tribunais.';
  for(const c of d.cases){
   const section=document.createElement('section');section.className='panel';
   section.append(node('h2',c.case_label));
   const items=(d.updates||[]).filter(u=>u.access_id===c.id);
   if(!items.length)section.append(node('p','Nenhuma atualização publicada ainda.'));
   for(const u of items){
    const article=document.createElement('article');article.className='note';
    article.append(node('small',new Date(u.published_at).toLocaleString('pt-BR')));
    article.append(node('p',u.body));section.append(article);
   }
   cases.append(section);
  }
 }catch(e){status.textContent=e.message;}
}
$('#auth-form').onsubmit=async e=>{
 e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;status.textContent='Verificando credenciais…';
 try{const r=await fetch('/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:$('#email').value,password:$('#password').value})}),d=await r.json();
  if(!r.ok)throw Error(d.error||'Credenciais inválidas.');$('#password').value='';await load();
 }catch(e){status.textContent=e.message;}finally{button.disabled=false;}
};
load();
})();