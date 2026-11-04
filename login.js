'use strict';
const password=document.querySelector('#password');
document.querySelector('#showPassword').onclick=()=>{const visible=password.type==='password';password.type=visible?'text':'password';document.querySelector('#showPassword').textContent=visible?'Ocultar':'Mostrar';};
document.querySelector('#loginForm').onsubmit=async e=>{
  e.preventDefault();
  const button=document.querySelector('#enter'),error=document.querySelector('#loginError');
  button.disabled=true;error.textContent='';
  try{
    const r=await fetch('/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});
    const d=await r.json();if(!r.ok)throw Error(d.error||'Não foi possível entrar.');
    location.replace('/app');
  }catch(err){error.textContent=err.message}
  finally{button.disabled=false}
};
