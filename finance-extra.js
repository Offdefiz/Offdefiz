(()=>{'use strict';
const $=s=>document.querySelector(s),status=$('#status'),items=$('#items'),summary=$('#summary');
let state=null,revision=0,role='';
const cash=c=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(c/100);
const el=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
const today=()=>new Date().toISOString().slice(0,10);
async function load(){
 try{
  const r=await fetch('/api/state',{credentials:'same-origin'}),d=await r.json();
  if(!r.ok)throw Error(d.error||'Entre no escritório para continuar.');
  state=d.data;revision=d.revision;role=d.user?.role||'';
  render();
 }catch(e){status.textContent=e.message;items.textContent='Acesso indisponível.';}
}
function render(){
 items.replaceChildren();summary.replaceChildren();
 const list=state.financeExtras||[],pending=list.filter(i=>!i.paidAt),paid=list.filter(i=>i.paidAt);
 for(const [name,value] of [['A receber',pending.reduce((a,i)=>a+i.amount,0)],['Baixados manualmente',paid.reduce((a,i)=>a+i.amount,0)],['Atrasados',pending.filter(i=>i.due<today()).reduce((a,i)=>a+i.amount,0)]]){
  const card=document.createElement('article');card.append(el('small',name),el('br',''),el('strong',cash(value)));summary.append(card);
 }
 if(!list.length)items.append(el('p','Nenhum lançamento adicional.'));
 for(const i of [...list].sort((a,b)=>a.due.localeCompare(b.due))){
  const row=document.createElement('div');row.className='row';const info=document.createElement('div');
  info.append(el('strong',i.description),el('p',i.kind+' · '+cash(i.amount)+' · vence '+i.due+' · '+(i.paidAt?'baixado em '+i.paidAt:'em aberto')));
  const button=el('button',i.paidAt?'Estornar':'Registrar pagamento');button.type='button';button.className=i.paidAt?'secondary':'';
  button.onclick=async()=>{
   if(i.paidAt){
    const reason=prompt('Justifique o estorno do registro fictício:');if(!reason?.trim())return;
    await action({operation:'undo',id:i.id,reason:reason.trim()});
   }else{
    const paidAt=prompt('Data do pagamento confirmado manualmente (AAAA-MM-DD):',today());if(!paidAt)return;
    await action({operation:'pay',id:i.id,paidAt});
   }
  };
  row.append(info,button);items.append(row);
 }
}
async function action(data){
 try{
  const r=await fetch('/api/action',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,role,action:'financeExtra',data})});
  const result=await r.json();if(!r.ok)throw Error(result.error||'Falha na gravação.');
  status.textContent='Lançamento registrado no histórico do escritório.';state=result.state;revision=result.revision;render();
 }catch(e){status.textContent=e.message;}
}
$('#create').onsubmit=e=>{
 e.preventDefault();const p=Object.fromEntries(new FormData(e.target));
 if(p.kind!=='mensalidade')p.months=1;
 p.requestId=crypto.randomUUID();action(p);
};
load();
})();