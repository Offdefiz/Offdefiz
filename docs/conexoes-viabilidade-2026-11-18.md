# Partelís Conexões — estudo de viabilidade e decisões (18/11/2026)

## Resumo executivo
**Recomendação:** começar como ferramenta SaaS B2B de **perfil profissional individual, link compartilhável e solicitação de contato direto**. Não começar como marketplace de leads ou contratação intermediada. O objetivo é aumentar o valor percebido do Partelís e converter contatos em atendimentos administrados pelo escritório.

A primeira versão implementada neste branch NÃO oferece diretório público, pesquisa por especialidade, distribuição automática, ranqueamento, avaliação pública, pagamento de honorários, agendamento de consultas nem promessas de clientes. **Não está publicada nem aprovada juridicamente.** A publicação de cada perfil é opt-in, e a landing descreve um piloto.

## Viabilidade regulatória: hipóteses e limites
1. O Provimento OAB 205/2021 permite marketing jurídico informativo e uso de ferramentas tecnológicas de comunicação, com limites de sobriedade, vedação de captação indevida e mercantilização; chatbot não pode substituir o julgamento profissional. Fonte oficial: https://www.oab.org.br/leisnormas/legislacao/provimentos/205-2021
2. O acórdão do Conselho Federal, consulta 49.0000.2025.001346-3, de 12/11/2025, é um sinal especialmente relevante de risco para plataformas que intermedeiam escolha de advogados e escritórios virtuais impessoais: https://www.oab.org.br/jurisprudencia/detementa/22176?search=publicidade&title=49-0000-2025-001346-3
3. O Estatuto da Advocacia, Lei 8.906/1994, e o Código de Ética devem integrar parecer específico antes do lançamento comercial.
4. **Não há conclusão de licitude definitiva** para a solução: exigir parecer de advogado especializado em ética profissional e, se pertinente, consulta ao TED da seccional. O nome e a OAB são autodeclarados; a plataforma não confirma inscrição ativa. Não exibir selo de “verificado”.
5. Mitigações: publicação voluntária, conteúdo informativo, ausência de ranking, leilão ou compra de leads, sem cobrança por caso ou honorários, sem indicação de profissionais, sem respostas jurídicas automáticas, sem alegações de resultados.

## Comparação com plataformas de outros setores
| Plataforma | Setor | Modelo observado | Aplicação segura ao Partelís | O que não copiar |
| --- | --- | --- | --- | --- |
| Doctoralia Pro | Medicina e fisioterapia | Perfil no marketplace, agendamento, ferramentas de gestão e planos recorrentes; página oficial consultada mostra planos anuais parcelados Starter R$429, Plus R$529 e VIP R$679 (valores sujeitos a mudança) | Perfil próprio + painel + comunicação | Marketplace com ranqueamento/impulsionamento de advogados sem parecer |
| Zocdoc | Saúde | Cobra taxa única por agendamento de descoberta; agendamentos de pacientes que já buscavam o profissional são gratuitos | Distinguir contato originado por link próprio de descoberta paga, para **analytics**, não para cobrar por caso | Cobrança por conexão/agendamento jurídico |
| GetNinjas | Serviços gerais | Sistema aproxima pedido e profissional por região; profissional usa moedas para liberar contato e orçar | UX de solicitação curta, status do atendimento | Venda de contatos e distribuição algorítmica |
| Workana | Desenvolvimento, design, freelancing | Projetos, propostas, contratação e comissão progressiva de 20%, 10% e 5% do freelancer conforme relacionamento; taxa de serviço do cliente de 4,5% | Perfil, proposta e CRM pós-contato | Comissão sobre honorários e contratação intermediada |
| Zenklub | Psicologia e saúde mental | Plataforma de busca, perfis, agenda e sessões; também oferta B2B a empresas | Gestão da relação profissional-cliente e UX de perfis | Algoritmo de ordenação, teleatendimento e cobrança por sessão |\n| 99Freelas | Desenvolvimento e freelancing | Projetos e propostas; página comercial informa taxa de 5% a 20% e planos premium; termos publicados exibem faixa divergente, confirmar antes de usar valores | Clareza de perfis e fluxo de solicitações | Taxa por contratação, destaque pago e leilão de propostas |\n| Sharetribe (software) | Marketplace genérico | Plataforma de duas pontas, descoberta e transações | Referência de modelagem de perfis e estados | Código legado não mantido e licença restritiva; não incorporar |

