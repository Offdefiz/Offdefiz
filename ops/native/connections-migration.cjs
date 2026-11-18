'use strict';

const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {pool} = require('./db.cjs');

async function ensure() {
 const {rows:[{ready}]} = await pool.query(
  "SELECT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass('cj_connection_profiles') AND attname='card_details' AND NOT attisdropped) AND to_regclass('cj_connection_requests') IS NOT NULL AS ready"
 );
 if (ready) return;
 const sql = readFileSync(join(__dirname, 'migrations', '2026-11-18-conexoes.sql'), 'utf8');
 const client = await pool.connect();
 try {
  await client.query(sql);
 } catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  throw error;
 } finally {
  client.release();
 }
}

module.exports = {ensure};
