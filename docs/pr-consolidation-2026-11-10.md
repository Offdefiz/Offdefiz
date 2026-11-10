# Consolidação das PRs do Partelís — 10/11/2026

> Escopo: comparação do histórico de 12 PRs e inspeção dos arquivos alterados em cada uma, branch atual `main` e bases de dependência. **Não** é homologação de produção.

## Resultado da análise de PRs

| PR | Estado no GitHub | Implementação aproveitável | Decisão |
|---|---|---|---|
| #1 | merged em `caixa-juridico` | Meu Dia, atrasos financeiros, exportação manual de agenda | Preservar; não duplicar |
| #2 | merged em `caixa-juridico` | Admin e feedback beta | Preservar; não reintroduzir Supabase |
| #3 | merged em `caixa-juridico` | CRM e propostas visuais | Preservar |
| #4 | merged em `caixa-juridico` | Propostas com quatro apresentações, marca A1 | Preservar |
| #5 | draft, base `caixa-juridico` | Catálogo original de 12 modelos, validação de dados, preflight, auditoria DOCX | **Portados catálogo e preflight para backend PostgreSQL; ZapSign bloqueada** |
| #6 | merged em `caixa-juridico` | Defesa contra XSS em gráficos | Preservar |
| #7 | draft, depende #5 | Métricas honestas, presença, checklist de contratos, rascunhos financeiros, feedback->tarefas | **Portados cálculos, métricas, presença e fluxo de feedback->tarefas; portal real bloqueado** |
| #8 | draft, depende #5 | Interface de preflight com autopreenchimento opcional, módulos financeiros e alterações Supabase | **UI adaptada para preflight; não aplicar SQL Supabase e não chamar ZapSign** |
| #9 | draft, base antiga | Bootstrap VPS e runbook | **Não executar em servidor possivelmente já configurado**; inspecionar Nginx/systemd/backup antes |
| #10 | draft, base `caixa-juridico` | PostgreSQL local e tokens | Já reproduzido em `main`; evitar merge redundante |
| #11 | draft, depende #10 | Site comercial, convites, contas e superadmin | Já reproduzido em `main`; evitar merge redundante |
| #12 | draft, base `main` | Auditoria A–O, esquema processual multiárea, ACL, validators e testes A/B | **Base da nova implementação**; homologar antes de merge |

## Código consolidado nesta branch (#13, base #12)

1. `zapsign-formularios.json`, `zapsign-validation.cjs`, `zapsign-preflight.cjs`, `contract-catalog.cjs` e relatório de auditoria de originais preservados. **12 modelos não são 12 homologações.**
2. `/contratos`, `/api/contracts/catalog` e `/api/contracts/preflight` autorizados para roles de contratação; sem persistência, sem geração DOCX/PDF, sem API ZapSign, `productionEnabled=false`.
3. CPF com dígito verificador, CNPJ numérico e alfanumérico com algoritmo oficial, CNJ com DV. CNPJ em acervo de documento legado aceita a máscara com letras na identificação.
4. `finance-drafts.cjs`: competência recorrente, parcelamento e estimativa de êxito em centavos, somente rascunhos; não afeta recebimentos.
5. `ops-metrics.cjs` e backend `ops/native/ops.cjs`: contagem de pagantes exclusivamente com confirmação de provedor; presença aproximada na janela de 120 segundos; marcação explícita de beta testers; uma tarefa por feedback; auditabilidade.
6. `/admin/operacoes` e `/juridico` com navegação própria e gatilhos para formulários conectados ao backend multiárea; a demonstração pública continua separada.
7. Correção de listagem de pessoas ligadas exclusivamente a processos secretos, com verificação negativa para usuário do próprio escritório sem ACL.
8. Migração `ops/native/migrations/2026-11-10-ops-metrics.sql` **aditiva**; nenhum dado antigo é removido.
9. Testes unitários de validação, contratos, métricas e cálculos financeiros; testes PostgreSQL de isolamento, restauração, presença, tarefas e beta testers.

## Dependências históricas que NÃO devem ser mescladas automaticamente