Fontes primárias:
- Doctoralia: https://pro.doctoralia.com.br/preco
- Zocdoc: https://www.zocdoc.com/provider-help/en/articles/10859404-understanding-zocdoc-pricing-and-billing
- GetNinjas: https://www.getninjas.com.br/central-de-ajuda/cliente/pedidos-sou-cliente/como-os-profissionais-sao-selecionados
- Workana: https://help.workana.com/hc/pt/articles/360041235874-Como-%C3%A9-calculada-a-comiss%C3%A3o-na-Workana
- Workana planos: https://help.workana.com/hc/pt/articles/360048765794-O-que-s%C3%A3o-os-planos-para-clientes\n- Zenklub termos: https://webflow.zenklub.com.br/termos\n- Zenklub B2B: https://zenklub.com.br/empresas\n- 99Freelas: https://www.99freelas.com.br/como-funciona/?for=freelancer e https://www.99freelas.com.br/termos

## Modelo de negócio e validação
- **Produto:** Partelís SaaS por escritório. O perfil e a caixa de solicitações são um diferencial de aquisição/retensão do software, não uma corretora de casos.
- **Receita:** assinatura recorrente já existente. Inicialmente incluir a funcionalidade em piloto sem taxa por lead, sem comissão e sem plano separado; testar disposição a pagar antes de alterar preços.
- **Economia:** custo de operação inclui infraestrutura, suporte, moderação, antifraude, LGPD e aquisição de assinantes; não confundir faturamento com margem.
- **Hipóteses de teste (não projeções):** convidar 10 escritórios; ativação = perfis completos/publicados ÷ convidados; valor = perfis que receberam contato legítimo; retenção = escritórios ativos após 30 dias; conversão SaaS = interessados que viraram assinantes. Avaliar sinais com entrevistas, não declarar causalidade com amostra pequena.
- **Risco de marketplace bilateral:** captar público leigo e advogados simultaneamente é caro; primeiro vender software a advogados que compartilham seus próprios links. Um diretório público exige nova decisão de negócio e jurídica.

## GitHub de terceiros: pesquisa de inspiração, não código incorporado
- https://github.com/calcom/cal.com — UX de disponibilidade, tipos de evento, convites e agendamento; repositório grande, AGPL-3.0 conforme FAQ oficial, com edição Enterprise sob regras adicionais; não incorporar sem avaliação jurídica. Referência: https://cal.com/pt-BR/faq
- https://github.com/formbricks/formbricks — formulários, consentimento e pesquisa; licença mista com partes AGPL e comerciais, revisar arquivos antes de reutilizar.
- https://github.com/documenso/documenso — trilhas de assinatura e documentos; AGPL-3.0, risco de obrigações de redistribuição em SaaS.
- https://github.com/medusajs/medusa — arquitetura modular e API; núcleo MIT, partes Enterprise separadas; foco e-commerce, não é base direta para a advocacia.
- https://github.com/sharetribe/sharetribe — fluxos de marketplace; Sharetribe Go não é mais mantido e usa Community Public Licence, não adotar como base do Partelís.

**Decisão técnica:** usar código próprio em Node.js e PostgreSQL do Partelís; nenhuma dependência, cópia de código ou licença de terceiros foi adicionada.

## Escopo implementado no branch
- Migração PostgreSQL: `ops/native/migrations/2026-11-18-conexoes.sql`.
- Serviço de dados multi-tenant: `ops/native/connections.cjs`.
- Gestor: `/conexoes` para editar perfil, optar por publicar e administrar solicitações.
- Público: `/profissional/:slug`, somente via link compartilhado, sem indexação de busca no piloto.
- API: `/api/conexoes`, `/api/conexoes/perfil`, `/api/conexoes/solicitacoes`, `/api/conexoes/solicitacoes/status`, `/api/public/conexoes/:slug` e POST `/api/public/conexoes/:slug/solicitacoes`.
- Solicitação exige consentimento, sem campo de narrativa de caso ou upload de documentos. Formulário informa que contato não constitui contratação.
- Landing: anúncio explícito de funcionalidade em piloto, não oferta de marketplace já ativo.

## Pré-requisitos antes de publicar
1. **Parecer jurídico de ética OAB e revisão LGPD** (bases legais, papéis controlador/operador, retenção, direitos do titular, incidentes, canal de contato).
2. Revisão de segurança e privacidade: CSRF/origin, rate limiting distribuído por IP, CAPTCHA ou antifraude, prevenção de spam, retenção/exclusão de solicitações, logs de auditoria, backups, verificação manual da inscrição OAB e bloqueio de perfis abusivos.
3. Executar migração no PostgreSQL real em janela controlada; validar rollback/backup. Não há execução automática desta migração.
4. Executar `npm run build`, `npm test`, `npm run test:deploy`, testes de integração em staging com banco real e análise de acessibilidade.
5. Publicar somente após aceite de produto e compliance; acompanhar leads legítimos, abuso, suporte, ativação e cancelamentos.

