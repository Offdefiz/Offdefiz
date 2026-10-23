'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {Pool}=require('pg');
const PORT=Number(process.env.PORT||3000),ROOT=path.join(__dirname,'public'),PROD=process.env.NODE_ENV==='production';
const admins=[[process.env.ADMIN_USER,process.env.ADMIN_PASSWORD],[process.env.ADMIN2_USER,process.env.ADMIN2_PASSWORD]].filter(([u,p])=>u&&p&&p.length>=12);
const SESSION_SECRET=process.env.SESSION_SECRET||crypto.randomBytes(32).toString('hex');
const pool=process.env.DATABASE_URL?new Pool({connectionString:process.env.DATABASE_URL,max:3,connectionTimeoutMillis:10000,idleTimeoutMillis:20000}):null;
let dbReady=false;
async function initDb(){if(!pool)return;try{
  await pool.query("CREATE TABLE IF NOT EXISTS halloween_2026_respostas (id BIGSERIAL PRIMARY KEY, idempotency VARCHAR(70) UNIQUE NOT NULL, nome VARCHAR(100) NOT NULL, whatsapp VARCHAR(25), presenca VARCHAR(10) NOT NULL, acompanhante SMALLINT DEFAULT 0, resposta JSONB NOT NULL, enviado_em TIMESTAMPTZ NOT NULL DEFAULT NOW())");
  dbReady=true;console.log('Database ready');
 }catch(e){console.error('Database initialization failed:',e.message);dbReady=false}}
