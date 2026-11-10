# Auditoria técnica do Partelís — 10/11/2026

## Escopo e método
- Base examinada: branch main do repositório Offdefiz/Offdefiz; código estático, schema PostgreSQL local, rotas Node.js, testes e workflows.
- Não houve acesso autenticado à VPS, ao PostgreSQL de produção ou a contas de outros escritórios. Nenhum teste invasivo contra dados reais foi feito.
- Status: OK = implementação identificada no código para o escopo indicado; PARCIAL = funcionamento limitado ou evidência incompleta; FALTA = requisito não localizado; BUGADO = comportamento observável no código que viola requisito. Testes de runtime não executados na auditoria estática são explicitados.
- A PR #5 de documentos está em rascunho e não deve ser interpretada como código disponível na main.
- Segurança e prontidão comercial NÃO estão homologadas por esta análise.

## A — Multi-tenant e acesso
| Requisito | Status | Evidência / lacuna |
|---|---|---|
| Isolamento do estado de um escritório em operações normais | PARCIAL | server.cjs deriva workspace da sessão e store.cjs filtra cj_state por membro; todos os módulos do CRM continuam dentro de um JSON compartilhado por escritório. |
| Tentativa de acesso direto por ID de outro escritório e por caso restrito | PARCIAL | ops/native/verify.cjs testa sete escritórios com dados próprios; não há endpoint processual granular nem teste explícito de manipulação de ID de processo/cliente. Teste integrado com PG de produção não realizado. |
| Cadastro, onboarding, inicialização | PARCIAL | commercial.cjs cria workspace/membership/state, convite e status de ativação; faltam setup processual, áreas e configurações iniciais. |
| Perfis solicitados e autorização backend | PARCIAL | roles existentes: gestor, secretaria, especialista, juridico, financeiro; domain.js valida operações de CRM no servidor. Faltam socio/admin, advogado, estagiário e permissões por processo/documento. |
| Login, logout, sessão | PARCIAL | ops/native/auth.cjs guarda hashes de tokens, prazo de uma hora para access e sete dias para refresh; falta cobertura integrada de expiração e revogação. |
| Recuperação de senha self-service | FALTA | Há recuperação assistida via proprietário em commercial.cjs, não fluxo autônomo com e-mail transacional. |
| Bloqueio por tentativas falhas, MFA/2FA | PARCIAL | server.cjs tem limite por IP em memória, sem lockout de conta, persistência ou MFA. MFA: FALTA. |

## B — Áreas de atuação
| Requisito | Status | Evidência / lacuna |
|---|---|---|
| Áreas cadastráveis e editáveis por escritório | FALTA | Oportunidade tem texto area; app.js oferece somente três opções bancárias hardcoded. |
| Sugestões iniciais editáveis para 14 áreas | FALTA | Não há catálogo institucional configurável. |
| Fases, classes e assuntos TPU por área | FALTA | domain.js usa funil comercial e cinco etapas de caso genéricas. |
| Campos customizados configurados por metadados (sem if/else por área) | FALTA | Ausência de schemas de campos em SQL/JSON configurável. |
| Modelos de documentos associados à área | FALTA | Templates de proposta são fixos e não equivalem a catálogo de documentos processuais. |
| Vínculo obrigatório de processo a uma área | FALTA | Não existe entidade processual completa. |
| Dashboards, filtros, relatórios por área | PARCIAL | Oportunidades carregam texto area; não há agregação geral de processos por área. |

## C — Clientes e partes
| Requisito | Status | Evidência / lacuna |
|---|---|---|
| PF com CPF validado, RG, estado civil, profissão, endereço/CEP | BUGADO | domain.js clientUpdate aceita CPF com 11 dígitos sem dígito verificador; demais atributos não existem. |
| PJ com CNPJ validado, razão social, sócios e representantes | BUGADO | clientUpdate aceita CNPJ com 14 dígitos sem verificação; faltam representantes e sócios. |
| Partes, testemunhas, peritos e terceiros por processo | FALTA | Sem tabela processual de participantes. |
| Busca por nome, CPF/CNPJ e CNJ | PARCIAL | Existe interface de CRM; não há índices/processos e busca consolidada documentada. |
| Duplicidade fiscal por escritório | FALTA | Clientes residem em JSON sem índice único de documento. |
| Histórico de interações | PARCIAL | contacts por oportunidade e audit de ações; não há timeline geral consolidada por cliente. |

## D — Processos
| Requisito | Status | Evidência / lacuna |
|---|---|---|
| Cadastro processual com CNJ e verificador | FALTA | cases representam kick-off e status do contrato, sem número CNJ. |
| Tribunal, órgão, comarca, grau, classe, assuntos, valor, rito, responsáveis e partes | FALTA | Sem modelo relacional processual. |
| Processos extrajudiciais sem número | FALTA | Não há entidade separada de processos/assuntos. |
| Campos processuais configurados por área | FALTA | Sem ligação entre schema configurável e processo. |
| Movimentações com origem, TPU e documento | FALTA | Sem armazenamento processual de andamentos. |
| Arquivar/reabrir com preservação do histórico | FALTA | Não existe ciclo de vida processual. |

