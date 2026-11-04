# Partelís — auditoria preliminar de segurança (somente leitura)

Data: 03/11/2026. Escopo: banco "Caixa Juridico" conectado e código na branch caixa-juridico / PR #5.

## Evidências observadas

1. As nove tabelas public.cj_* consultadas estavam com RLS habilitado: cj_workspaces, cj_memberships, cj_state, cj_admin_tenants, cj_admin_deals, cj_beta_feedback, cj_support_grants, cj_support_audit, cj_user_profiles.
2. Políticas de cj_memberships permitem SELECT somente ao próprio user_id; cj_workspaces e cj_state fazem SELECT por participação no workspace. UPDATE em cj_state exige o papel gestor.
3. A tabela cj_state contém TODO o estado operacional em um documento JSON. O SELECT a qualquer membro do mesmo escritório significa que sigilo entre perfis internos ainda NÃO está demonstrado. Não usar dados reais até decompor tabelas e regras de autorização, ou restringir o acesso a identidades com permissão integral.
4. Cinco tabelas administrativas foram apontadas como "RLS Enabled No Policy": cj_admin_tenants, cj_admin_deals, cj_beta_feedback, cj_support_grants, cj_support_audit. O código usa service role do servidor para acessá-las; RLS sem policy é intencional caso os GRANTs de anon/authenticated estejam efetivamente revogados. Verificar GRANT antes do go-live; não criar policy aberta apenas para silenciar aviso.
5. O Security Advisor apontou "Leaked Password Protection Disabled". Exigir configuração no painel Supabase Auth e reteste após habilitar.
6. Não houve teste de restauração, pentest ou prova de isolamento A/B em sessão de usuário autenticado. Nenhum destes itens deve ser anunciado como concluído.

## Risco e prioridade

- Crítico antes de clientes reais: leitura integral de cj_state por membros com papéis distintos; falta de teste negativo de autorização entre tenants.
- Alto: inexistência de backup/restauração validado e política de retenção.
- Médio-alto: proteção contra senhas vazadas desativada.
- Acompanhar: instruir equipe a não incluir CPF, dados bancários ou documentos nos feedbacks de beta testers.

## Critérios concretos para homologação

### Permissões

- Usuário A do escritório A: pode ler somente registros autorizados de A.
- Usuário B do escritório B: não pode consultar nem alterar A, mesmo com UUID explícito.
- Usuários A1 e A2 do mesmo escritório: papel financeiro não recebe conteúdo jurídico sigiloso sem autorização; papel secretaria não recebe registros financeiros restritos.
- Anônimo: nenhuma tabela empresarial, administrativa ou de portal acessível.
- Gestor: não pode delegar direitos de outro workspace via corpo da requisição.
- Portal de cliente: deve passar por tabelas específicas autorizadas em cliente/caso, nunca pelo JSON cj_state.
- O serviço de suporte só pode consultar escritório com consentimento do gestor ainda válido; registrar cada evento.

### Backup e restauração

- Criar backup criptografado com retenção e política de acesso documentadas.
- Restaurar cópia em instância isolada, sem usar dados reais em fixtures públicas.
- Validar contagem por entidade, integridade referencial, logs imutáveis e capacidade de reverter migração.
- Testar alarme de falha de backup e tempo real de restauração; não presumir RPO/RTO.

### Verificações SQL sem ler dados de clientes

Verificar em homologação, com privilégios de auditoria, os campos relrowsecurity em pg_class, GRANTs em information_schema.role_table_grants, e pg_policies em public. Rodar pgTAP em contexto anon/authenticated com JWT e usuários estritamente sintéticos.

## Status

Revisão de código e metadados: parcial. Execução de migrações: não. Teste negativo A/B: não. Backup restaurado: não. Acesso de cliente real: BLOQUEADO.

Fontes normativas/técnicas:
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/auth/password-security
- https://supabase.com/docs/guides/database/database-linter
