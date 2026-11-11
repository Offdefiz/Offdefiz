# Partelís · Propostas contextuais por área e serviço (v1)

**Status:** alteração implementada na PR #17. A publicação da revisão aprovada é condicionada aos testes Node/PostgreSQL e ao deploy seguro com backup, healthcheck e rollback. O catálogo exige revisão editorial antes de ser usado como orientação jurídica pronta. O catálogo inicial foi preparado em 11/11/2026 e **requer revisão editorial jurídica antes de ser oferecido como modelo pronto para uso**.

## Objetivo

Permitir que um escritório de especialidade única ou várias áreas gere uma proposta comercial individualizada por **área de atuação → serviço/ação → modalidade → escopo → etapas → honorários**, preservando personalização do escritório, CRM, versões, aprovação e cobrança existentes. O padrão para áreas não bancárias é a apresentação visual neutra de sete páginas; os quatro modelos históricos são preservados integralmente.

## Matriz inicial de serviços

| Área | Serviços prioritários incluídos |
|---|---|
| Bancário | Diagnóstico de passivo, renegociação, revisional, defesa em busca e apreensão, execução, superendividamento, fraude |
| Cível | Indenização, cobrança, execução, monitória, obrigação de fazer, acordo |
| Penal | Investigação, defesa em ação penal, custódia, habeas corpus, júri, execução penal, queixa-crime |
| Trabalhista | Reclamação do empregado, defesa do empregador, rescisão indireta, acordo extrajudicial, execução, consultoria |
| Tributário | Auto de infração, execução fiscal, repetição de indébito, MS, transação, planejamento |
| Previdenciário | Aposentadoria, benefício por incapacidade, BPC, pensão por morte, revisão, ação judicial |
| Família e Sucessões | Divórcio consensual/litigioso, guarda, alimentos, inventários, união estável |
| Empresarial e Societário | Constituição e alteração, acordo de sócios, contratos, dissolução, cobrança, recuperação judicial |
| Administrativo | PAD, servidor público, licitação, concurso, defesa de sanção |
| Consumidor | Negativação, vício, cobrança abusiva, plano de saúde, acordo |
| Imobiliário | Despejo, revisional de locação, usucapião, distrato, regularização, adjudicação |
| Ambiental | Autuação, licenciamento, TAC, responsabilidade |
| Digital e Proteção de Dados | LGPD, incidente, ANPD, remoção de conteúdo, contratos de tecnologia |
| Outra | Diagnóstico, parecer, negociação, representação administrativa |

A lista não representa a totalidade de classes processuais e não é um ranking estatístico de frequência: os serviços foram **priorizados como hipóteses de demanda** para validar com advogados nichados. Para correspondência oficial de classes, assuntos e movimentos, usar as **TPUs do CNJ** separadamente da taxonomia comercial. Não presumir números de classe ou assunto.

## Operação

1. O atendimento continua vinculado à sua área. No cadastro de proposta, o seletor de serviço mostra as opções dessa área. A opção em branco preserva escopo livre para nichos próprios.
2. Selecionar um serviço preenche **escopo e limites**, **etapas indicativas sem prazo fatal** e **próximos passos**. O usuário deve revisar e editar os campos. Nenhum valor é preenchido automaticamente.
3. O CRM guarda `serviceId`, `serviceName`, `areaName`, `modality` e `catalogVersion` como parte da versão da proposta. Versões anteriores e contratos existentes não sofrem migração.
4. A apresentação genérica mostra objeto, diagnóstico informado pelo profissional, serviços, etapas, documentação, exclusões, honorários individualizados e próximos passos. Não mostra métricas bancárias quando a área não é bancária.
5. Serviços customizados e áreas não mapeadas continuam possíveis pelo campo de escopo livre, com conteúdo **a definir** em vez de dados inventados.
6. O sistema preserva personalização de cor, logo, advogado responsável e OAB conforme configuração já existente.

## Regras de negócio e proteção

- **Proposta comercial de honorários** não equivale a **proposta de acordo jurídico**. Não gerar uma minuta de transação, petição de homologação ou cláusulas vinculantes automaticamente nesta versão. A identificação `agreementPossible` apenas sinaliza um serviço de negociação que poderá habilitar módulo separado após validação.
- Honorários, percentuais de êxito, forma de pagamento, custas, despesas, alcance da atuação, substituição processual e efeitos do encerramento por acordo devem ser definidos e revisados pelo advogado. Nunca preencher preço fixo ou “desconto Black Friday” no material público de advocacia.
- Preservar sigilo e LGPD. O catálogo contém conteúdo estático, sem dados de clientes. A geração de apresentações usa informações do cliente no navegador e a rotina de persistência original do escritório.
- Nenhuma contagem de prazo processual automático, previsão de êxito ou recomendação jurídica conclusiva. Em direito penal, prever cuidados específicos com dados sensíveis e urgência, sem presumir admissibilidade de acordo.
- Escopo, etapas e documentos são sugestões de operação, não instruções normativas completas.

