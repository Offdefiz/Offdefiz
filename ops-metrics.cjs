'use strict';
const ONLINE_WINDOW_MS=120000;
function dashboardMetrics(data,now=Date.now()){
 const memberships=data.memberships||[],tenants=data.tenants||[],presence=data.presence||[],subscriptions=data.subscriptions||[],betaTesters=data.betaTesters||[],feedback=data.feedback||[],tasks=data.tasks||[];
 const allowed=new Set(memberships.map(m=>m.workspace_id+':'+m.user_id));
 const offices=new Set(memberships.map(m=>m.workspace_id).filter(Boolean));
 const suspended=new Set(tenants.filter(t=>['suspended','canceled'].includes(t.status)).map(t=>t.workspace_id));
 for(const id of suspended)offices.delete(id);
 const online=new Set(presence.filter(p=>allowed.has(p.workspace_id+':'+p.user_id)&&Number.isFinite(Date.parse(p.last_seen_at))&&now-Date.parse(p.last_seen_at)>=0&&now-Date.parse(p.last_seen_at)<=ONLINE_WINDOW_MS&&!suspended.has(p.workspace_id)).map(p=>p.user_id));
 const paying=new Set(subscriptions.filter(s=>s.status==='active'&&s.billing_source==='provider'&&s.billing_verified_at&&Date.parse(s.current_period_end)>now&&!suspended.has(s.workspace_id)).map(s=>s.workspace_id));
 return {
  workspacesWithAccess:offices.size,
  activeUsers:[...new Set(memberships.map(m=>m.user_id).filter(Boolean))].length,
  onlineUsers:online.size,
  betaTesters:[...new Set(betaTesters.map(t=>t.user_id).filter(Boolean))].length,
  payingWorkspacesVerified:paying.size,
  feedbackPending:feedback.filter(f=>f.status==='open'||f.status==='reviewing').length,
  tasksOpen:tasks.filter(t=>t.status!=='done').length
 };
}
function validateTask(payload){
 if(!payload||typeof payload!=='object'||Array.isArray(payload))return null;
 const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
 if(!uuid.test(String(payload.id||''))||typeof payload.title!=='string'||payload.title.trim().length<4||payload.title.length>160||!['P0','P1','P2','P3'].includes(payload.priority))return null;
 return {feedback_id:payload.id,title:payload.title.trim(),priority:payload.priority,status:'backlog'};
}
module.exports={dashboardMetrics,validateTask,ONLINE_WINDOW_MS};
