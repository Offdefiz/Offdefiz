let csrf=''; let active='overview'; let cached={};
const $=(sel)=>document.querySelector(sel), all=(sel)=>document.querySelectorAll(sel);
const money=(c)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(c||0)/100);
const safe=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('visible'),4500)}
async function api(path,body){const init=body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(body)};const res=await fetch(path,init);if(res.status===401){location.href='/login';throw Error('Sessão expirada')};let d=await res.json().catch(()=>({error:'Resposta inválida'}));if(!res.ok)throw Error(d.error||'Falha de comunicação');return d}
function empty(text){return `<div class="empty">${safe(text)}</div>`}
function item(name,meta,right=''){return `<div class="list-item"><div><strong>${safe(name)}</strong><p>${safe(meta)}</p></div><aside>${right}</aside></div>`}
function nav(tab){active=tab;all('.pane').forEach(e=>e.classList.toggle('hidden',e.id!==tab));all('.nav').forEach(e=>e.classList.toggle('active',e.dataset.tab===tab));const labels={overview:'Visão geral',sales:'Funil Opspulse',groups:'Comunidades',opportunities:'Oportunidades',leads:'CRM e clientes',posts:'Publicações',finance:'Financeiro',reports:'Relatórios'};$('#crumb').textContent=labels[tab];$('#heading').textContent=tab==='overview'?'Seu negócio, sob controle.':labels[tab];$('#subtitle').textContent=tab==='overview'?'Acompanhe oportunidades, conteúdo, clientes e indicadores de um único lugar.':'Registros e ações do Telegram OPS. Dados reais, sem estimativas fabricadas.';}
async function reload(){try{const [status,over,gs,op,leads,posts,finance,events,report,feeds,sales,campaigns,products,orders,settings,notices]=await Promise.all(['/api/status','/api/overview','/api/groups','/api/opportunities','/api/leads','/api/posts','/api/finance','/api/events','/api/report','/api/feeds','/api/sales/overview','/api/sales/campaigns','/api/sales/products','/api/sales/orders','/api/sales/settings','/api/sales/notifications'].map(p=>api(p)));cached={status,over,gs,op,leads,posts,finance,events,report,feeds,sales,campaigns,products,orders,settings,notices};draw()}catch(e){toast('Erro: '+e.message)}}
function draw(){const {status,over,gs,op,leads,posts,finance,events,report,feeds,sales,campaigns,products,orders,settings,notices}=cached;
 $('#s-visitors').textContent=sales.visitors;$('#s-subscribed').textContent=sales.subscribed;$('#s-orders').textContent=sales.orders;
 $('#s-group-link').value=settings.group_link||'';
 $('#s-campaigns').innerHTML=campaigns.map(c=>item(c.title,`Origem: ${c.code}`,`<a href="${safe(c.url)}" target="_blank" rel="noopener noreferrer">Abrir link</a> <button class="minor" data-copy="${safe(c.url)}">Copiar</button>`)).join('')||empty('Crie um link de divulgação.');
 $('#s-products').innerHTML=products.map(p=>item(p.name,p.description,`${money(p.price_cents)} · ${p.active?'ativo':'inativo'}`)).join('')||empty('Nenhum produto cadastrado.');
 $('#s-orders-list').innerHTML=orders.map(o=>item(`#${o.id} · ${o.product}`,`${o.customer}${o.contact?' (@'+o.contact+')':''} · ${money(o.price_cents)}`,`<select class="pipeline" aria-label="Status do pedido" data-sale-order="${o.id}">${['aguardando','em_contato','pago_confirmado','cancelado'].map(v=>`<option value="${v}" ${o.status===v?'selected':''}>${v.replace('_',' ')}</option>`).join('')}</select>`)).join('')||empty('Nenhum pedido recebido.');
 $('#s-sources').innerHTML=sales.by_campaign.map(x=>item(x.source,'Interessados',String(x.visits))).join('')||empty('Sem visitantes ainda.');
 $('#s-notices').innerHTML=notices.map(n=>item('Aviso #'+n.id,n.body,`<button class="minor" data-notify-id="${n.id}">Enviar lote (até 20)</button>`)).join('')||empty('Nenhum comunicado.');
 $('#k-groups').textContent=over.groups;$('#k-groups-desc').textContent=`${over.managed_groups} gerenciadas`;$('#k-opps').textContent=over.opportunities;$('#k-leads').textContent=over.leads;$('#k-balance').textContent=money(over.balance_cents);$('#k-sent').textContent=over.posts_sent;$('#k-pending').textContent=over.pending_posts;
 $('#integrations').innerHTML=[['Bot configurado',status.bot_configured],['Proprietário identificado',status.owner_configured],['Webhook protegido',status.webhook_configured],['URL pública definida',status.public_url_configured]].map(([t,on])=>`<div><strong>${t}</strong><b style="color:${on?'#258b74':'#b87b2f'}">${on?'Configurado':'Pendente'}</b></div>`).join('');$('#integrations-pill').textContent=status.bot_configured?'Em configuração':'Sem bot';
 $('#notice').classList.toggle('show',!status.bot_configured);$('#notice').textContent=!status.bot_configured?'Modo local de preparação: configure um bot oficial antes de enviar mensagens ou coletar indicadores reais.':'';
 $('#recent-events').innerHTML=events.map(e=>item(e.event,e.details,new Date(e.created_at.replace(' ','T')+'Z').toLocaleDateString('pt-BR'))).join('')||empty('Nenhum evento registrado.');
 $('#list-groups').innerHTML=gs.map(g=>item(g.name,`ID interno ${g.id} · ${g.kind} · ${g.member_count} membros registrados`, `<span class="chip ${g.authorized?'green':'grey'}">${g.authorized?'AUTORIZADO':'CATÁLOGO'}</span>${g.url?`<p><a href="${safe(g.url)}" target="_blank" rel="noopener noreferrer">Abrir link</a></p>`:''}`)).join('')||empty('Nenhuma comunidade cadastrada.');
 $('#list-feeds').innerHTML=feeds.map(f=>item(f.name,f.url,`<span class="chip green">RSS ATIVO</span>`)).join('')||empty('Nenhuma fonte RSS adicionada.');
 $('#list-opportunities').innerHTML=op.map(o=>item(o.title,`${o.category} · ${o.status}${o.notes?' · '+o.notes:''}`,`<span class="chip">${o.score}/100</span>${o.source_url?`<p><a href="${safe(o.source_url)}" target="_blank" rel="noopener noreferrer">Fonte</a></p>`:''}<select class="pipeline" aria-label="Status da oportunidade" data-status-op="${o.id}">${['novo','analisando','contato_autorizado','negociacao','convertido','descartado'].map(v=>`<option value="${v}" ${o.status===v?'selected':''}>${v.replace('_',' ')}</option>`).join('')}</select>`)).join('')||empty('O radar ainda não tem oportunidades.');
 $('#list-leads').innerHTML=leads.map(l=>item(l.name,`${l.interest||'Sem interesse registrado'} · ${l.contact||'Sem contato'}`,`<select class="pipeline" aria-label="Etapa do lead" data-stage-lead="${l.id}">${['novo','qualificado','proposta','negociacao','ganho','perdido'].map(v=>`<option value="${v}" ${l.stage===v?'selected':''}>${v}</option>`).join('')}</select>`)).join('')||empty('Nenhum lead cadastrado.');
 $('#list-finance').innerHTML=finance.map(f=>item(f.description,`${f.type==='entrada'?'Receita':'Despesa'} · ${f.created_at.slice(0,10)}`,`<b style="color:${f.type==='entrada'?'#258b74':'#b83e54'}">${f.type==='saida'?'-':'+'}${money(f.amount_cents)}</b>`)).join('')||empty('Sem lançamentos financeiros.');
 $('#post-group').innerHTML=`<option value="">Selecione um grupo</option>`+gs.filter(g=>g.authorized&&g.active).map(g=>`<option value="${g.id}">${safe(g.name)}</option>`).join('');
 $('#list-posts').innerHTML=posts.map(p=>{let right=`<span class="chip ${p.status==='enviado'?'green':p.status==='rascunho'?'grey':'amber'}">${safe(p.status.toUpperCase())}</span><div class="actions">`;
 if(p.status==='rascunho')right+=`<button class="minor" data-action="approve" data-id="${p.id}">Aprovar</button><button class="minor danger" data-action="cancel" data-id="${p.id}">Cancelar</button>`;
 if(p.status==='aprovado')right+=`<button class="minor" data-action="publish" data-id="${p.id}">Publicar agora</button><button class="minor danger" data-action="cancel" data-id="${p.id}">Cancelar</button>`;
 right+='</div>';return item(p.body,`${p.group_name} · ${p.due_at?'Agendado: '+p.due_at:'Sem agendamento'}${p.error?' · '+p.error:''}`,right)}).join('')||empty('Nenhuma publicação criada.');
 $('#report-body').innerHTML=[['Comunidades cadastradas',report.groups],['Gerenciadas',report.managed_groups],['Leads registrados',report.leads],['Oportunidades',report.opportunities],['Posts enviados',report.posts_sent],['Posts pendentes',report.pending_posts],['Saldo registrado',money(report.balance_cents)]].map(([k,v])=>`<div class="report-stat"><span>${safe(k)}</span><b>${safe(v)}</b></div>`).join('');
}
all('.nav').forEach(n=>n.addEventListener('click',()=>nav(n.dataset.tab)));
$('#refresh').onclick=reload;
all('form[data-api]').forEach(f=>f.addEventListener('submit',async ev=>{ev.preventDefault();const btn=f.querySelector('button');btn.disabled=true;try{const d=Object.fromEntries(new FormData(f));if(f.dataset.api==='/api/posts'){if(d.local_due){d.due_at=new Date(d.local_due).toISOString()}delete d.local_due}await api(f.dataset.api,d);f.reset();toast('Registro salvo com sucesso.');await reload()}catch(e){toast(e.message)}finally{btn.disabled=false}}));
$('#list-posts').addEventListener('click',async ev=>{let b=ev.target.closest('[data-action]');if(!b)return;const action=b.dataset.action,id=b.dataset.id;let verb=action==='publish'?'PUBLICAR agora':action==='approve'?'APROVAR':'CANCELAR';if(!confirm(`${verb} a publicação #${id}?`))return;b.disabled=true;try{await api(`/api/posts/${id}/${action}`,{});toast('Ação executada com sucesso.');await reload()}catch(e){toast('Erro: '+e.message)}finally{b.disabled=false}});
$('#export-report').onclick=()=>{const data=JSON.stringify({generated_at:new Date().toISOString(),...cached.report},null,2);const url=URL.createObjectURL(new Blob([data],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='telegram-ops-relatorio.json';a.click();URL.revokeObjectURL(url)};
$('#date').textContent=new Date().toLocaleDateString('pt-BR',{day:'numeric',month:'long',year:'numeric'});
(async()=>{try{csrf=(await api('/api/session')).csrf;await reload()}catch(e){toast(e.message)}})();

async function pipelineChange(event, kind){
 const element=event.target.closest(kind==='lead'?'[data-stage-lead]':'[data-status-op]');
 if(!element)return;
 const id=kind==='lead'?element.dataset.stageLead:element.dataset.statusOp;
 const key=kind==='lead'?'stage':'status';
 const endpoint=kind==='lead'?`/api/leads/${id}/stage`:`/api/opportunities/${id}/status`;
 element.disabled=true;
 try{await api(endpoint,{[key]:element.value});toast('Etapa comercial atualizada.');await reload()}
 catch(e){toast('Erro: '+e.message);await reload()}
 finally{element.disabled=false}
}
$('#list-leads').addEventListener('change',e=>pipelineChange(e,'lead'));
$('#list-opportunities').addEventListener('change',e=>pipelineChange(e,'opportunity'));

$('#run-radar').addEventListener('click',async e=>{
 e.currentTarget.disabled=true;
 try{const r=await api('/api/radar/run',{});toast(`Pesquisa concluída: ${r.new} oportunidades novas, ${r.errors} fontes com falha.`);await reload()}
 catch(err){toast('Radar: '+err.message)}finally{e.currentTarget.disabled=false}
});

$('#s-campaigns').addEventListener('click', e=>{const b=e.target.closest('[data-copy]');if(b&&navigator.clipboard){navigator.clipboard.writeText(b.dataset.copy).then(()=>toast('Link copiado.')).catch(()=>toast('Copie o link pela tela.'))}});
$('#s-orders-list').addEventListener('change',async e=>{const b=e.target.closest('[data-sale-order]');if(!b)return;if(b.value==='pago_confirmado'&&!confirm('Você verificou pessoalmente o pagamento antes de confirmar?')){reload();return};try{await api(`/api/sales/orders/${b.dataset.saleOrder}/status`,{status:b.value});toast('Pedido atualizado.');await reload()}catch(err){toast(err.message);await reload()}});
$('#s-notices').addEventListener('click',async e=>{const b=e.target.closest('[data-notify-id]');if(!b)return;const id=b.dataset.notifyId;if(!confirm('Enviar este aviso SOMENTE aos inscritos que aceitaram /avisos? Até 20 mensagens serão enviadas agora.'))return;b.disabled=true;try{const r=await api(`/api/sales/notifications/${id}/send`,{confirm:true});toast(`Enviados: ${r.sent}. Falhas: ${r.failed}. Restantes: ${r.remaining}.`);await reload()}catch(err){toast(err.message)}finally{b.disabled=false}});