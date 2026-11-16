'use strict';
const {readFileSync}=require('node:fs'),{join}=require('node:path');
const {pool}=require('./db.cjs');
async function ensure(){
 // Managed hosts can start the new revision without a migration command.
 // Normal VPS deployments already run the same migration before starting it.
 const {rows:[row]}=await pool.query("SELECT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass('cj_payment_orders') AND attname='invite_version' AND NOT attisdropped) AS ready");
 if(row.ready)return;
 const client=await pool.connect();
 try{await client.query(readFileSync(join(__dirname,'migrations','2026-11-16-commercial-reconciliation.sql'),'utf8'));}
 catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}
 finally{client.release();}
}
module.exports={ensure};