- PRs #5/#7/#8 usam Supabase Auth/REST/RLS em partes do servidor e nas migrações. A `main` atual adota PostgreSQL e autenticação locais; merges cegos poderiam reintroduzir dependências erradas.
- PR #9 é provisionamento de sistema Ubuntu, perigoso em servidor já inicializado.
- PRs #10/#11 têm base encadeada antiga; a `main` já contém seus equivalentes operacionais. Fechar apenas após reconciliação de commits e decisão administrativa.
- PR #5 registra contrato revisional original ausente, rubricas em parte dos DOCX e possíveis duplicações de R$ e diferenças de parcela. Exige originais e sandbox.
- PR #7 e #8 apresentam versões concorrentes do preflight/admin e um portal do cliente ainda não homologado. Reaproveitar código seletivamente, nunca as flags de produção.

## Backlog prioritário não concluído

### P0 — bloqueios técnicos e jurídicos
- Homologar migrações no staging com backup de banco real criptografado e restore comprovado; após isso testar serviços HTTPS em VPS e rollback sem downtime.
- Resolver isolamento e RBAC finos do **JSON legado `cj_state`**: atualmente colaboradores acessam o documento inteiro. Dados reais/processuais confidenciais não podem ser liberados antes da segregação; a nova entidade processual já tem ACL por processo.
- Motor processual: cálculo de prazo existe apenas como função pura de **sugestão**. Faltam persistência de fluxo validado, tabela de feriados oficialmente versionada por tribunal, alertas, recesso aprovado e política de prazos fatais.
- Audit trail abrangente para leitura de cliente, documento, download, alteração, exclusão; políticas de retenção e solicitações LGPD; backups/DRP e monitoração externa.
- Revisão jurídica da política de privacidade, termos de uso e das regras de contagem.

### P1 — produto
- Completar UX jurídica (partes cadastradas, filtro/busca por número/nome, dashboard judicial, agenda, intimações) e documentação de estado vazio.
- Integração DataJud e DJEN por adaptadores com fila, limites, retry/backoff, mocks e reprocessamento; condicionar qualquer uso comercial à licença/termos de fonte.
- Cadastro de processos e pessoas enriquecido, anexos privados, importação e modelos próprios por área; não presumir documentação válida por cadastral.
- Avisos e-mail/in-app e integração de calendário com consentimento.
- Receita/recebíveis por processo e área, despesas processuais reembolsáveis, modelos de honorários mensal/êxito/misto/ato.
- Portal real cliente com autorização de pessoa+processo+documento sem expor JSON inteiro.
- Planos, limites e cobrança só depois de escolha de PSP, contrato de gateway, reconciliação e webhook verificável.

### P2 — expansão
- Fluxos de assinatura ZapSign após **12/12 DOCX e PDF homologados** e revisão jurídica, sem reescrever originais.
- Templates de mensagens, WhatsApp/e-mail, relatórios CSV/PDF, acessibilidade e teste completo de celulares.
- Certificado A1 apenas após HSM/gestão de segredos e controle explícito do usuário; sem armazenamento de conteúdo em logs.
- Motor de providers substituíveis, avaliação de agregadores e IA opcional.

## Testes
- Node/CI: `npm run build && npm test && npm run test:deploy`.
- PostgreSQL descartável nomeado `partelis_verify_*`: aplicar `ops/native/schema.sql`, migração comercial, migração multiárea, migração operacional e executar `ops/native/verify.cjs`, `ops/native/commercial.verify.cjs`, `ops/native/legal.verify.cjs`, `ops/native/ops.verify.cjs`.
- Arquivos da PR #5 usam validação de modelos; **nunca apontar scripts para banco VPS real**. Teste de UI e pentest exigem staging.
- Devem ser feitos smoke tests reais dos formulários depois de aprovação do staging. CI verde não é certificação de LGPD.

## Checklist humano antes de lançamento
- [ ] Revisor jurídico assinou regra de prazo específica por ramo/órgão e suas exceções.
- [ ] Advogado revisou termos, privacidade, política de retenção, atendimento a titulares e contratos.
- [ ] Responsável ou encarregado por proteção de dados definido com fluxo de incidentes.
- [ ] Fonte DataJud/DJEN/terceiro contratada ou autorizada para escopo comercial.
- [ ] Gateway escolhido, webhooks/cobrança, cancelamento e carência homologados.
- [ ] Backup cifrado fora da VPS, restauração real e alertas testados.
- [ ] QA A/B, autenticação, MFA, privilégios mínimos, logs sem dados pessoais e pentest realizados.
- [ ] ZapSign: originais 12/12, rubricas, valores e PDF confrontados no sandbox.

**Não fazer merge da PR #13 isoladamente** sem a PR #12, migrações e homologação. Não há deploy neste trabalho.
