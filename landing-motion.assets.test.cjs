'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
test('Landing motion assets are linked, shipped and publicly allowlisted', () => {
  const html = fs.readFileSync(path.join(root,'landing.html'),'utf8');
  const server = fs.readFileSync(path.join(root,'server.cjs'),'utf8');
  const deploy = fs.readFileSync(path.join(root,'ops/check-deploy.cjs'),'utf8');
  for (const file of ['landing-motion.css','landing-motion.js']) {
    assert.ok(fs.statSync(path.join(root,file)).size > 0, file + ' missing');
    assert.ok(html.includes('/'+file+'?'), file + ' not referenced by landing');
    assert.ok(server.includes("'/"+file+"':'"+file+"'"), file + ' not served by public allowlist');
    assert.ok(deploy.includes("'"+file+"'"), file + ' missing from deploy checks');
  }
});
