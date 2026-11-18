'use strict';
// Serviço de contato direto. Sem distribuição de casos, comissões, ranking ou aconselhamento automático.
const {pool,fail}=require('./db.cjs');
const clean=(v,max)=>typeof v==='string'?v.trim().slice(0,max+1):'';
const slugOk=v=>v.length>=3&&v.length<=55&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v);
const subjects=new Set(['Cível','Família','Trabalhista','Consumidor','Empresarial','Previdenciário','Outro']);
const states=new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '));
const emailOk=v=>v.length<=254&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v);
const uuidOk=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const themes=new Set(['violeta','claro','escuro']);
const linkTypes=new Set(['whatsapp','instagram','linkedin','youtube','site','agenda','artigo','imprensa','email','outro']);
function validateLinks(input){
 if(!Array.isArray(input)||input.length>8)throw fail(400,'Adicione no máximo oito botões ao cartão.');
 return input.map((item)=>{
  if(!item||typeof item!=='object'||Array.isArray(item))throw fail(400,'Botão inválido.');
  const label=clean(item.label,48),type=clean(item.type,20),value=clean(item.url,600);
  if(label.length<2||label.length>48||!linkTypes.has(type)||value.length>600)
   throw fail(400,'Informe tipo, título e endereço válido para cada botão.');
  let url;
  try{url=new URL(value);}catch{throw fail(400,'Endereço de botão inválido.');}
  if(type==='email'){
   let address;
   try{address=decodeURIComponent(url.pathname);}catch{throw fail(400,'Endereço de e-mail inválido.');}
   if(url.protocol!=='mailto:'||!emailOk(address)||url.search||url.hash)
    throw fail(400,'O botão de e-mail deve conter mailto:email@dominio.com.');
  }else{
   const host=url.hostname.toLowerCase();
   if(url.protocol!=='https:'||url.username||url.password||url.port||
    !host.includes('.')||host==='localhost'||host.endsWith('.local')||
    /^\d+\.\d+\.\d+\.\d+$/.test(host)||host.includes('..')||
    /[\s<>]/.test(value))throw fail(400,'Use links HTTPS públicos e seguros.');
   const allowed={
    whatsapp:['wa.me','api.whatsapp.com'],instagram:['instagram.com','www.instagram.com'],
    linkedin:['linkedin.com','www.linkedin.com'],youtube:['youtube.com','www.youtube.com','youtu.be']
   };
   if(allowed[type]&&!allowed[type].includes(host))throw fail(400,'O endereço não corresponde ao tipo de botão.');
   if(type==='whatsapp'&&!(/^\/\d{10,15}$/.test(url.pathname)&&host==='wa.me'||host==='api.whatsapp.com'&&url.pathname==='/send'&&/^\d{10,15}$/.test(url.searchParams.get('phone')||'')))
    throw fail(400,'Informe um link de WhatsApp com telefone internacional.');
  }
  return {type,label,url:url.href};
 });
}
function validateDetails(input){
 if(input===undefined)return null;
 if(!input||typeof input!=='object'||Array.isArray(input))throw fail(400,'Confira os dados do cartão.');
 const headline=clean(input.headline,90),intro=clean(input.intro,160);
 const photo=input.photo||'';
 if(headline.length>90||intro.length>160)throw fail(400,'Confira o tamanho do subtítulo e da frase de abertura.');
 if(photo&&(typeof photo!=='string'||photo.length>160000||
  !/^data:image\/jpeg;base64,\/[A-Za-z0-9+/]+={0,2}$/.test(photo)))
  throw fail(400,'Use uma foto JPEG de até 120 KB após a compactação.');
 if(photo){
  const bytes=Buffer.from(photo.slice('data:image/jpeg;base64,'.length),'base64');
  if(bytes.length<4||bytes[0]!==255||bytes[1]!==216||bytes[2]!==255||bytes.at(-2)!==255||bytes.at(-1)!==217)
   throw fail(400,'A foto enviada não é um JPEG válido.');
 }
 return {headline,intro,photo};
}
function validateProfile(input){
 const slug=clean(input.slug,55).toLowerCase(),name=clean(input.professional_name,100),
  oab=clean(input.oab_registration,35).toUpperCase(),city=clean(input.city,100),
  state=clean(input.state,2).toUpperCase(),presentation=clean(input.presentation||'',400),theme=clean(input.theme||'violeta',12),links=validateLinks(input.links||[]);
 const areas=Array.isArray(input.areas)?input.areas.map(v=>clean(v,50)):[];
 if(!slugOk(slug)||name.length<3||name.length>100||!/^OAB\/[A-Z]{2}\s*\d{3,9}$/.test(oab)||
  city.length<2||city.length>100||!states.has(state)||areas.length>5||
  areas.some(v=>!v||v.length>50||/[\u0000-\u001f\u007f]/.test(v))||new Set(areas).size!==areas.length||presentation.length>400||!themes.has(theme))
  throw fail(400,'Revise endereço do perfil, nome, OAB/UF, localidade e áreas de atuação.');
 if(input.published===true&&input.ethical_attestation!==true)
  throw fail(400,'Confirme a declaração de responsabilidade ética antes de publicar.');
 return {slug,name,oab,city,state,areas,presentation,theme,links,details:validateDetails(input.card_details),published:input.published===true,attested:input.ethical_attestation===true};
}
function validateRequest(input){
 if(clean(input.website||'',200))return null; // honeypot
 const name=clean(input.name,100),email=clean(input.email,254).toLowerCase(),
 phone=clean(input.phone||'',35),subject=clean(input.subject,50);
 if(name.length<2||name.length>100||!emailOk(email)||phone.length>35||
  (phone&&!/^[+\d()\s-]{7,35}$/.test(phone))||!subjects.has(subject)||input.consent!==true)
  throw fail(400,'Informe nome, e-mail, assunto e autorize o contato.');
 return {name,email,phone,subject};
}
function service(db=pool){
 async function ownProfile(workspace){
  const r=await db.query('SELECT slug,professional_name,oab_registration,city,state,areas,presentation,theme,links,card_details,published,updated_at FROM cj_connection_profiles WHERE workspace_id=$1',[workspace]);
  return r.rows[0]||null;
 }
 async function saveProfile(workspace,input){
  const p=validateProfile(input);
  try{
   const r=await db.query(`INSERT INTO cj_connection_profiles(workspace_id,slug,professional_name,oab_registration,city,state,areas,presentation,theme,links,published,ethical_attestation_at,card_details)
     VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10::jsonb,$11,CASE WHEN $12 THEN now() ELSE NULL END,coalesce($13::jsonb,'{}'::jsonb))
     ON CONFLICT(workspace_id) DO UPDATE SET slug=excluded.slug,professional_name=excluded.professional_name,
     oab_registration=excluded.oab_registration,city=excluded.city,state=excluded.state,areas=excluded.areas,
     presentation=excluded.presentation,theme=excluded.theme,links=excluded.links,published=excluded.published,
     ethical_attestation_at=CASE WHEN $12 THEN coalesce(cj_connection_profiles.ethical_attestation_at,now()) ELSE cj_connection_profiles.ethical_attestation_at END,
     card_details=coalesce($13::jsonb,cj_connection_profiles.card_details),updated_at=now()
     RETURNING slug,professional_name,oab_registration,city,state,areas,presentation,theme,links,card_details,published,updated_at`,
     [workspace,p.slug,p.name,p.oab,p.city,p.state,JSON.stringify(p.areas),p.presentation,p.theme,JSON.stringify(p.links),p.published,p.attested,p.details&&JSON.stringify(p.details)]);
   return r.rows[0];
  }catch(e){if(e.code==='23505')throw fail(409,'Esse endereço já pertence a outro perfil. Escolha outro.');throw e;}
 }
 async function publicProfile(slug){
  if(!slugOk(slug))throw fail(404,'Perfil não encontrado.');
  const r=await db.query('SELECT slug,professional_name,oab_registration,city,state,areas,presentation,theme,links,card_details FROM cj_connection_profiles WHERE slug=$1 AND published=true',[slug]);
  if(!r.rows[0])throw fail(404,'Perfil não encontrado.');
  return r.rows[0];
 }
 async function request(slug,input){
  if(!slugOk(slug))throw fail(404,'Perfil não encontrado.');
  const p=validateRequest(input);
  if(!p)return {ok:true};
  const r=await db.query(`INSERT INTO cj_connection_requests(workspace_id,name,email,phone,subject)
   SELECT workspace_id,$2,$3,$4,$5 FROM cj_connection_profiles
   WHERE slug=$1 AND published=true RETURNING id`,[slug,p.name,p.email,p.phone,p.subject]);
  if(!r.rowCount)throw fail(404,'Este perfil não está disponível.');
  return {ok:true};
 }
 async function inbox(workspace){
  const r=await db.query('SELECT id,name,email,phone,subject,status,created_at FROM cj_connection_requests WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 150',[workspace]);
  return r.rows;
 }
 async function setStatus(workspace,input){
  if(!uuidOk(input.id)||!['new','contacted','closed'].includes(input.status))throw fail(400,'Solicitação ou etapa inválida.');
  const r=await db.query('UPDATE cj_connection_requests SET status=$3,updated_at=now() WHERE workspace_id=$1 AND id=$2 RETURNING id,status',[workspace,input.id,input.status]);
  if(!r.rowCount)throw fail(404,'Solicitação não encontrada.');
  return r.rows[0];
 }
 return {ownProfile,saveProfile,publicProfile,request,inbox,setStatus};
}
module.exports={service,validateProfile,validateLinks,validateRequest,slugOk};
