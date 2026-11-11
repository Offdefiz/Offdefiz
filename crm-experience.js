(()=>{'use strict';
const $=s=>document.querySelector(s),esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const uxIcon=name=>{const p={user:'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',palette:'M12 3a9 9 0 1 0 9 9c0-1.1-.9-2-2-2h-2a2 2 0 0 0-2 2c0 1.7-2 2-3 2-2 0-2-2-2-3',building:'M4 21V4h16v17M2 21h20M8 8h2m4 0h2M8 12h2m4 0h2M10 21v-5h4v5',help:'M9.5 9a3 3 0 0 1 5.6 1.5c-.5 1-2.1 1.5-2.1 3M12 17h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20',headset:'M3 14v-3a9 9 0 0 1 18 0v3M5 14h2v6H5a3 3 0 0 1-3-3 3 3 0 0 1 3-3zm14 0h-2v6h2a3 3 0 0 0 3-3 3 3 0 0 0-3-3zM17 21a5 5 0 0 1-5 2',layers:'M12 2 2 7l10 5 10-5-10-5zM2 12l10 5 10-5M2 17l10 5 10-5',test:'M9 3h6M12 3v7l5 8a3 3 0 0 1-2.5 4h-5a3 3 0 0 1-2.5-4l5-8M8 15h8'};return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="'+(p[name]||p.layers)+'"/></svg>';};
const demoKey='partelis-demo-profile-v1',photoPattern=/^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i;
let profile={display_name:'',avatar_data:null},profileLoaded=false,profileLoading=null,draftPhoto=undefined,draftName=undefined,lastState=null,lastRole='gestor',lastPage='today',noticeTimer=null;
const inCloud=()=>Boolean(window.CLOUD),email=()=>window.CJ_USER?.email||(inCloud()?'':'demo@partelis.local');
const defaultName=()=>inCloud()?(email().split('@')[0].replace(/[._-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase())):'Usuário demonstrativo';
const displayName=()=>profile.display_name||defaultName();
const initials=name=>String(name).trim().split(/\s+/).slice(0,2).map(w=>w.charAt(0)).join('').toUpperCase()||'PT';
const safePhoto=p=>photoPattern.test(p||'')?p:null;
function avatar(size,photoOverride){const photo=photoOverride===undefined?profile.avatar_data:photoOverride;
 return '<span class="crm-avatar crm-avatar-'+size+'">'+(safePhoto(photo)?'<img alt="Foto de perfil" src="'+esc(photo)+'">':esc(initials(displayName())))+'</span>';
}
function toast(message,error=false){const node=$('#toast');if(!node)return;node.textContent=message;node.classList.toggle('err',error);clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>node.textContent='',4500);}
document.addEventListener('crm-notice',ev=>toast(ev.detail.message,Boolean(ev.detail.error)));
async function loadProfile(){
 if(profileLoaded)return profile;
 if(profileLoading)return profileLoading;
 profileLoading=(async()=>{try{
 if(!inCloud()){const saved=localStorage.getItem(demoKey);if(saved){const data=JSON.parse(saved);profile={display_name:String(data.display_name||'').slice(0,80),avatar_data:safePhoto(data.avatar_data)};}}
 else{const r=await fetch('/api/profile',{credentials:'same-origin'}),data=await r.json();if(!r.ok)throw Error(data.error||'Não foi possível carregar o perfil.');if(data.profile)profile={display_name:data.profile.display_name||'',avatar_data:safePhoto(data.profile.avatar_data)};}
 profileLoaded=true;updateAccount();if(lastPage==='profile')renderProfile();
 }catch(error){const note=$('#crm-profile-status');if(note)note.textContent=error.message;profileLoaded=true;updateAccount();}return profile;})();
 return profileLoading;
}
function updateAccount(){
 const slot=$('#crm-account-slot');if(slot)slot.innerHTML='<button type="button" class="crm-account-trigger" data-ux-action="account" aria-label="Abrir menu da conta">'+avatar('md')+'<span class="crm-account-meta"><strong>'+esc(displayName())+'</strong><small>'+esc(window.Caixa?.roles?.[lastRole]||'Minha conta')+'</small></span><span class="crm-account-chevron" aria-hidden="true">⌄</span></button>';
 const head=$('[data-crm-avatar]');if(head)head.innerHTML=avatar('sm');
}
function moveChrome(){
 document.body.classList.add('crm-ready');
 document.body.classList.toggle('crm-cloud',inCloud());
 const nav=$('#nav');if(nav)nav.setAttribute('aria-label','Módulos do escritório');
 const top=$('.top-actions');if(top&&!$('#crm-top-controls')){
  const controls=document.createElement('div');controls.id='crm-top-controls';controls.innerHTML='<button type="button" class="crm-global-search" data-ux-action="search" aria-label="Buscar páginas e atendimentos"><span aria-hidden="true">⌕</span><span>Buscar no Partelís</span><kbd>⌘ K</kbd></button><button type="button" class="crm-create-btn" data-ux-action="create" aria-label="Criar novo registro"><span aria-hidden="true">＋</span><span>Novo</span></button>';
  top.insertBefore(controls,top.firstChild);
 }
 // Keep navigation beside the breadcrumb, away from record/account actions.
 const bar=$('.topbar'),menu=$('.top-actions [data-action="menu"]');
 if(bar&&menu&&!$('.crm-header-context')){
  const context=document.createElement('div');context.className='crm-header-context';
  bar.insertBefore(context,bar.firstChild);context.append(menu);
  menu.classList.add('crm-nav-toggle');
  menu.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="4" width="18" height="16" rx="3"/><path class="crm-panel-divider" d="M9 4v16"/><path class="crm-panel-arrow" d="m15 9-3 3 3 3"/></svg><span class="crm-menu-label">Menu</span>';
  const crumb=$('.crumb'),mobile=$('.mobile-brand');if(crumb)context.append(crumb);if(mobile)context.append(mobile);
 }
 if(!$('.crm-sidebar-backdrop')){
  const overlay=document.createElement('button');overlay.type='button';overlay.className='crm-sidebar-backdrop';overlay.dataset.action='menu';overlay.setAttribute('aria-label','Fechar navegação');overlay.tabIndex=-1;document.body.append(overlay);
 }
 const search=$('.crm-global-search>span:first-child');
 if(search&&!search.querySelector('svg'))search.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg>';
 const shortcut=$('.crm-global-search kbd');if(shortcut)shortcut.textContent=/Mac|iPhone|iPad/.test(navigator.platform)?'⌘ K':'Ctrl K';
 const side=$('.sidebar');if(side){
 const active=$('.crm-utility-nav .active');
 if(active)active.setAttribute('aria-current','page');
 }
 updateAccount();
}
function renderSettings(){
 const root=$('#crm-settings-root');if(!root)return;
 const manager=lastRole==='gestor',accent=window.CJ_THEME?.accent||'#30145F',workspace=window.CJ_THEME?.name||(inCloud()?'Meu escritório':'Escritório demonstrativo');
 root.innerHTML='<div class="crm-setting-intro"><div><h2>Seu ambiente, do seu jeito.</h2><p>Personalização, segurança, ajuda e acesso à sua conta — tudo em um só lugar.</p></div><span class="crm-setting-symbol">⚙</span></div>'+
 '<div class="crm-setting-grid">'+
 '<section class="crm-setting-card"><div class="crm-setting-card-icon">'+uxIcon('user')+'</div><h3>Minha conta</h3><p>Foto, nome de exibição, e-mail e senha.</p><div class="crm-setting-account">'+avatar('md')+'<span><strong>'+esc(displayName())+'</strong><small>'+esc(email())+'</small></span></div><button class="btn crm-card-link" data-action="navigate" data-id="profile">Editar meu perfil <span>→</span></button></section>'+
 '<section class="crm-setting-card"><div class="crm-setting-card-icon">'+uxIcon('palette')+'</div><h3>Aparência</h3><p>Ajuste o modo de visualização sem afetar as preferências dos colegas.</p><div class="crm-theme-preview"><span class="crm-color-dot" style="background:'+(/^#[0-9a-f]{6}$/i.test(accent)?accent:'#30145F')+'"></span><span>'+esc(document.body.classList.contains('dark')?'Modo escuro':'Modo claro')+'</span></div><button type="button" class="btn crm-card-link" data-ux-action="toggle-theme">Alternar claro e escuro <span>→</span></button></section>'+
 '<section class="crm-setting-card"><div class="crm-setting-card-icon">'+uxIcon('building')+'</div><h3>Identidade do escritório</h3><p>Nome e cores utilizadas nas telas e propostas do seu escritório.</p><div class="crm-workspace-chip"><span class="crm-color-dot" style="background:'+(/^#[0-9a-f]{6}$/i.test(accent)?accent:'#30145F')+'"></span>'+esc(workspace)+'</div>'+(manager?'<button type="button" class="btn crm-card-link" data-ux-action="brand">Personalizar escritório <span>→</span></button>':'<p class="crm-permission-hint">Somente o gestor pode editar a identidade.</p>')+'</section>'+
 '<section class="crm-setting-card"><div class="crm-setting-card-icon">'+uxIcon('help')+'</div><h3>Ajuda e treinamento</h3><p>Aprenda os fluxos e acompanhe o que mudou na plataforma.</p><div class="crm-stack-actions"><button type="button" class="btn" data-ux-action="tour">Iniciar tutorial guiado</button><button type="button" class="btn" data-ux-action="news">Novidades e versões</button>'+(inCloud()?'<button type="button" class="btn" data-ux-action="feedback">Reportar problema ou sugestão</button>':'')+'</div></section>'+
 (manager&&inCloud()?'<section class="crm-setting-card crm-setting-card-wide"><div class="crm-setting-card-icon">'+uxIcon('headset')+'</div><h3>Suporte remoto Partelís</h3><p>Autorize temporariamente a equipe Partelís a visualizar os dados do seu escritório para diagnóstico. O acesso é somente leitura, dura até 60 minutos e fica registrado.</p><div class="crm-support-status" id="crm-support-status" role="status">Consultando autorização…</div><div class="crm-support-actions"><button type="button" class="btn primary" data-ux-action="support-approve">Autorizar por 60 minutos</button><button type="button" class="btn" data-ux-action="support-revoke">Revogar acesso</button></div></section>':'')+
 '<section class="crm-setting-card"><div class="crm-setting-card-icon">'+uxIcon('layers')+'</div><h3>Recursos do aplicativo</h3><p>Gerencie seu acesso e consulte as ferramentas disponíveis.</p><div class="crm-stack-actions">'+(inCloud()?'<a class="btn" href="/conta">Alterar minha senha</a>':'')+'<a class="btn" href="/cliente/demo" target="_blank" rel="noopener">Ver portal do cliente (demo)</a>'+(lastRole==='gestor'?'<button type="button" class="btn" data-action="navigate" data-id="integrations">Integrações</button>':'')+'<button type="button" class="btn" data-action="navigate" data-id="about">Sobre o produto</button></div></section>'+
 (!inCloud()?'<section class="crm-setting-card"><div class="crm-setting-card-icon">'+uxIcon('test')+'</div><h3>Perfil de demonstração</h3><p>Alterne entre as permissões simuladas para testar o protótipo.</p><label for="crm-demo-role" class="crm-input-label">Simular perfil</label><select id="crm-demo-role">'+Object.entries(window.Caixa.roles).map(([k,v])=>'<option value="'+esc(k)+'" '+(lastRole===k?'selected':'')+'>'+esc(v)+'</option>').join('')+'</select></section>':'')+
 '</div>';
 if(manager&&inCloud())loadSupportStatus();
}
function renderProfile(){
 const root=$('#crm-profile-root');if(!root)return;
 const preview=draftPhoto===undefined?profile.avatar_data:draftPhoto;
 root.innerHTML='<div class="crm-profile-layout"><section class="crm-profile-card"><div class="crm-profile-banner"><div class="crm-profile-banner-pattern"></div></div><div class="crm-profile-summary">'+avatar('xl',preview)+'<div><h2>'+esc(displayName())+'</h2><p>'+esc(email())+'</p><span class="crm-role-pill">'+esc(window.Caixa?.roles?.[lastRole]||'Usuário')+'</span></div></div><div class="crm-profile-divider"></div><div class="crm-profile-hint"><strong>Perfil pessoal</strong><p>Estas informações pertencem à sua conta. Elas não modificam os clientes ou os dados jurídicos do escritório.</p></div></section>'+
 '<section class="crm-profile-card crm-profile-edit"><div class="crm-card-header"><div><h2>Informações pessoais</h2><p>Personalize como você aparece no Partelís.</p></div></div><form id="crm-profile-form"><div class="crm-form-field"><label for="crm-display-name">Nome de exibição</label><input id="crm-display-name" name="display_name" type="text" minlength="2" maxlength="80" required autocomplete="name" placeholder="Seu nome completo" value="'+esc(draftName===undefined?(profile.display_name||defaultName()):draftName)+'"></div><div class="crm-form-field"><label for="crm-user-email">E-mail de acesso</label><input id="crm-user-email" type="email" value="'+esc(email())+'" readonly><small>O e-mail de autenticação é gerenciado pela sua conta.</small></div><div class="crm-form-field"><label for="crm-avatar-file">Foto de perfil</label><div class="crm-photo-controls">'+avatar('lg',preview)+'<div><label for="crm-avatar-file" class="btn crm-file-label">Escolher foto</label><input id="crm-avatar-file" type="file" accept="image/*" class="crm-visually-hidden"><button type="button" class="btn" data-ux-action="remove-photo">Remover</button><small>JPG, PNG, WebP ou foto do celular. Ajuste automático para 256 × 256.</small></div></div></div><p id="crm-profile-status" class="crm-form-status" role="status"></p><div class="crm-form-footer"><button type="submit" class="btn primary">Salvar alterações</button>'+(inCloud()?'<a href="/conta" class="btn">Alterar senha</a>':'')+'</div></form></section></div>';
 root.querySelector('form').onsubmit=saveProfile;
 root.querySelector('#crm-display-name').oninput=ev=>{draftName=ev.target.value;};
 root.querySelector('#crm-avatar-file').onchange=async ev=>{const file=ev.target.files?.[0];if(!file)return;const status=$('#crm-profile-status');try{status.textContent='Preparando foto…';draftPhoto=await processPhoto(file);renderProfile();const note=$('#crm-profile-status');if(note)note.textContent='Foto pronta. Clique em Salvar alterações.';}catch(error){status.textContent=error.message;}};
}
async function processPhoto(file){
 if(!file.type.startsWith('image/'))throw Error('Selecione uma imagem válida.');
 if(file.size>8*1024*1024)throw Error('Selecione uma foto com até 8 MB.');
 const objectUrl=URL.createObjectURL(file);
 try{
 const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Não foi possível abrir essa imagem.'));img.src=objectUrl;});
 const width=img.naturalWidth,height=img.naturalHeight;if(!width||!height)throw Error('A foto está vazia ou danificada.');
 const c=document.createElement('canvas');c.width=256;c.height=256;const ctx=c.getContext('2d');if(!ctx)throw Error('Não foi possível processar a imagem.');
 const edge=Math.min(width,height),x=(width-edge)/2,y=(height-edge)/2;ctx.drawImage(img,x,y,edge,edge,0,0,256,256);
 let result=c.toDataURL('image/jpeg',0.8);if(result.length>160000)result=c.toDataURL('image/jpeg',0.58);
 if(result.length>160000)throw Error('A imagem não pôde ser otimizada. Tente outra foto.');
 return result;
 }finally{URL.revokeObjectURL(objectUrl);}
}
async function saveProfile(ev){
 ev.preventDefault();const form=ev.currentTarget,submit=form.querySelector('[type=submit]'),status=$('#crm-profile-status');
 const name=form.querySelector('[name=display_name]').value.trim();if(name.length<2||name.length>80){status.textContent='Informe um nome entre 2 e 80 caracteres.';return;}
 submit.disabled=true;status.textContent='Salvando perfil…';
 const next={display_name:name,avatar_data:draftPhoto===undefined?profile.avatar_data:draftPhoto};
 try{
 if(inCloud()){const res=await fetch('/api/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(next)}),data=await res.json();if(!res.ok)throw Error(data.error||'Não foi possível salvar.');profile={display_name:data.profile.display_name,avatar_data:safePhoto(data.profile.avatar_data)};}
 else{localStorage.setItem(demoKey,JSON.stringify(next));profile=next;}
 draftPhoto=undefined;draftName=undefined;updateAccount();renderProfile();toast('Perfil atualizado com sucesso.');
 }catch(error){status.textContent=error.message;}finally{submit.disabled=false;}
}
async function loadSupportStatus(){
 const n=$('#crm-support-status');if(!n)return;
 try{const res=await fetch('/api/support/status'),data=await res.json();if(!res.ok)throw Error(data.error||'Não foi possível verificar o suporte.');
 n.textContent=data.active?'Suporte autorizado até '+new Date(data.expires_at).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'Nenhum acesso de suporte está ativo.';n.classList.toggle('crm-support-on',data.active);
 }catch(error){n.textContent='Não foi possível consultar o status: '+error.message;}
}
async function support(action){
 if(!inCloud())return toast('Entre em uma conta de escritório para configurar o suporte.',true);
 if(action==='approve'&&!confirm('Autorizar acesso de leitura aos dados do escritório por 60 minutos, com registro das consultas?'))return;
 const btn=$('[data-ux-action="support-'+action+'"]');if(btn)btn.disabled=true;
 try{const res=await fetch('/api/support/grant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,confirm:action==='approve'})}),data=await res.json();if(!res.ok)throw Error(data.error||'Falha ao atualizar autorização.');toast(action==='approve'?'Suporte autorizado por até 60 minutos.':'Autorização de suporte revogada.');await loadSupportStatus();}catch(error){toast(error.message,true);}finally{if(btn)btn.disabled=false;}
}
async function logout(){if(!inCloud())return location.assign('/demo');try{await fetch('/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});}finally{location.assign('/login');}}
function closePopover(){const old=$('#crm-popover');if(old)old.remove();document.querySelectorAll('[data-ux-action="account"]').forEach(b=>b.setAttribute('aria-expanded','false'));}
function popover(btn,markup){
 const old=$('#crm-popover');if(old){const same=old.dataset.trigger===btn.dataset.uxAction;closePopover();if(same)return;}
 const node=document.createElement('div');node.id='crm-popover';node.dataset.trigger=btn.dataset.uxAction;node.className='crm-popover';node.innerHTML=markup;document.body.append(node);
 const rect=btn.getBoundingClientRect();const width=250;const left=Math.min(innerWidth-width-12,Math.max(12,rect.left));node.style.left=left+'px';node.style.top=Math.min(innerHeight-node.offsetHeight-12,rect.bottom+8)+'px';
 btn.setAttribute('aria-expanded','true');
}
function accountMenu(btn){
 popover(btn,'<div class="crm-popover-user">'+avatar('md')+'<span><strong>'+esc(displayName())+'</strong><small>'+esc(email())+'</small></span></div><div class="crm-popover-divider"></div><button type="button" data-action="navigate" data-id="profile">Meu perfil <span>→</span></button><button type="button" data-action="navigate" data-id="settings">Configurações <span>→</span></button><div class="crm-popover-divider"></div>'+(inCloud()?'<button type="button" class="crm-logout" data-ux-action="logout">Sair da conta <span>↗</span></button>':'<span class="crm-popover-caption">Modo demonstração</span>'));
}
function createMenu(btn){
 const options=[['newClient','Novo atendimento'],['newMeeting','Agendar reunião'],['newTask','Nova tarefa']].filter(([k])=>k==='newClient'?window.Caixa?.can(lastRole,'client'):k==='newMeeting'?window.Caixa?.can(lastRole,'meeting'):true);
 popover(btn,'<div class="crm-popover-label">CRIAR REGISTRO</div>'+options.map(([k,label])=>'<button type="button" data-action="'+k+'">'+esc(label)+' <span>＋</span></button>').join(''));
}
function dispatchCore(action,id=''){
 const b=document.createElement('button');b.type='button';b.hidden=true;b.dataset.action=action;b.dataset.id=id;document.body.append(b);b.click();b.remove();
}
function openSearch(){
 closePopover();let d=$('#crm-search-dialog');if(!d){d=document.createElement('dialog');d.id='crm-search-dialog';d.className='crm-search-dialog';d.innerHTML='<div class="crm-search-modal"><div class="crm-search-line"><span aria-hidden="true">⌕</span><input type="search" id="crm-search-input" autocomplete="off" placeholder="Buscar páginas, atendimentos…" aria-label="Buscar no Partelís"><button class="crm-search-escape" type="button" data-ux-action="close-search">ESC</button></div><div id="crm-search-results" class="crm-search-results"></div><div class="crm-search-footer">Pesquisar páginas e atendimentos disponíveis neste escritório <span>Ctrl/⌘ + K</span></div></div>';document.body.append(d);d.querySelector('input').addEventListener('input',()=>searchResults());d.addEventListener('click',ev=>{if(ev.target===d)d.close();});}
 d.showModal();searchResults();d.querySelector('input').focus();
}
function searchResults(){
 const input=$('#crm-search-input'),root=$('#crm-search-results');if(!input||!root)return;
 const q=input.value.toLowerCase().trim();
 const pages=[...document.querySelectorAll('#nav [data-action="navigate"],.crm-utility-nav [data-action="navigate"]')].map(n=>({kind:'navigate',id:n.dataset.id,label:n.textContent.trim()}));
 const results=pages.filter(x=>!q||x.label.toLowerCase().includes(q)).map(x=>({kind:x.kind,id:x.id,label:x.label,category:'Página'}));
 if($('#nav [data-id="funnel"]')&&lastState?.clients&&q.length>1){for(const client of lastState.clients){if(!String(client.name||'').toLowerCase().includes(q))continue;const opp=lastState.opportunities?.find(o=>o.clientId===client.id);if(opp)results.push({kind:'detail',id:opp.id,label:client.name,category:'Atendimento'});}}
 root.innerHTML=results.slice(0,12).map(x=>'<button type="button" class="crm-search-result" data-ux-result="'+esc(x.kind)+'" data-result-id="'+esc(x.id)+'"><span class="crm-search-result-icon">'+(x.kind==='navigate'?'▣':'◉')+'</span><span>'+esc(x.label)+'</span><small>'+x.category+'</small></button>').join('')||'<p class="crm-search-empty">Nenhum resultado encontrado.</p>';
 root.querySelectorAll('[data-ux-result]').forEach(b=>b.onclick=()=>{$('#crm-search-dialog').close();dispatchCore(b.dataset.uxResult,b.dataset.resultId);});
}
document.addEventListener('click',ev=>{
 const b=ev.target.closest('[data-ux-action]');
 if(!b){if(!ev.target.closest('#crm-popover'))closePopover();return;}
 const action=b.dataset.uxAction;
 if(action==='account'){ev.preventDefault();accountMenu(b);}
 else if(action==='create'){ev.preventDefault();createMenu(b);}
 else if(action==='search')openSearch();
 else if(action==='close-search')$('#crm-search-dialog')?.close();
 else if(action==='brand')window.PartelisBrandEditor?.();
 else if(action==='toggle-theme'){const dark=!document.body.classList.contains('dark');localStorage.setItem('cj-mode',dark?'dark':'light');document.body.classList.toggle('dark',dark);window.dispatchEvent(new CustomEvent('caixa-theme-saved'));renderSettings();toast('Aparência atualizada neste dispositivo.');}
 else if(action==='tour')window.PartelisHelp?.tour();
 else if(action==='news')window.PartelisHelp?.news();
 else if(action==='feedback')window.PartelisFeedback?.open();
 else if(action==='support-approve')support('approve');
 else if(action==='support-revoke')support('revoke');
 else if(action==='remove-photo'){draftPhoto=null;renderProfile();const n=$('#crm-profile-status');if(n)n.textContent='Foto removida da prévia. Salve para confirmar.';}
 else if(action==='logout')logout();
 if(!['account','create'].includes(action))closePopover();
});
document.addEventListener('change',ev=>{if(ev.target.id==='crm-demo-role'){const real=$('#roleSelect');if(real){real.value=ev.target.value;real.dispatchEvent(new Event('change',{bubbles:true}));}}});
document.addEventListener('keydown',ev=>{if((ev.ctrlKey||ev.metaKey)&&ev.key.toLowerCase()==='k'){ev.preventDefault();if(!$('#crm-search-dialog')?.open)openSearch();}if(ev.key==='Escape')closePopover();});
let motionPage=null;
const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
const activeMotion=new Set();
motionPreference.addEventListener('change',()=>{if(motionPreference.matches){activeMotion.forEach(a=>a.cancel());activeMotion.clear();}});
function animatePage(page){
 if(motionPage===page)return;motionPage=page;
 activeMotion.forEach(a=>a.cancel());activeMotion.clear();
 if(motionPreference.matches)return;
 const nodes=[...document.querySelectorAll('#main>.heading,#main>.hero,#main>.metrics>.metric,#main>.panel,#main>.chart-grid>.chart-card,#main>.kanban>.lane,#main>.crm-client-stats>div')].slice(0,12);
 nodes.forEach((node,i)=>{if(typeof node.animate!=='function')return;
  const animation=node.animate([{opacity:0,transform:'translateY(14px)'},{opacity:1,transform:'translateY(0)'}],{duration:420,delay:Math.min(i*40,240),easing:'cubic-bezier(.22,1,.36,1)',fill:'backwards'});
  activeMotion.add(animation);animation.onfinish=animation.oncancel=()=>activeMotion.delete(animation);
 });
}
window.addEventListener('caixa-render',ev=>{
 lastState=ev.detail.state;lastRole=ev.detail.role;lastPage=ev.detail.page;
 moveChrome();if(!profileLoaded)loadProfile();
 if(lastPage==='settings')renderSettings();
 if(lastPage==='profile')renderProfile();
 if($('#crm-popover'))closePopover();
 animatePage(lastPage);
});
 if($('#nav')){lastRole=$('#roleSelect')?.value||'gestor';moveChrome();loadProfile();}
})();
