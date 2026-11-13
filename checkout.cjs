'use strict';
const PLANS=Object.freeze({solo:{name:'Solo',price:59,users:1},escritorio:{name:'Escritório',price:119,users:5},equipe:{name:'Equipe',price:199,users:12}});
const METHODS=['pix','card'];
function paymentUrl(plan,method,env=process.env){
 if(!Object.hasOwn(PLANS,plan)||!METHODS.includes(method))return null;
 const value=env['PARTELIS_CHECKOUT_'+plan.toUpperCase()+'_'+method.toUpperCase()];
 if(!value)return null;
 try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port)return null;
 const hosts=['www.asaas.com','asaas.com','www.mercadopago.com.br','mercadopago.com.br','mpago.la','buy.stripe.com','checkout.stripe.com','pag.ae','pagseguro.uol.com.br','www.pagseguro.uol.com.br'];
 return hosts.includes(u.hostname)?u.href:null;}catch{return null;}
}
function catalog(env=process.env){return Object.entries(PLANS).map(([id,p])=>({id,...p,methods:Object.fromEntries(METHODS.map(m=>[m,!!paymentUrl(id,m,env)]))}));}
module.exports={PLANS,paymentUrl,catalog};
