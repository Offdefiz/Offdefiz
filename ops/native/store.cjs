const {pool,fail}=require('./db.cjs');
const {auth,identify}=require('./auth.cjs');
const invalid=()=>fail(400,'Operação inválida.');
async function tenant(route,options={}){
  if(route.startsWith('/auth/v1/'))return auth(route,options);
  const {token,body={},method='GET'}=options;
  const user=await identify(token);
  const {pathname,searchParams}=new URL(route,'http://local');
  if(pathname==='/rest/v1/cj_memberships'&&method==='GET')
    return (await pool.query(
      "SELECT m.workspace_id,m.role FROM cj_memberships m "+
      "LEFT JOIN cj_admin_tenants t ON t.workspace_id=m.workspace_id "+
      "WHERE m.user_id=$1 AND coalesce(t.status,'active') NOT IN ('suspended','cancelled')",
      [user.id]
    )).rows;
  if(pathname==='/rest/v1/cj_user_profiles'){
    if(method==='GET')return (await pool.query('SELECT display_name,avatar_data,updated_at FROM cj_user_profiles WHERE user_id=$1',[user.id])).rows;
    if(method==='POST')return (await pool.query('INSERT INTO cj_user_profiles VALUES($1,$2,$3,now()) ON CONFLICT(user_id) DO UPDATE SET display_name=excluded.display_name, avatar_data=excluded.avatar_data, updated_at=now() RETURNING display_name,avatar_data,updated_at',[user.id,body.display_name,body.avatar_data])).rows;
  }
  if(pathname==='/rest/v1/cj_state'){
    const workspace=searchParams.get('workspace_id')?.slice(3);
    const member='EXISTS (SELECT 1 FROM cj_memberships m WHERE m.user_id=$1 AND m.workspace_id=s.workspace_id)';
    if(method==='GET')return (await pool.query('SELECT revision,data,theme FROM cj_state s WHERE workspace_id=$2 AND '+member,[user.id,workspace])).rows;
    if(method==='PATCH'){
      const field=Object.hasOwn(body,'theme')?'theme':'data';
      const revision=Number(searchParams.get('revision')?.slice(3));
      const manager=field==='theme'?" AND EXISTS(SELECT 1 FROM cj_memberships WHERE user_id=$1 AND workspace_id=$2 AND role IN ('gestor','socio_admin'))":'';
      return (await pool.query('UPDATE cj_state s SET '+field+'=$4,revision=s.revision+1,updated_at=now() WHERE workspace_id=$2 AND revision=$3 AND '+member+manager+' RETURNING revision,theme',[user.id,workspace,revision,body[field]])).rows;
    }
  }
  throw invalid();
}
const reads={
 cj_admin_tenants:'SELECT * FROM cj_admin_tenants',cj_admin_deals:'SELECT * FROM cj_admin_deals ORDER BY created_at DESC',
 cj_beta_feedback:'SELECT * FROM cj_beta_feedback ORDER BY created_at DESC',cj_memberships:'SELECT workspace_id,role,user_id FROM cj_memberships',
 cj_support_grants:'SELECT * FROM cj_support_grants'
};
async function admin(table,{method='GET',body={},query=''}={}){
  const [name,search='']=(table+query).split('?');
  const params=new URLSearchParams(search);
  const filter=k=>params.get(k)?.replace(/^eq\./,'');
  const workspace=filter('workspace_id');
  if(method==='GET'){
    if(name==='cj_state')return (await pool.query('SELECT revision,data,theme FROM cj_state WHERE workspace_id=$1',[workspace])).rows;
    if(name==='cj_support_grants'&&workspace)return (await pool.query('SELECT * FROM cj_support_grants WHERE workspace_id=$1',[workspace])).rows;
    if(Object.hasOwn(reads,name))return (await pool.query(reads[name])).rows;
  }
  if(method==='PATCH'){
    if(name==='cj_support_grants')return pool.query('UPDATE cj_support_grants SET revoked_at=now() WHERE workspace_id=$1',[workspace]);
    if(name==='cj_beta_feedback')return pool.query('UPDATE cj_beta_feedback SET status=$2 WHERE id=$1',[filter('id'),body.status]);
    if(name==='cj_admin_deals')return pool.query('UPDATE cj_admin_deals SET stage=$2 WHERE id=$1',[filter('id'),body.stage]);
  }
  if(method==='POST'){
    if(name==='cj_support_grants')return pool.query('INSERT INTO cj_support_grants(workspace_id,approved_by,expires_at,reason) VALUES($1,$2,$3,$4) ON CONFLICT(workspace_id) DO UPDATE SET approved_by=excluded.approved_by,expires_at=excluded.expires_at,revoked_at=NULL,reason=excluded.reason',[body.workspace_id,body.approved_by,body.expires_at,body.reason]);
    if(name==='cj_support_audit')return pool.query('INSERT INTO cj_support_audit(workspace_id,owner_id,event) VALUES($1,$2,$3)',[body.workspace_id,body.owner_id,body.event]);
    if(name==='cj_beta_feedback')return pool.query('INSERT INTO cj_beta_feedback(workspace_id,user_id,kind,message,page) VALUES($1,$2,$3,$4,$5)',[body.workspace_id,body.user_id,body.kind,body.message,body.page]);
    if(name==='cj_admin_deals')return pool.query('INSERT INTO cj_admin_deals(name,contact,value,next_action,next_date) VALUES($1,$2,$3,$4,$5)',[body.name,body.contact,body.value,body.next_action,body.next_date]);
  }
  throw invalid();
}
async function health(){await pool.query('SELECT revision FROM cj_state LIMIT 0');return true;}
module.exports={tenant,admin,health};
