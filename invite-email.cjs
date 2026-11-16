'use strict';
const {createHmac}=require('node:crypto');
function configured(env=process.env){
 return !!env.PARTELIS_EMAIL_API_KEY?.trim() && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(env.PARTELIS_EMAIL_FROM||'');
}
function inviteToken(version,env=process.env){
 return createHmac('sha256',env.PARTELIS_EMAIL_API_KEY.trim()).update('partelis/activation/v1/'+version).digest('hex');
}
async function sendInvite({email,url,version},{env=process.env,fetcher=fetch}={}){
 if(!configured(env))throw Error('Remetente ainda não configurado.');
 const r=await fetcher('https://api.resend.com/emails',{
  method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),
  headers:{Authorization:'Bearer '+env.PARTELIS_EMAIL_API_KEY.trim(),'Content-Type':'application/json','Idempotency-Key':'partelis-invite/'+version},
  body:JSON.stringify({from:'Partelís <'+env.PARTELIS_EMAIL_FROM+'>',to:[email],subject:'Seu acesso ao Partelís está pronto',
   text:'O pagamento foi confirmado. Use o link pessoal abaixo para criar sua senha e ativar o escritório no Partelís. O link vale por 48 horas e só pode ser usado uma vez.\n\n'+url+'\n\nSe você não esperava este convite, ignore a mensagem.'})
 });
 if(!r.ok)throw Error('O provedor não aceitou o envio.');
 return true;
}
module.exports={configured,inviteToken,sendInvite};