## Estrutura e evolução prevista

- `legal-service-catalog.js`: catálogo versionado com 14 áreas e serviços; `matchArea`, `list`, `get`, `context`, `draft`.
- `domain.js`: validação de serviço compatível com a área; registro de snapshot na proposta.
- `app.js`: seletor contextual e edição de escopo/etapas.
- `proposal-engine.js` e `templates/proposta_multiarea.html`: renderização neutra, identidade do escritório e exportação de sete páginas.
- `server.cjs`: rotas de catálogo e template explícitas.
- `legal-services.test.cjs`: integridade de catálogo, compatibilidade de proposta, proteção de rota e regressão.

**Próxima etapa arquitetural, não incluída nesta entrega:** configurar especialidades primárias/secundárias por escritório, campos de intake opcionais por ação, playbooks por fase, tarefas e checklists por serviço, alertas de prazo com revisão humana, tipos de honorários por modalidade, modelos de acordo, ferramentas e relatórios próprios por área. Esses recursos precisam se integrar à estrutura de áreas em PostgreSQL e respeitar permissões multi-tenant. **Não criar instâncias distintas por especialidade.**

## Fontes oficiais para revisão da taxonomia e conformidade

- CNJ, Tabelas Processuais Unificadas: https://www.cnj.jus.br/programas-e-acoes/tabela-processuais-unificadas/
- OAB, Código de Ética e Disciplina, arts. 48 e seguintes: https://www.oab.org.br/leisnormas/legislacao/resolucoes/02-2015
- OAB, Provimento 205/2021 (publicidade e informação): https://www.oab.org.br/leisnormas/legislacao/provimentos/205-2021
- Tabelas de honorários das seccionais competentes: consultar versão vigente no momento da contratação; **não hardcode** valores nacionais.

## Critérios de aceitação de release

- [ ] `npm run build` e `npm test` aprovados no commit final, incluindo testes existentes.
- [ ] Abrir proposta de atendimento **penal**, **trabalhista**, **previdenciário**, **bancário** e **escritório multiárea** em navegador autenticado; exportar 7 páginas e conferir escopo, identidade e valores.
- [ ] Verificar que os quatro modelos anteriores não mudaram e propostas antigas continuam reproduzíveis.
- [ ] Verificar acesso e escrita entre escritórios no PostgreSQL, sem vazamento.
- [ ] Conferir revisão jurídica dos textos do catálogo com advogados das áreas específicas.
- [ ] Só depois realizar merge e deploy com rollback e healthcheck.


## Extensões implementadas nesta PR

- **Perfil do escritório:** gestores e sócios administradores definem `practice.primaryArea` e `practice.enabledAreas` em Configurações → Especialidades do escritório. O backend valida 14 códigos de área e preserva a marca, as propostas e os dados anteriores. O seletor de novos atendimentos usa somente as áreas configuradas e coloca a principal primeiro. O escritório pode atuar em múltiplas áreas.
- **Minuta de acordo distinta da proposta comercial:** para serviços do catálogo classificados como negociação, a ficha de atendimento e a visualização da proposta oferecem a opção de redigir uma **minuta preliminar de proposta de acordo**. A minuta abre em nova aba para revisão e PDF, com aviso expresso de não vinculação. **Não é gravada no servidor, não gera assinatura, não faz envio, não cria obrigação nem automatiza homologação.** A persistência e os fluxos jurídicos de acordos precisam de estrutura própria com controle de sigilo antes de serem ativados.
- **Apresentação apropriada por serviço:** seleção de ação revisional ou superendividamento no bancário recomenda seus modelos correspondentes; demais serviços recebem modelo genérico para evitar linguagem indevida de dívida/holding.
- **Proteção de dados legados:** identificador, modalidade, escopo, exclusões, documentos e etapas do serviço ficam registrados na versão da proposta, protegendo o conteúdo original contra alterações futuras de catálogo.

## Publicação única condicionada

O arquivo `.github/workflows/deploy-pr17-multiarea-once.yml` adiciona uma execução **uma única vez**, mediante merge cujo título contenha `partelis-pr17-release-20261111`. O workflow:

1. Verifica commit SHA e script de implantação.
2. Executa `npm run build`, `npm test` e `npm run test:deploy`.
3. Sobe banco PostgreSQL descartável, aplica migrações conhecidas e executa verificadores de isolamento, legal e comercial.
4. Somente após aprovação executa a rotina de publicação existente por SSH, com `production` environment, host verificado e rollback na VPS.

O arquivo é inócuo para futuros merges sem o token. **CI e implantação executados devem ser confirmados pelos logs reais do GitHub Actions; a presença do workflow não demonstra que a VPS foi atualizada.** A remoção do workflow exclusivo pode ser feita em uma PR de limpeza após a execução confirmada.
