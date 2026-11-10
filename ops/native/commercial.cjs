'use strict';
// PostgreSQL exclusivo da VPS. Toda ação administrativa é autorizada em server.cjs.
const {pool,transaction,fail}=require('./db.cjs');
const {token,digest}=require('./auth.cjs');
const clean=(v,n)=>typeof v==='string'?v.trim().slice(0,n+1):'';
const emailOf=v=>clean(v,254).toLowerCase();
const emailOk=v=>v.length<=254&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v);
const roles=new Set(['gestor','socio_admin','advogado','estagiario','secretaria','especialista','juridico','financeiro']);
const plans=new Set(['beta','trial']);
const statuses=new Set(['new','contacted','demo','proposal','rejected']);
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
const initialState=()=>({schema:1,clients:[],debts:[],opportunities:[],meetings:[],proposals:[],contracts:[],installments:[],cases:[],tasks:[],audit:[]});
function validateContact(input){
  const firm=clean(input.firm_name,120),name=clean(input.contact_name,100),email=emailOf(input.email),
        phone=clean(input.phone||'',35),message=clean(input.message||'',1500);
  if(firm.length<2||firm.length>120||name.length<2||name.length>100||!emailOk(email)||
     phone.length>35||message.length>1500)throw fail(400,'Confira o nome do escritório, responsável e e-mail.');
  if(input.consent!==true)throw fail(400,'É necessário autorizar o contato sobre a solicitação.');
  const plan=['conversar','demonstracao','contratar'].includes(input.plan_interest)?input.plan_interest:'conversar';
  return {firm,name,email,phone,message,plan};
}
async function createLead(input){
  // Campo invisível para bots: nunca expõe a um bot se passou no filtro.
  if(clean(input.website||'',200))return {ok:true};
  const p=validateContact(input);
  await pool.query(
    "INSERT INTO cj_sales_leads(firm_name,contact_name,email,phone,plan_interest,message) "+
    "SELECT $1,$2,$3,$4,$5,$6 WHERE NOT EXISTS ("+
    "SELECT 1 FROM cj_sales_leads WHERE lower(email)=$3 AND created_at>now()-interval '24 hours' AND status='new')",
    [p.firm,p.name,p.email,p.phone,p.plan,p.message]
  );
  return {ok:true};
}
async function listing(){
  const [leads,tenants]=await Promise.all([
    pool.query('SELECT id,firm_name,contact_name,email,phone,plan_interest,message,status,workspace_id,created_at FROM cj_sales_leads ORDER BY created_at DESC LIMIT 300'),
    pool.query(`SELECT t.workspace_id,t.name,t.plan,t.status,t.created_at,
      count(m.user_id)::integer AS users,
      count(m.user_id) FILTER (WHERE u.email_confirmed_at IS NOT NULL AND u.password_hash IS NOT NULL)::integer AS activated,
      array_remove(array_agg(u.email ORDER BY u.email),NULL) AS emails
      FROM cj_admin_tenants t
      LEFT JOIN cj_memberships m ON m.workspace_id=t.workspace_id
      LEFT JOIN native_users u ON u.id=m.user_id
      GROUP BY t.workspace_id,t.name,t.plan,t.status,t.created_at
      ORDER BY t.created_at DESC LIMIT 300`)
  ]);
  return {leads:leads.rows,tenants:tenants.rows};
}
async function updateLead({id,status}){
  if(!uuid(id)||!statuses.has(status))throw fail(400,'Solicitação ou etapa inválida.');
  const {rowCount}=await pool.query(
    "UPDATE cj_sales_leads SET status=$2,updated_at=now() WHERE id=$1 AND status<>'approved'",
    [id,status]
  );
  if(!rowCount)throw fail(409,'Solicitação aprovada ou inexistente.');
  return {ok:true};
}
function newInvite(client,userId,secret){
  return client.query(
    "INSERT INTO native_invites(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '48 hours') "+
    "ON CONFLICT(user_id) DO UPDATE SET token_hash=excluded.token_hash,expires_at=excluded.expires_at",
    [digest(secret),userId]
  );
}
async function createWorkspace(input,actorId){
  const leadId=input.lead_id;
  if(leadId&&!uuid(leadId))throw fail(400,'Solicitação inválida.');
  const selectedPlan=plans.has(input.plan)?input.plan:'trial';
  const secret=token();
  const created=await transaction(async client=>{
    let name=clean(input.firm_name,120),email=emailOf(input.email);
    if(leadId){
      const {rows:[lead]}=await client.query('SELECT * FROM cj_sales_leads WHERE id=$1 FOR UPDATE',[leadId]);
      if(!lead||lead.status==='approved'||lead.workspace_id)throw fail(409,'Solicitação já aprovada ou inexistente.');
      name=lead.firm_name;email=lead.email;
    }
    if(name.length<2||name.length>120||!emailOk(email))throw fail(400,'Informe escritório e e-mail profissional válidos.');
    const {rows:[user]}=await client.query(
      'INSERT INTO native_users(email) VALUES($1) ON CONFLICT(email) DO UPDATE SET email=excluded.email RETURNING id',
      [email]
    );
    if((await client.query('SELECT 1 FROM cj_memberships WHERE user_id=$1',[user.id])).rowCount)
      throw fail(409,'Este e-mail já pertence a um escritório. Use outro responsável.');
    const {rows:[space]}=await client.query('INSERT INTO cj_workspaces(name) VALUES($1) RETURNING id',[name]);
    await client.query("INSERT INTO cj_memberships(user_id,workspace_id,role) VALUES($1,$2,'gestor')",[user.id,space.id]);
    await client.query('INSERT INTO cj_state(workspace_id,data) VALUES($1,$2)',[space.id,JSON.stringify(initialState())]);
    await client.query("INSERT INTO cj_admin_tenants(workspace_id,name,plan,status) VALUES($1,$2,$3,'pending_activation')",[space.id,name,selectedPlan]);
    await newInvite(client,user.id,secret);
    if(leadId)await client.query("UPDATE cj_sales_leads SET status='approved',workspace_id=$2,updated_at=now() WHERE id=$1",[leadId,space.id]);
    await client.query("INSERT INTO cj_provision_audit(actor_id,workspace_id,user_id,event) VALUES($1,$2,$3,'workspace_created')",[actorId,space.id,user.id]);
    return {workspace_id:space.id,email,name};
  });
  return {...created,activation_url:'https://partelis.com.br/ativar#token_hash='+secret,expires_in_hours:48};
}
async function inviteMember(input,actorId){
  const workspace=input.workspace_id,role=input.role,email=emailOf(input.email);
  if(!uuid(workspace)||!roles.has(role)||!emailOk(email))throw fail(400,'Confira o escritório, papel e e-mail.');
  const secret=token();
  const created=await transaction(async client=>{
    const {rows:[space]}=await client.query('SELECT id FROM cj_workspaces WHERE id=$1 FOR UPDATE',[workspace]);
    if(!space)throw fail(404,'Escritório não encontrado.');
    const {rows:[user]}=await client.query(
      'INSERT INTO native_users(email) VALUES($1) ON CONFLICT(email) DO UPDATE SET email=excluded.email RETURNING id',[email]
    );
    if((await client.query('SELECT 1 FROM cj_memberships WHERE user_id=$1',[user.id])).rowCount)
      throw fail(409,'Este usuário já possui vínculo. Não é permitido transferir contas implicitamente.');
    await client.query('INSERT INTO cj_memberships(user_id,workspace_id,role) VALUES($1,$2,$3)',[user.id,workspace,role]);
    await newInvite(client,user.id,secret);
    await client.query("INSERT INTO cj_provision_audit(actor_id,workspace_id,user_id,event) VALUES($1,$2,$3,'member_invited')",[actorId,workspace,user.id]);
    return {workspace_id:workspace,email,role};
  });
  return {...created,activation_url:'https://partelis.com.br/ativar#token_hash='+secret,expires_in_hours:48};
}
async function reissueInvite(input,actorId){
  const workspace=input.workspace_id,email=emailOf(input.email);
  if(!uuid(workspace)||!emailOk(email))throw fail(400,'Confira escritório e usuário.');
  const secret=token();
  await transaction(async client=>{
    const {rows:[user]}=await client.query(
      "SELECT u.id,u.password_hash FROM native_users u JOIN cj_memberships m ON m.user_id=u.id "+
      "WHERE m.workspace_id=$1 AND u.email=$2 FOR UPDATE OF u",[workspace,email]
    );
    if(!user||user.password_hash)throw fail(403,'Convites novos somente para contas ainda não ativadas.');
    await newInvite(client,user.id,secret);
    await client.query("INSERT INTO cj_provision_audit(actor_id,workspace_id,user_id,event) VALUES($1,$2,$3,'invite_reissued')",[actorId,workspace,user.id]);
  });
  return {email,activation_url:'https://partelis.com.br/ativar#token_hash='+secret,expires_in_hours:48};
}
async function assistedRecovery(input,actorId){
  const workspace=input.workspace_id,email=emailOf(input.email);
  const reason=clean(input.reason,200);
  if(!uuid(workspace)||!emailOk(email)||input.identity_verified!==true||reason.length<10||reason.length>200)
    throw fail(400,'Identifique o usuário, confirme a verificação de identidade e descreva o motivo.');
  const secret=token();
  await transaction(async client=>{
    const {rows:[user]}=await client.query(
      "SELECT u.id FROM native_users u JOIN cj_memberships m ON m.user_id=u.id "+
      "WHERE m.workspace_id=$1 AND u.email=$2 AND u.password_hash IS NOT NULL FOR UPDATE OF u",
      [workspace,email]
    );
    if(!user)throw fail(404,'Usuário ativo não encontrado no escritório informado.');
    await client.query(
      "INSERT INTO native_invites(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '30 minutes') "+
      "ON CONFLICT(user_id) DO UPDATE SET token_hash=excluded.token_hash,expires_at=excluded.expires_at",
      [digest(secret),user.id]
    );
    await client.query(
      "INSERT INTO cj_provision_audit(actor_id,workspace_id,user_id,event) VALUES($1,$2,$3,'assisted_password_recovery')",
      [actorId,workspace,user.id]
    );
  });
  // A senha anterior continua válida até o usuário definir uma nova. Depois,
  // auth.cjs revoga todas as outras sessões do usuário.
  return {email,activation_url:'https://partelis.com.br/ativar#token_hash='+secret,expires_in_minutes:30};
}
async function setWorkspaceStatus(input,actorId){
  const allowed=new Set(['active','suspended','pending_activation']);
  if(!uuid(input.workspace_id)||!allowed.has(input.status))throw fail(400,'Escritório ou status inválido.');
  const r=await transaction(async client=>{
    const updated=await client.query('UPDATE cj_admin_tenants SET status=$2 WHERE workspace_id=$1 RETURNING workspace_id,status',[input.workspace_id,input.status]);
    if(!updated.rowCount)throw fail(404,'Escritório não encontrado.');
    await client.query("INSERT INTO cj_provision_audit(actor_id,workspace_id,event) VALUES($1,$2,'workspace_status_changed')",[actorId,input.workspace_id]);
    return updated.rows[0];
  });
  return r;
}
module.exports={createLead,listing,updateLead,createWorkspace,inviteMember,reissueInvite,setWorkspaceStatus,assistedRecovery};