## E — Integrações
| Requisito | Status | Evidência / lacuna |
|---|---|---|
| Interface ProcessDataProvider separada da origem | FALTA | Nenhum provedor de andamento localizado em main. |
| DataJud consulta de capas e movimentos | FALTA | Não configurado; não colocar chave no repositório. |
| DJEN/publicações/OAB e caixa de intimações | FALTA | Não há integração/caixa de intimações. |
| Agregador plugável | FALTA | Sem adaptadores. |
| Job/filas/retry/backoff/rate limit por provedor | FALTA | Sem processamento assíncrono de andamentos. |
| Idempotência por processo, data, descrição e TPU | FALTA | Não há tabela/índice de deduplicação. |
| Sugestão humana de prazos/compromissos, nunca prazo fatal automático | FALTA | Não há triagem de eventos processuais. |
| Segredo de justiça/certificado A1 | FALTA | Sem autorização por caso, armazenamento cifrado ou módulo de certificados. |
| Status, erros e reprocessamento de sincronização | FALTA | Sem tela/backend. |
| Testes com mocks de provedores | FALTA | Nenhum teste de integração processual. |

## F — Prazos e agenda
| Requisito | Status | Evidência / lacuna |
|---|---|---|
| Prazo processual: intimação, início, término, espécie | FALTA | Tarefas têm due; não são prazos judiciais. |
| Motor configurável por área/espécie | FALTA | Não há motor jurídico de contagem. |
| Dias úteis/corridos, exclusão dia inicial, feriados versionados, recesso | FALTA | Sem regras verificáveis; NÃO habilitar prazo fatal sem revisão jurídica. |
| Alertas em múltiplos níveis por e-mail/in-app | FALTA | Não foram encontrados disparos confiáveis de prazo. |
| Prazo fatal destacado e vencido persistente | FALTA | Só existem tarefas/reuniões; não há conceito de prazo fatal homologado. |
| Responsável + sócio e agenda diária/semanal/mensal | PARCIAL | Reuniões e tarefas têm owner e data; falta agenda judicial integrada e alertas. |

## G — Tarefas
| Requisito | Status | Evidência / lacuna |
|---|---|---|
| Criar, atribuir, vencer, concluir, vincular atendimento | PARCIAL | domain.js action task implementa; prioridade/status rico e vinculação a processo jurídico não existem. |
| Checklist e recorrência | FALTA | Não identificados. |

## H — Documentos
| Requisito | Status | Evidência / lacuna |
|---|---|---|
| Templates processuais por área com variáveis | FALTA | Há modelos fixos de propostas; não gerador processual genérico. |
| Autopreenchimento/geração segura e integração de assinatura | PARCIAL | Propostas visuais existem; PR #5 contém preflight de contratos, ainda em rascunho e sem geração/assinatura. |

## I — Financeiro
| Requisito | Status | Evidência / lacuna |
|---|---|---|
| Honorários fixos e êxito | PARCIAL | domain.js propostas registram valor fixo/percentual de êxito; não há contratação genérica mensal, mista e por ato. |
| Parcelas, vencimento, baixa e atraso | PARCIAL | Existem parcelas em centavos, baixa manual, estorno e métricas; sem cancelamento próprio. |
| Despesas reembolsáveis por processo | FALTA | Não há tabela para custas/perícia/diligência vinculada ao processo. |
| Receitas por período e área | PARCIAL | Métricas globais em centavos; sem relatórios por área de processo. |
| Armazenamento monetário inteiro/decimal | OK | domain.js persiste valores financeiros em centavos inteiros no estado atual; cj_admin_deals usa numeric. Entradas de formulário passam por Number antes da conversão e exigem testes de precisão adicionais. |

## J — Captação
| Requisito | Status | Evidência / lacuna |
|---|---|---|
| Origem, área, etapa, responsável e próximo contato | PARCIAL | Oportunidades do CRM contemplam o fluxo; área hardcoded no frontend. |
| Conversão de lead em cliente sem duplicar | PARCIAL | action client cria cliente e oportunidade juntos; não há conversão normalizada entre cj_sales_leads e client com deduplicação documental. |

## K — Comunicação
| Requisito | Status | Evidência / lacuna |
|---|---|---|
| Templates por variável + histórico por cliente | PARCIAL | O histórico de contatos existe por oportunidade; sem catálogo de templates de comunicação. |
| Envio e-mail/WhatsApp integrado | FALTA | Não implementado; simulações locais no portal não são envio. |

## L — Dashboard e relatórios
| Requisito | Status | Evidência / lacuna |
|---|---|---|
| Dashboard completo com prazos, intimações, honorários e área | PARCIAL | Métricas comerciais/financeiras existem; faltam intimações e prazos processuais. |
| Filtro por área | FALTA | Não existe corte transversal confiável por área estruturada. |
| CSV e PDF principais listas | PARCIAL | Proposta visual pode ser impressa; backup JSON demonstrativo existe; sem exportação das listagens consolidadas em CSV/PDF. |

