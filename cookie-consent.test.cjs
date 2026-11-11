'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const Cookie=require('./cookie-consent.js');
const {server}=require('./server.cjs');
const ms=86400000;
test('cookies opcionais começam desligados e a versão é invalidada corretamente',()=>{
 assert.equal(Cookie.VERSION,'2026-11-11.1');
 assert.equal(Cookie.parseCookie(''),null);
 assert.equal(Cookie.parseCookie('pt_cookie_consent=malformado'),null);
 assert.equal(Cookie.allowed('necessary'),true);
 assert.equal(Cookie.allowed('analytics'),false);
 assert.equal(Cookie.allowed('marketing'),false);
 const now=Date.UTC(2026,10,11,12);
 const v=Cookie.record({analytics:true,marketing:false},now);
 assert.equal(v.necessary,true);assert.equal(v.analytics,true);assert.equal(v.marketing,false);
 const raw=Cookie.NAME+'='+encodeURIComponent(JSON.stringify(v));
 assert.equal(Cookie.parseCookie(raw,now+ms).analytics,true);
 assert.equal(Cookie.parseCookie(raw,now+181*ms),null);
 const old={...v,version:'2026-10'};
 assert.equal(Cookie.parseCookie(Cookie.NAME+'='+encodeURIComponent(JSON.stringify(old)),now),null);
});
test('persistência por cookie first-party com 180 dias, SameSite e Secure em HTTPS',()=>{
 const c=Cookie.serialize({analytics:false,marketing:false});
 assert.match(c,/Max-Age=15552000/);assert.match(c,/Path=\//);
 assert.match(c,/SameSite=Lax/);assert.match(c,/; Secure/);
 assert.equal(Cookie.serialize({},false).includes('; Secure'),false);
 const parsed=Cookie.parseCookie(c.split(';')[0]);assert.deepEqual([parsed.analytics,parsed.marketing],[false,false]);
});
test('página comercial não carrega pixel, analytics ou fontes de terceiros sem consentimento',()=>{
 const html=fs.readFileSync('landing.html','utf8'),css=fs.readFileSync('landing.css','utf8');
 assert.match(html,/cookie-consent\.css/);assert.match(html,/cookie-consent\.js/);
 assert.match(html,/data-cookie-settings/);assert.match(html,/href="\/cookies"/);
 assert.doesNotMatch(html,/googletagmanager\.com|google-analytics\.com|connect\.facebook\.net|fbevents\.js/i);
 assert.doesNotMatch(css,/@import url\(['"]?https:\/\/fonts\.googleapis\.com/i);
});
test('consentimento em categorias separadas com opção de revogação',()=>{
 let cookie='',reloads=0,events=[],activated=0,cleaned=0;
 const doc={readyState:'loading',addEventListener(){},get cookie(){return cookie},set cookie(x){cookie=x.split(';')[0]}};
 const win={document:doc,location:{protocol:'https:',reload(){reloads++;}},dispatchEvent(e){events.push(e)},CustomEvent:class{constructor(type,detail){this.type=type;this.detail=detail}}};
 Cookie.init(win);
 const stop=Cookie.whenAllowed('analytics',()=>{activated++;return ()=>{cleaned++;}});
 assert.equal(activated,0);
 Cookie.choose({analytics:true,marketing:false});
 assert.equal(Cookie.allowed('analytics'),true);assert.equal(Cookie.allowed('marketing'),false);
 assert.equal(activated,1);assert.equal(cleaned,0);
 Cookie.choose({analytics:false,marketing:false});
 assert.equal(Cookie.allowed('analytics'),false);assert.equal(cleaned,1);
 assert.equal(reloads,1);assert.equal(events.length,2);
 stop();
});
test('páginas públicas, política, assets, sitemap e fronteiras de autenticação',async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 try{
  const cases=[['/cookies',/Política de Cookies/],['/privacidade',/cookie-consent\.js/],
   ['/',/cookie-consent\.js/],['/cookie-consent.js',/pt_cookie_consent/],
   ['/cookie-consent.css',/pt-cookie-banner/],['/sitemap.xml',/\/cookies/]];
  for(const [path,pattern] of cases){const response=await fetch(base+path);assert.equal(response.status,200,path);assert.match(await response.text(),pattern,path);}
  const priv=await fetch(base+'/cookies');assert.equal(priv.headers.get('x-robots-tag'),null);
  assert.equal((await fetch(base+'/admin')).status,401);
  assert.equal((await fetch(base+'/cookies-inexistente')).status,404);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
