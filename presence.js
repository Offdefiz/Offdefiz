(()=>{'use strict';
if(!window.CLOUD)return;
let last=0;
async function ping(){
 if(document.visibilityState==='hidden'||Date.now()-last<75000)return;
 last=Date.now();
 try{await fetch('/api/activity/ping',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'});}catch{}
}
window.addEventListener('focus',ping);
document.addEventListener('visibilitychange',ping);
setInterval(ping,90000);
ping();
})();