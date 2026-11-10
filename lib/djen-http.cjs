'use strict';
const {cnjValid}=require('./legal-core.cjs');
const BASE='https://comunicaapi.pje.jus.br/api/v1/comunicacao';
function plain(s){return String(s||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,12000);}
function normalizeItem(x){
 const id=String(x.hash||x.id||'');
 const number=String(x.numero_processo||x.numeroProcesso||'').replace(/\D/g,'');
 const date=String(x.data_disponibilizacao||x.dataDisponibilizacao||'').slice(0,10);
 if(!/^[a-zA-Z0-9_-]{1,160}$/.test(id)||!cnjValid(number)||!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date)))throw Error('INVALID_RESPONSE');
 return {identifier:id,processNumber:number,date,summary:plain(x.texto),source:'djen',needsHumanReview:true,isFatal:false};
}
class DjenHttpAdapter{
 constructor({httpClient=fetch,maxPages=5}={}){this.httpClient=httpClient;this.maxPages=maxPages;}
 async query(filters){
  const result=[];
  for(let page=1;page<=this.maxPages;page++){
   const params=new URLSearchParams({...filters,pagina:String(page),itensPorPagina:'100'});
   const response=await this.httpClient(BASE+'?'+params,{signal:AbortSignal.timeout(15000),redirect:'error'});
   if(!response.ok)throw Error(response.status===429?'RATE_LIMITED':'REMOTE_UNAVAILABLE');
   const body=await response.json();
   if(!Array.isArray(body.items))throw Error('INVALID_RESPONSE');
   result.push(...body.items.map(normalizeItem));
   if(body.items.length<100)return {items:result,complete:true};
   if(page<this.maxPages)await new Promise(r=>setTimeout(r,1000));
  }
  return {items:result,complete:false};
 }
 async searchByNumber(number){
  const n=String(number).replace(/\D/g,'');if(!cnjValid(n))throw Error('INVALID_CNJ');
  return this.query({numeroProcesso:n});
 }
 async searchByOab({number,state}){
  if(!/^\d{1,10}$/.test(String(number))||!/^[A-Z]{2}$/.test(state))throw Error('INVALID_OAB');
  return this.query({numeroOab:String(number),ufOab:state});
 }
}
module.exports={DjenHttpAdapter,normalizeItem,plain};
