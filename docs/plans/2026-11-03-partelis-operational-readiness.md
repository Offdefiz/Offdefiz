# Partelís — Implementation Plan das oito frentes

> Para desenvolvimento assistido: as tarefas podem ser aprovadas separadamente em PR; preservar o símbolo A1, #30145F / #8D59FF, os modelos DOCX e todos os dados do piloto.

**Goal:** levar a Partelís do piloto bancário a um SaaS confiável, sem ativar funcionalidades não homologadas.

**Architecture:** Node.js 22, HTML/JS e Supabase Auth/PostgreSQL. A base JSON por escritório é uma etapa intermediária; o portal do cliente e a autorização granular exigem tabelas relacionais e RLS por escritório, cliente e caso.

**Tech Stack:** Node.js, node:test, PostgreSQL/Supabase, ZapSign sandbox, API de monitoramento a contratar.

## Global Constraints

- Nunca usar dados reais de clientes no protótipo ou na homologação.
- Manter a produção inalterada até revisão de migrações, segurança, testes e rollback.
- Nunca expor segredo de serviço, token de assinatura, CPF ou conteúdo jurídico em logs e links.
- Não considerar pré-validação como geração, assinatura ou homologação de contrato.
- Não considerar plano de preço cadastrado como pagamento efetivamente realizado.
- Não aceitar IA, monitoramento automatizado ou notificação como substitutos da conferência humana de prazos.
- Não presumir qual das duas contas com nome de Letícia é a conta beta correta.

---

### Task 1 — P0: Segurança, RLS, autorização e restauração

**Files:** schema.sql (existente), sql/ops-v1-review.sql (novo), portal-architecture.md (existente), supabase/tests/tenant_rls.sql (proposto).
**Interfaces:** cj_memberships(user_id,workspace_id,role) e cj_state(workspace_id,revision,data,theme).
- [ ] Escrever pgTAP com dois escritórios e usuários fictícios para SELECT/INSERT/UPDATE/DELETE, inclusive tentativa de UUID forjado, conta anônima e perfis sem permissão.
- [ ] Rodar supabase test db na instância isolada e confirmar denegação de acesso cruzado entre clientes e escritórios.
- [ ] Eliminar acesso indiscriminado ao JSON operacional por qualquer papel do mesmo escritório antes de dados reais: separar entidades ou restringir acesso granular.
- [ ] Habilitar e validar proteção contra senhas vazadas, revisar sessões e segredo de serviço, e fazer auditoria independente.
- [ ] Criar backup protegido e comprovar restauração em instância isolada mediante integridade e contagens. Nenhum dump de produção pode integrar fixtures.
**Acceptance:** testes negativos de autorização e restauração comprovados, sem exposição de dados.

### Task 2 — P0: Jornadas e qualidade mobile

**Files:** domain.js, domain.test.cjs, workflow-v06.test.cjs, crm-ui.test.cjs, server.test.cjs (existentes).
- [ ] Executar npm test e npm run build na branch consolidada.
- [ ] Exercitar jornada fictícia completa de cadastro, atendimento, proposta, aceite, contrato manual, parcelas, baixa e passagem ao jurídico.
- [ ] Verificar revisão simultânea 409, sessão expirada, origem externa, valores inválidos e campos incompletos.
- [ ] Validar no Safari iPhone/PWA, Android e desktop: rolagem, teclado, modais, layout, tema, acessibilidade.
**Acceptance:** nenhuma perda de estado ou impedimento de navegação; regressão automatizada aprovada.

### Task 3 — P1: Contratos

**Files:** zapsign-formularios.json, zapsign-validation.cjs, zapsign-preflight.cjs, contract-catalog.cjs, contratos-preflight.html, contratos-preflight.js e docs/zapsign-sandbox-plan.md.
**Nesta branch:** catálogo e interface de pré-validação autenticada, com produção sempre bloqueada.
- [ ] Conferir contrato revisional ausente, rubricas, prefixos R$ e última parcela/valor por extenso com responsável pelos modelos.
- [ ] Preparar auto preenchimento a partir de dados opcionais do lead e proposta aceita, sem obrigar contratação.
- [ ] Homologar criação, idempotência, signatários e 12 PDFs na sandbox real, sem credenciais de produção.
- [ ] Liberar assinaturas de produção apenas após aprovação registrada dos 12/12 casos.
**Acceptance:** 12 modelos homologados, PDFs revisados e sem duplicação ou acesso cruzado a links.

