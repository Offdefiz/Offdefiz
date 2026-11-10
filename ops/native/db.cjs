const { Pool } = require('pg');
const pool = new Pool({host:'/var/run/postgresql',database:process.env.PGDATABASE || 'partelis',max:10});
const fail = (status,message) => Object.assign(new Error(message),{status});
async function transaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {client.release();}
}
module.exports={pool,transaction,fail};
