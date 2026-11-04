(()=>{'use strict';
if(!window.CLOUD||!window.fetch)return;
let last=0;
async function pulse(){
 if(document.visibilityState!=='visible'||Date.now()-last<60000)return;
 try{
  const response=await fetch('/api/presence',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'});
  if(response.ok)last=Date.now();
 }catch{/* Presença é indicador aproximado, nunca condição para trabalho jurídico. */}
}
pulse();document.addEventListener('visibilitychange',pulse);
const timer=setInterval(pulse,75000);
window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
})();