### Task 4 — P1: Administração e beta testers

**Files:** admin.html, admin.js, ops-metrics.cjs, presence.js, server.cjs e sql/ops-v1-review.sql.
**Nesta branch:** código de presença aproximada, métricas de pagantes verificadas, vinculação manual de conta beta e conversão idempotente de feedback em tarefa.
- [ ] Revisar e aplicar SQL apenas em homologação, testando RLS, permissões e rollback.
- [ ] Vincular Dra. Ketrin e a conta confirmada de Letícia na aba Beta testers; existem duas contas com nome de Letícia.
- [ ] Adicionar onboarding e histórico de interações, definir eventos de cobrança verificados.
- [ ] Medir heartbeat/expiração de 120 s, concorrência e limitação de chamadas.
**Acceptance:** autoria preservada, uma tarefa por feedback, proprietário autorizado, nenhuma receita presumida.

### Task 5 — P1: Portal real do cliente

**Files:** portal-architecture.md, cliente.html, cliente.js, migrações e APIs de portal propostos.
- [ ] Criar autorizações específicas por user, workspace, client e case; nunca conceder leitura de cj_state ao cliente.
- [ ] Validar convite individual, revogação e publicação de atualização aprovada por advogado.
- [ ] Testar negação de acesso cruzado e acesso por arquivo/documento em banco e servidor.
**Acceptance:** sigilo e isolamento comprovados, sem dados jurídicos expostos por padrão.

### Task 6 — P2: Financeiro ampliado

**Files proposed:** billing/ledger.cjs, billing/recurrences.cjs, billing/billing.test.cjs e migração de lançamentos.
- [ ] Fixar política de pró-rata, dia de vencimento, reajuste, inadimplência, acordo, honorários de êxito e estorno.
- [ ] Segregar contratado, a cobrar, cobrado, recebido e estornado; validar centavos e passagem de mês.
- [ ] Integrar provedor somente com webhook verificado e deduplicação por evento.
**Acceptance:** saldos reproduzíveis e nenhuma confirmação de pagamento sem evidência do PSP.

### Task 7 — P2: Monitoramento processual

**Files proposed:** docs/providers/process-monitoring-evaluation.md, monitoring/adapter.cjs, monitoring/monitoring.test.cjs.
- [ ] Comparar o DataJud público (metadados) e fornecedores privados (cobertura, SLA, atualização e cobrança).
- [ ] Implementar adaptador com orçamento mensal por escritório, retry controlado e registro de data/fonte.
- [ ] Testar CNJ inválido, repetição, indisponibilidade de tribunal e sigilo; revisão humana para prazos.
**Acceptance:** custo e cobertura verificados, nenhuma promessa de intimação/prazo automático garantido.

### Task 8 — P3: IA assistiva

**Files proposed:** ai/review-queue.cjs, ai/redaction.cjs, ai/review.test.cjs.
- [ ] Medir ganho de tempo em resumo de atendimento ou extração de proposta, sem alterar autos/documentos.
- [ ] Minimizar dados, definir base jurídica/retencão e consentimento apropriado antes de transmissão externa.
- [ ] Requerer revisão humana e aceite explícito; testar respostas erradas e indisponibilidade de provedor.
**Acceptance:** nenhuma ação ou comunicação automática ao cliente sem aprovação profissional.

## Estado atual

A branch codex/partelis-ops-safety-next contém implementação parcial para as tasks 3 e 4 e testes unitários. Não há publicação, alteração no Supabase de produção, homologação remota ZapSign, nem liberação de clientes reais. As demais tasks continuam abertas. A PR #5 permanece em rascunho.

**Decisões pendentes:** conta exata de Letícia, fornecedor financeiro, política de recorrência e original revisional, fornecedor de processos/custo máximo e escopo de IA.
