const {randomBytes,createHash,scrypt,timingSafeEqual}=require('node:crypto');
const derive=require('node:util').promisify(scrypt);
const {pool,transaction,fail}=require('./db.cjs');
const token=()=>randomBytes(32).toString('hex');
const digest=value=>createHash('sha256').update(String(value||'')).digest('hex');
const invalid=()=>fail(401,'Credencial inválida ou expirada.');
async function issue(client,userId){
  const access=token(),refresh=token();
  await client.query('INSERT INTO native_sessions(access_hash,refresh_hash,user_id) VALUES($1,$2,$3)',[digest(access),digest(refresh),userId]);
  const {rows:[user]}=await client.query('SELECT id,email,email_confirmed_at FROM native_users WHERE id=$1',[userId]);
  return {access_token:access,refresh_token:refresh,user};
}
async function identify(access,client=pool){
  const {rows:[user]}=await client.query("SELECT u.id,u.email,u.email_confirmed_at FROM native_users u JOIN native_sessions s ON s.user_id=u.id WHERE s.access_hash=$1 AND s.issued_at>now()-interval '1 hour'",[digest(access)]);
  if(!user)throw invalid();
  return user;
}
async function auth(route,{token:access,body={},method='GET'}){
  if(route==='/auth/v1/user' && method==='GET')return identify(access);
  if(route.endsWith('grant_type=password')){
    if(typeof body.email!=='string'||typeof body.password!=='string'||body.password.length>512)throw invalid();
    const {rows:[user]}=await pool.query('SELECT id,password_hash FROM native_users WHERE email=$1 AND email_confirmed_at IS NOT NULL',[body.email.trim().toLowerCase()]);
    const [salt,hash]=(user?.password_hash||'00000000000000000000000000000000:'+ '0'.repeat(128)).split(':');
    const derived=await derive(body.password,salt,64);
    if(!timingSafeEqual(derived,Buffer.from(hash,'hex'))||!user?.password_hash)throw invalid();
    return transaction(client=>issue(client,user.id));
  }
  if(route.endsWith('grant_type=refresh_token'))return transaction(async client=>{
    const {rows:[row]}=await client.query("DELETE FROM native_sessions WHERE refresh_hash=$1 AND issued_at>now()-interval '7 days' RETURNING user_id",[digest(body.refresh_token)]);
    if(!row)throw invalid();
    return issue(client,row.user_id);
  });
  if(route==='/auth/v1/verify')return transaction(async client=>{
    const {rows:[invite]}=await client.query('DELETE FROM native_invites WHERE token_hash=$1 AND expires_at>now() RETURNING user_id',[digest(body.token_hash)]);
    if(!invite)throw invalid();
    await client.query('UPDATE native_users SET email_confirmed_at=now() WHERE id=$1',[invite.user_id]);
    return issue(client,invite.user_id);
  });
  if(route==='/auth/v1/user'&&method==='PUT'){
    if(typeof body.password!=='string'||body.password.length<8||body.password.length>512)throw fail(400,'Use entre 8 e 512 caracteres.');
    const salt=randomBytes(16).toString('hex'),hash=(await derive(body.password,salt,64)).toString('hex');
    return transaction(async client=>{
      const user=await identify(access,client);
      await client.query('UPDATE native_users SET password_hash=$1 WHERE id=$2',[salt+':'+hash,user.id]);
      await client.query('DELETE FROM native_sessions WHERE user_id=$1 AND access_hash<>$2',[user.id,digest(access)]);
    });
  }
  if(route==='/auth/v1/logout'){await pool.query('DELETE FROM native_sessions WHERE access_hash=$1 OR refresh_hash=$2',[digest(access),digest(body.refresh_token)]);return;}
  throw fail(403,'Solicite seu link pessoal de ativação ao administrador.');
}
module.exports={auth,identify,token,digest};
