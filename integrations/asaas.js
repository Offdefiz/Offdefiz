'use strict';
// Backend-only Asaas client. Never expose ASAAS_API_KEY to browser.
const API={sandbox:'https://api-sandbox.asaas.com/v3',production:'https://api.asaas.com/v3'};
function createAsaasClient({apiKey=process.env.ASAAS_API_KEY,environment=process.env.ASAAS_ENV||'sandbox'}={}){
 if(!API[environment])throw Error('Ambiente Asaas inválido');
 if(!apiKey)throw Error('Configure ASAAS_API_KEY no servidor.');
 async function call(method,resource,payload){
  if(!/^\/(customers|payments)(\/|\?|$)/.test(resource))throw Error('Recurso Asaas não permitido.');
  const response=await fetch(API[environment]+resource,{method,headers:{'access_token':apiKey,'Content-Type':'application/json','User-Agent':'CaixaJuridico/0.1'},body:payload?JSON.stringify(payload):undefined});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){const error=new Error('Falha na operação Asaas.');error.status=response.status;throw error;}
  return data;
 }
 return Object.freeze({
  createCustomer:({name,cpfCnpj,email,mobilePhone})=>call('POST','/customers',{name,cpfCnpj,email,mobilePhone}),
  createPayment:({customer,billingType,value,dueDate,description,externalReference,installmentCount,installmentValue})=>{
   if(!['PIX','BOLETO','CREDIT_CARD','UNDEFINED'].includes(billingType))throw Error('Método de pagamento inválido');
   if(!(Number(value)>0)||!/^\d{4}-\d{2}-\d{2}$/.test(dueDate))throw Error('Valor ou vencimento inválido');
   return call('POST','/payments',{customer,billingType,value,dueDate,description,externalReference,...(installmentCount?{installmentCount,installmentValue}:{})});
  },
  getPayment:id=>{if(!/^pay_[\w-]+$/.test(id))throw Error('ID inválido');return call('GET','/payments/'+encodeURIComponent(id));},
 });
}
function verifyWebhookToken(received,expected=process.env.ASAAS_WEBHOOK_TOKEN){
 const crypto=require('node:crypto');
 if(!received||!expected)return false;
 const a=Buffer.from(String(received)),b=Buffer.from(String(expected));
 return a.length===b.length&&crypto.timingSafeEqual(a,b);
}
module.exports={createAsaasClient,verifyWebhookToken};