## Memória de projeto / pauta contínua de estudo SaaS
Este arquivo é a **memória técnica persistente no repositório**, não uma alteração manual da Memória do ChatGPT.

Pesquisar e revisar a cada ciclo: (a) ICP e JTBD de advogado autônomo; (b) ativação e onboarding; (c) funil visita→cadastro→ativação→pagamento; (d) CAC, LTV, payback, margem, MRR, churn, retenção por coorte; (e) precificação por escritório, limites e empacotamento; (f) multi-tenancy, autorização e isolamento; (g) LGPD e sigilo profissional; (h) SEO informativo e aquisição ética; (i) observabilidade, segurança, backups e SLA; (j) integrações agenda e CRM; (k) OAB/provimentos/acórdãos novos; (l) testes A/B com amostra suficiente.

**Próximo incremento sugerido:** conversão opcional de solicitação em atendimento no CRM por ação explícita do gestor, com deduplicação e trilha de consentimento. Não sincronizar dados externos automaticamente.

## Adendo — correção de escopo: cartão profissional estilo Linktree
**Pedido confirmado:** o recurso principal é um **link na bio / cartão digital do advogado**, e não um marketplace de clientes. O fluxo de solicitação de contato existente é complementar.

### Pesquisa específica de produto e viabilidade
- **Linktree** (https://linktr.ee): agrega links e redes sociais em uma página única; freemium e assinaturas; principal referência de UX e compartilhamento.
- **Beacons** (https://beacons.ai): link-in-bio, personalização, analytics e monetização; adaptar apenas layout, gestão de links e análise agregada, não venda de serviços jurídicos.
- **Carrd** (https://carrd.co): landing pages de uma página, personalização e domínio próprio; referência para flexibilidade de apresentação.
- **Taplink** (https://taplink.at): página de links, botões, formulários e mensagens; referência para onboarding simples.
- **Doctoralia** (https://pro.doctoralia.com.br): perfil profissional de saúde e agendamento; referência de apresentação de credenciais e canais, não de indicação jurídica.
- **GitHub LittleLink** (https://github.com/sethcottle/littlelink): estrutura leve de links com botões de marcas, referência visual e de acessibilidade; verificar licença e marca antes de copiar qualquer trecho.
- **GitHub LinkStack** (https://github.com/LinkStackOrg/LinkStack): solução self-hosted de links, painel e temas; inspiração funcional, não adotar integralmente.
- **GitHub BioDrop** (https://github.com/EddieHubCommunity/BioDrop): projeto comunitário de perfil e links, atualmente arquivado; referência histórica, não base de produção.
- **GitHub Dub** (https://github.com/dubinc/dub.link): gestão de links e métricas; verificar licenciamento e custos antes de eventual integração.

**Modelo de negócio:** cartão como parte da assinatura recorrente do SaaS; ativação em 5 minutos, link compartilhável e retenção por uso. Testar inclusão no plano Solo versus diferenciação de plano superior somente com dados de adoção e entrevistas. Evitar precificação por leads, honorários ou indicações. O usuário é o advogado, e o destinatário é qualquer pessoa que receba o link, não um mercado de dois lados.

**OAB:** o Anexo Único do Provimento 205/2021 prevê expressamente cartão de visita eletrônico e QR Code, com nome e inscrição OAB; o art. 4º, §3º, admite contatos e redes sociais, e a orientação da OAB admite link para WhatsApp com sobriedade e sem captação indevida. Fontes: https://www.oab.org.br/leisnormas/legislacao/provimentos/205-2021 e https://www.oab.org.br/publicacoes/download?LivroId=0000010367 . A autorização genérica não dispensa análise do conteúdo individual publicado.

**MVP adicionado ao branch:** até oito botões ordenáveis, tipos WhatsApp/Instagram/LinkedIn/YouTube/site/agenda/e-mail/outro, validação HTTPS e mailto, três temas, prévia no editor, cartão responsivo e exportação de contato vCard, além do formulário já existente. Sem upload de fotos ou arquivos e sem dependências externas. QR Code gerado localmente, estatísticas de cliques com privacidade, domínio próprio e foto opcional ficam para evolução após validação técnica e jurídica.

**Pauta de pesquisa SaaS persistida no repositório:** acompanhar ativação do cartão, porcentagem de cartões publicados, compartilhamento voluntário, retenção de 30/90 dias, uso de botões, impacto no churn, custo de suporte, custo por workspace, funil de assinatura, segurança de URLs externas, SEO ético, acessibilidade, gestão de temas, limites de planos e compliance OAB/LGPD.