initDb();
const send=(res,status,obj,h={})=>{const isText=typeof obj==='string';res.writeHead(status,{'content-type':isText?'text/plain; charset=utf-8':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...h});res.end(isText?obj:JSON.stringify(obj))};
const error=(res,status,msg)=>send(res,status,{error:msg});
function body(req){return new Promise((resolve,reject)=>{let all='';req.on('data',chunk=>{all+=chunk;if(all.length>30000){reject(Error('Resposta muito extensa'));req.destroy()}});req.on('end',()=>{try{resolve(JSON.parse(all))}catch{reject(Error('Dados invalidos'))}});req.on('error',reject)})}
const tidy=(s,n=100)=>typeof s==='string'?s.trim().slice(0,n):'';
const one=(s,vals)=>typeof s==='string'&&vals.includes(s)?s:null;
const array=(v,vals)=>Array.isArray(v)?[...new Set(v.filter(x=>typeof x==='string'&&vals.includes(x)))]:[];
function check(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.website)throw Error('Resposta invalida');
 const nome=tidy(raw.nome,100),whatsapp=tidy(raw.whatsapp,25),presenca=one(raw.presenca,['sim','talvez','nao']),key=tidy(raw.idempotency,70);
 if(nome.length<2)throw Error('Digite seu nome.');if(!presenca)throw Error('Escolha a sua disponibilidade.');
 if(whatsapp&&!/^\+?[\d\s()\-]{8,25}$/.test(whatsapp))throw Error('Confira o WhatsApp.');
 if(raw.aceite!==true)throw Error('Autorize o uso das respostas apenas para organizar a festa.');
 if(!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(key))throw Error('Recarregue a pagina e tente novamente.');
 const going=presenca!=='nao';
 const r={idempotency:key,nome,whatsapp,presenca,acompanhante:going&&raw.acompanhante===1?1:0,contribuicao:going?one(raw.contribuicao,['ate20','21a35','36a50','51a80','acima80','itens']):null,itens:going?array(raw.itens,['pix','comida','bebida','misto','depende']):[],bebidas:going?array(raw.bebidas,['cerveja','drinks','destilados','vinho','semalcool']):[],alcool:going?one(raw.alcool,['cadaum','coletiva','misto']):null,comida:going?one(raw.comida,['petiscos','pizza','churrasco','doces','indiferente']):null,restricao:going?tidy(raw.restricao,300):'',prioridade:going?one(raw.prioridade,['economia','bebidas','comida','decoracao','ambiente']):null,fantasia:going?one(raw.fantasia,['completa','acessorios','sem']):null,compromisso:going?one(raw.compromisso,['sim','avaliar','nao']):null,aceite:true};
 if(going&&(!r.contribuicao||!r.alcool||!r.comida||!r.prioridade||!r.fantasia||!r.compromisso))throw Error('Complete as perguntas obrigatorias.');
 return r
}
const history=new Map();
function limit(req,route,max,period){const k=route+':'+(req.headers['x-forwarded-for']||req.socket.remoteAddress||'none').split(',')[0].trim(),now=Date.now(),v=(history.get(k)||[]).filter(x=>x>now-period);v.push(now);history.set(k,v);return v.length<=max}
function originOk(req){if(!req.headers.origin)return true;try{return new URL(req.headers.origin).host===req.headers.host}catch{return false}}
function hmac(s){return crypto.createHmac('sha256',SESSION_SECRET).update(s).digest('base64url')}
function constant(a,b){const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&crypto.timingSafeEqual(x,y)}
function makeToken(u){const payload=Buffer.from(JSON.stringify({u,expires:Date.now()+36000000})).toString('base64url');return payload+'.'+hmac(payload)}
function signedIn(req){const found=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('h2026='));if(!found)return null;const token=found.slice(6).split('.');if(token.length!==2||!constant(token[1],hmac(token[0])))return null;try{const data=JSON.parse(Buffer.from(token[0],'base64url').toString('utf8'));return data.expires>Date.now()&&admins.some(a=>a[0]===data.u)?data.u:null}catch{return null}}
function insist(req,res){if(!signedIn(req)){error(res,401,'Area exclusiva dos organizadores.');return false}return true}
const labels=['nome','whatsapp','presenca','acompanhante','contribuicao','itens','bebidas','alcool','comida','restricao','prioridade','fantasia','compromisso','enviado_em'];
async function allRows(){const q=await pool.query('SELECT id,nome,whatsapp,presenca,acompanhante,resposta,enviado_em FROM halloween_2026_respostas ORDER BY id DESC LIMIT 2000');return q.rows.map(x=>({id:Number(x.id),...x.resposta,nome:x.nome,whatsapp:x.whatsapp,presenca:x.presenca,acompanhante:x.acompanhante,enviado_em:new Date(x.enviado_em).toISOString()}))}
function summary(rows){const counts={sim:0,talvez:0,nao:0},faixas={},bebidas={},comidas={},compromissos={};let pessoasPrevistas=0;for(const r of rows){counts[r.presenca]++;if(r.presenca==='sim')pessoasPrevistas+=1+r.acompanhante;if(r.contribuicao)faixas[r.contribuicao]=(faixas[r.contribuicao]||0)+1;if(r.comida)comidas[r.comida]=(comidas[r.comida]||0)+1;if(r.compromisso)compromissos[r.compromisso]=(compromissos[r.compromisso]||0)+1;for(const x of r.bebidas||[])bebidas[x]=(bebidas[x]||0)+1}return {total:rows.length,counts,pessoasPrevistas,capacidade:27,faixas,bebidas,comidas,compromissos,recebidosEmDinheiro:0,rows}}
function sanitizeCSV(x){const s=String(x??'');return /^\s*[=+@\-\t\r]/.test(s)?"'"+s:s}
function csv(rows){return '\uFEFF'+labels.join(';')+'\n'+rows.map(r=>labels.map(k=>'"'+sanitizeCSV(Array.isArray(r[k])?r[k].join(' | '):r[k]).replaceAll('"','""')+'"').join(';')).join('\n')}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
async function handler(req,res){
 res.setHeader('x-content-type-options','nosniff');res.setHeader('x-frame-options','DENY');res.setHeader('referrer-policy','strict-origin-when-cross-origin');
 const u=new URL(req.url,'http://local'),p=u.pathname;
 if(req.method==='GET'&&p==='/api/health')return send(res,dbReady?200:503,{ok:dbReady,database:dbReady?'PostgreSQL':'nao conectado'});
 if(req.method==='POST'&&p==='/api/votos'){
   if(!originOk(req))return error(res,403,'Origem nao autorizada');if(!limit(req,'votos',45,3600000))return error(res,429,'Muitas tentativas');if(!dbReady)return error(res,503,'Banco em configuracao. Tente novamente mais tarde.');
   try{const r=check(await body(req));const q=await pool.query('INSERT INTO halloween_2026_respostas (idempotency,nome,whatsapp,presenca,acompanhante,resposta) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (idempotency) DO NOTHING RETURNING id',[r.idempotency,r.nome,r.whatsapp,r.presenca,r.acompanhante,r]);return send(res,q.rowCount?201:200,{ok:true,duplicado:!q.rowCount,message:q.rowCount?'Resposta registrada!':'Resposta ja registrada!'})}catch(e){return error(res,400,e.message||'Erro ao enviar')}
 }
 if(req.method==='POST'&&p==='/api/admin/login'){
   if(!originOk(req))return error(res,403,'Origem recusada');if(!limit(req,'login',12,900000))return error(res,429,'Muitas tentativas');if(!admins.length)return error(res,503,'Acesso ainda nao configurado');
   try{const r=await body(req),found=admins.find(([u,p])=>u===tidy(r.username)&&constant(crypto.createHash('sha256').update(tidy(r.password,300)).digest('hex'),crypto.createHash('sha256').update(p).digest('hex')));if(!found)return error(res,401,'Credenciais invalidas');return send(res,200,{ok:true,username:found[0]},{'set-cookie':'h2026='+makeToken(found[0])+'; Path=/; HttpOnly; SameSite=Strict; Max-Age=36000'+(PROD?'; Secure':'')})}catch(e){return error(res,400,'Dados invalidos')}
 }
 if(req.method==='GET'&&p==='/api/admin/me')return send(res,200,{authenticated:!!signedIn(req),username:signedIn(req)});
 if(req.method==='POST'&&p==='/api/admin/logout'){if(!originOk(req))return error(res,403,'Origem recusada');return send(res,200,{ok:true},{'set-cookie':'h2026=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'+(PROD?'; Secure':'')})}
 if(req.method==='GET'&&p==='/api/admin/dados'){if(!insist(req,res))return;if(!dbReady)return error(res,503,'Banco indisponivel');return send(res,200,summary(await allRows()))}
 if(req.method==='GET'&&p==='/api/admin/exportar'){if(!insist(req,res))return;if(!dbReady)return error(res,503,'Banco indisponivel');res.writeHead(200,{'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename="halloween-2026-votos.csv"','cache-control':'no-store'});return res.end(csv(await allRows()))}
 if(req.method!=='GET'&&req.method!=='HEAD')return error(res,405,'Metodo nao permitido');
 let requested=p==='/'?'index.html':p==='/admin'?'admin.html':p.slice(1);const file=path.resolve(ROOT,requested);
 if(!file.startsWith(ROOT+path.sep))return error(res,403,'Acesso negado');
 try{const st=fs.statSync(file);if(!st.isFile())return error(res,404,'Nao encontrado');res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'public,max-age=120'});fs.createReadStream(file).pipe(res)}catch{return error(res,404,'Nao encontrado')}
}
http.createServer((req,res)=>handler(req,res).catch(e=>{console.error('Erro de rota:',e.message);if(!res.headersSent)error(res,500,'Erro interno')})).listen(PORT,'0.0.0.0',()=>console.log('Halloween website on',PORT));
