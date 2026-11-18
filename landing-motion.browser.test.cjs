'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const root = __dirname;
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.ico':'image/x-icon' };
const server = http.createServer(async (req,res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) { res.writeHead(200, {'content-type':'application/json'}); res.end('{"plans":[]}'); return; }
  const file = path.resolve(root, '.' + (url.pathname === '/' ? '/landing.html' : url.pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  try {
    const body = await fs.readFile(file);
    res.writeHead(200, {'content-type': mime[path.extname(file)] || 'application/octet-stream'});
    res.end(body);
  } catch { res.writeHead(404); res.end('Not found'); }
});
const listen = () => new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const close = () => new Promise(resolve => server.close(resolve));

test('Landing Partelís: desktop, mobile, contraste e movimento reduzido', async t => {
  await listen();
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({headless:true});
  try {
    await t.test('desktop: links, glass escuro, rolagem e interação', async () => {
      const page = await browser.newPage({viewport:{width:1365,height:900}});
      try {
        await page.goto(origin, {waitUntil:'load'});
        assert.equal(await page.locator('.hero-actions a').first().getAttribute('href'), '#planos');
        assert.equal(await page.locator('.hero-actions a').nth(1).getAttribute('href'), '/demo');
        assert.equal(await page.locator('#sales-form').count(), 1);
        const styles = await page.evaluate(() => {
          const get = s => getComputedStyle(document.querySelector(s));
          return {
            featuredBackground: get('.pricing-grid .plan.featured').backgroundImage,
            featuredText: get('.pricing-grid .plan.featured').color,
            contactBackground: get('.contact-box').backgroundImage,
            headerBlur: get('.site-header').backdropFilter,
          };
        });
        assert.match(styles.featuredBackground,/83,\s*42,\s*116/,'Plano em destaque deve continuar escuro');
        assert.match(styles.featuredText,/255,\s*255,\s*255/,'Texto do plano em destaque deve continuar branco');
        assert.match(styles.contactBackground,/79,\s*45,\s*105/,'Caixa de contato deve continuar escura');
        assert.notEqual(styles.headerBlur,'none','Header deve ter desfoque');
        const feature = page.locator('.feature-grid article').first();
        await feature.scrollIntoViewIfNeeded();
        await page.waitForFunction(() => document.querySelector('.feature-grid article').classList.contains('pt-in-view'));
        await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
        await page.waitForTimeout(150);
        const progress = await page.evaluate(() => Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pt-scroll')));
        assert.ok(progress > .3,'Progresso deve avançar com a rolagem');
        await page.locator('.visual').scrollIntoViewIfNeeded();
        const box = await page.locator('.visual').boundingBox();
        await page.mouse.move(box.x + box.width * .75,box.y + box.height * .25);
        const tilt = await page.locator('.visual').evaluate(el => el.style.getPropertyValue('--pt-tilt-x'));
        assert.notEqual(tilt,'','Desktop deve responder ao mouse');
        await page.screenshot({path:'motion-desktop.png',fullPage:true});
      } finally { await page.close(); }
    });
    await t.test('mobile touch: sem inclinação e sem rolagem horizontal', async () => {
      const context = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
      const page = await context.newPage();
      try {
        await page.goto(origin,{waitUntil:'load'});
        const metrics = await page.evaluate(() => ({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,transform:getComputedStyle(document.querySelector('.visual')).transform}));
        assert.ok(metrics.scrollWidth <= metrics.width + 1, 'Página não deve transbordar horizontalmente');
        assert.equal(metrics.transform,'none','Touch não deve inclinar o painel');
        await page.locator('#planos').scrollIntoViewIfNeeded();
        await page.screenshot({path:'motion-mobile.png',fullPage:true});
      } finally { await context.close(); }
    });
    await t.test('acessibilidade: prefers-reduced-motion desativa efeitos', async () => {
      const context = await browser.newContext({viewport:{width:1280,height:800},reducedMotion:'reduce'});
      const page = await context.newPage();
      try {
        await page.goto(origin,{waitUntil:'load'});
        const state = await page.evaluate(() => ({
          enabled:document.documentElement.classList.contains('pt-motion-ready'),
          opacity:getComputedStyle(document.querySelector('.feature-grid article')).opacity,
          progress:getComputedStyle(document.querySelector('.pt-scroll-progress')).display,
          behavior:getComputedStyle(document.documentElement).scrollBehavior
        }));
        assert.equal(state.enabled,false,'Revelações não devem ser ativadas');
        assert.equal(state.opacity,'1','Conteúdo não pode ficar invisível');
        assert.equal(state.progress,'none','Barra animada deve desaparecer');
        assert.equal(state.behavior,'auto','Rolagem suave deve ser desativada');
        await page.screenshot({path:'motion-reduced.png',fullPage:true});
      } finally { await context.close(); }
    });
  } finally { await browser.close(); await close(); }
});
