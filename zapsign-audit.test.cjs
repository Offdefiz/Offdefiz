'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
test('auditor de DOCX detecta arquivos ausentes, versões divergentes, runs fragmentados e incompatibilidades',()=>{
  const r=spawnSync('python3',['scripts/test_zapsign_audit.py'],{encoding:'utf8'});
  assert.equal(r.status,0,r.error?.message||r.stderr);
});
test('relatório de fontes permanece vinculado ao catálogo, sem alegar validação sandbox',()=>{
  const report=require('./docs/zapsign-source-audit.json');
  const fs=require('node:fs'),crypto=require('node:crypto');
  assert.equal(report.catalog_sha256,crypto.createHash('sha256').update(fs.readFileSync('zapsign-formularios.json')).digest('hex'));
  const forms=require('./zapsign-formularios.json');
  assert.deepEqual(report.models.map(m=>m.arquivo),forms.map(m=>m.arquivo));
  assert.equal(report.production_enabled,false);assert.equal(report.source_audit_ok,false);
  assert.equal(report.models.filter(m=>m.status==='audited').length,11);
  assert.ok(report.models.every(m=>m.sandbox==='pending'));
});
