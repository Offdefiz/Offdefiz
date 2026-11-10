'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {dashboardMetrics,validateTask,ONLINE_WINDOW_MS}=require('./ops-metrics.cjs');
const now=Date.parse('2026-11-03T20:00:00Z'),w1='w1',w2='w2';
test('presença expira em 2 minutos e exclui usuário não pertencente ao escritório',()=>{
 const r=dashboardMetrics({memberships:[{workspace_id:w1,user_id:'a'},{workspace_id:w2,user_id:'b'}],presence:[
 {workspace_id:w1,user_id:'a',last_seen_at:new Date(now-ONLINE_WINDOW_MS+1).toISOString()},
 {workspace_id:w1,user_id:'x',last_seen_at:new Date(now).toISOString()},
 {workspace_id:w2,user_id:'b',last_seen_at:new Date(now-ONLINE_WINDOW_MS-1).toISOString()}
 ]},now);
 assert.equal(r.onlineUsers,1);assert.equal(r.workspacesWithAccess,2);assert.equal(r.activeUsers,2);
});
test('não chama plano manual nem beta de pagante comprovado',()=>{
 const r=dashboardMetrics({tenants:[{workspace_id:w1,status:'active',plan:'paid'}],subscriptions:[
 {workspace_id:w1,status:'active',billing_source:'manual',billing_verified_at:new Date(now).toISOString(),current_period_end:new Date(now+86400000).toISOString()},
 {workspace_id:w2,status:'active',billing_source:'provider',current_period_end:new Date(now+86400000).toISOString()}
 ],betaTesters:[{user_id:'a'},{user_id:'a'},{user_id:'b'}]},now);
 assert.equal(r.payingWorkspacesVerified,0);assert.equal(r.betaTesters,2);
});
test('pagante só entra com confirmação do provedor e período válido',()=>{
 const r=dashboardMetrics({subscriptions:[{workspace_id:w1,status:'active',billing_source:'provider',billing_verified_at:new Date(now).toISOString(),current_period_end:new Date(now+86400000).toISOString()},{workspace_id:w2,status:'past_due',billing_source:'provider',billing_verified_at:new Date(now).toISOString(),current_period_end:new Date(now+86400000).toISOString()}]},now);
 assert.equal(r.payingWorkspacesVerified,1);
});
test('conversão exige UUID, título e prioridade, nunca aceita status vindo do navegador',()=>{
 const id='152420ba-b05b-47ce-8e29-a3c2219989b3';
 assert.deepEqual(validateTask({id,title:' Ajustar agendamento ',priority:'P1',status:'done'}),{feedback_id:id,title:'Ajustar agendamento',priority:'P1',status:'backlog'});
 assert.equal(validateTask({id,title:'ok',priority:'P1'}),null);
 assert.equal(validateTask({id:'fake',title:'Relato',priority:'P1'}),null);
 assert.equal(validateTask({id,title:'Relato',priority:'urgent'}),null);
});
