// Run as the service account in the private VPS console. Links are bearer credentials.
const {pool,transaction}=require('./db.cjs');
const {token,digest}=require('./auth.cjs');
async function provision(email,name){
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!name)throw Error('Informe e-mail e nome do escritório.');
  const secret=token();
  await transaction(async client=>{
    const {rows:[user]}=await client.query('INSERT INTO native_users(email) VALUES(lower($1)) ON CONFLICT(email) DO UPDATE SET email=excluded.email RETURNING id',[email]);
    const member=await client.query('SELECT 1 FROM cj_memberships WHERE user_id=$1',[user.id]);
    if(!member.rowCount){
      const {rows:[space]}=await client.query('INSERT INTO cj_workspaces(name) VALUES($1) RETURNING id',[name]);
      const state={schema:1,clients:[],debts:[],opportunities:[],meetings:[],proposals:[],contracts:[],installments:[],cases:[],tasks:[],audit:[]};
      await client.query("INSERT INTO cj_memberships VALUES($1,$2,'gestor')",[user.id,space.id]);
      await client.query('INSERT INTO cj_state(workspace_id,data) VALUES($1,$2)',[space.id,state]);
      await client.query('INSERT INTO cj_admin_tenants(workspace_id,name) VALUES($1,$2)',[space.id,name]);
    }
    await client.query("INSERT INTO native_invites VALUES($1,$2,now()+interval '30 minutes') ON CONFLICT(user_id) DO UPDATE SET token_hash=excluded.token_hash,expires_at=excluded.expires_at",[digest(secret),user.id]);
  });
  return secret;
}
if(require.main===module)provision(...process.argv.slice(2)).then(secret=>console.log('https://partelis.com.br/ativar#token_hash='+secret)).catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>pool.end());
module.exports={provision};