## M — LGPD e sigilo
| Requisito | Status | Evidência / lacuna |
|---|---|---|
| Auditoria de leitura, alteração e exclusão, IP | PARCIAL | domain.js mantém log de mutações; há auditorias de suporte/provisionamento; ausência de trilha inviolável de leitura de entidades, IP e exclusão. |
| Exportação do titular | FALTA | Export JSON da demo não é exportação restrita por titular. |
| Anonimização/eliminação controlada | FALTA | Sem gestão de retenção e base legal. |
| Política e termos site/app | PARCIAL | privacy.html contém aviso limitado a contatos comerciais; instrumento operacional, termos e revisão jurídica pendentes. |
| Consentimento de marketing separado | FALTA | Consentimento comercial para responder solicitação existe; não há opt-in independente para marketing. |
| HTTPS/cripto repouso/backup/restauração | PARCIAL | Códigos de deploy, backup e teste de restore em CI existem; certificado da VPS, backup real executado, segredo em repouso e restore operacional NÃO VERIFICADOS. |

## N — Planos
| Requisito | Status | Evidência / lacuna |
|---|---|---|
| Limites por plano de usuários/processos/integrações | FALTA | Há labels beta/trial; sem enforcement de limites. |
| Cobrança recorrente, cancelamento, carência | FALTA | Formulário comercial não cria assinatura nem cobra; não há gateway. |

## O — Qualidade
| Requisito | Status | Evidência / lacuna |
|---|---|---|
| Fluxo E2E inteiro até relatório | FALTA | Não é possível executar cadeia processual; partes da cadeia ainda não existem. |
| Build/tests existentes | PARCIAL | Scripts npm run build, npm test, npm run test:deploy, CI de Node e CI PostgreSQL existem. Resultado atual em branch e VPS NÃO VERIFICADO aqui. |
| Placeholder/botões/links/console | PARCIAL | Demo é explicitamente fictícia; inspeção automatizada de navegador e de links NÃO VERIFICADA. |
| Responsividade real mobile | PARCIAL | CSS e meta viewport presentes; teste em dispositivos NÃO VERIFICADO. |
| Erros claros/monitoramento | PARCIAL | server.cjs suprime stack traces do usuário; logs e monitoramento centralizado/alertas não foram identificados. |

## Riscos bloqueadores de lançamento
1. Estado operacional JSON em memória por requisição e sem controle granular de leitura por cliente/processo. Proibir acesso de clientes externos ao cj_state.
2. Ausência de entidade de processo judicial, seus participantes e controle de segredo de justiça.
3. Ausência de prazos jurídicos confiáveis. Nunca marcar sugestão de prazo como data fatal automaticamente.
4. Ausência de auditoria de acesso a registros sensíveis e testes de segurança em banco real isolado.
5. Privacidade, retenção, termos, criptografia e restauração de produção ainda não homologados.
6. Integrações CNJ/DJEN, faturamento recorrente e certificados A1 não operacionais.

## Plano de implantação em etapas e critério de aceite
1. P0: RBAC por entidade e tenant, audit trail imutável e testes A/B com IDs reais de registros de teste.
2. P0: cadastros configuráveis de áreas, campos, fases e processo relacional em migração aditiva; conviver com CRM legado até mapeamento aprovado.
3. P0: cálculo determinístico e configurável de prazos, feriados versionados, sempre em modo sugestão pendente de revisão profissional.
4. P0: LGPD, retenção, backup cifrado, restauração, auditabilidade e homologação operacional.
5. P1: process providers por origem, queue/retry/dedup, sem sincronização automática na primeira ativação.
6. P1: dados completos de clientes/partes, agenda, financeiro por processo, relatórios e faturamento após gateway validado.
7. P2: testagem cross-browser, mobile, acessibilidade, documentos e fluxo E2E sem dados reais.

## Pendências de decisão humana
- Revisão das regras de prazo por ramo, tribunal, suspensão, feriados, calendário e hipóteses excepcionais; advogado responsável deve aprovar versões de regras antes de produção.
- Termos de uso, política integral, contrato de operador/controlador, encarregado e bases legais/retention revisados.
- Convênios, termos de uso, limites e licenciamento de fontes judiciais (DataJud/DJEN/agregador).
- Gateway, planos, política de inadimplência e cobrança.
- Administração do servidor deve comprovar HTTPS, criptografia, chaves, cópias cifradas, monitoramento, restore e isolamento com dados sintéticos.

## Referências internas inspecionadas
server.cjs; domain.js; app.js; ops/native/{schema.sql,auth.cjs,store.cjs,commercial.cjs,verify.cjs,commercial.verify.cjs}; ops/native/migrations/2026-11-04-sales-onboarding.sql; .github/workflows/{partelis-tests.yml,native-postgres.yml}; README.md; privacy.html; portal-architecture.md; domain.test.cjs; server.test.cjs; PR #5 (rascunho).
