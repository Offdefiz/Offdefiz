# Gerador de contratos: auditoria e sequência para sandbox

Auditoria em 02/11/2026, a partir da PR #5, commit `4afde74231be93d4985ab74cf332e616256d0b26`.

## Resultado desta alteração

O catálogo `zapsign-formularios.json` é idêntico, byte a byte, ao `formularios_zapsign(1).json` fornecido. SHA-256: `9ab30040f6a5fbd43f800274ad0c0ba48a25da4a364d8ca38f52d2aedd2871e3`. Nenhuma variável, tipo de input, ordem, papel, âncora ou texto dos DOCX foi alterado. O gerador original não foi executado para reconstruir arquivos ausentes.

Foi implementado `POST /api/contracts/preflight`: valida os valores exatos de um modelo após autenticação e verificação do perfil real do escritório (`gestor` ou `especialista`, conforme a permissão existente de contratação). Não aceita simulação de perfil no corpo. A rota não grava estado, não altera o funil, não cria contrato, não chama ZapSign e não retorna valores pessoais, credenciais ou links de assinatura. O frontend ainda não chama essa rota.

Corpo: `{ "modalidade": "holding", "tipo": "procuracao", "values": { ... } }`. As chaves de `values` devem corresponder apenas ao modelo escolhido, usando literalmente `variaveis`. Respostas: `200` para dados válidos; `422` para campos inválidos ou ausentes; `400` para corpo ou modelo inválido; `401` sem sessão; `403` para origem ou perfil sem permissão. `ok` significa apenas validade dos dados. Toda resposta de pré-validação contém `validationOnly: true`, `canCreateDocument: false` e `productionEnabled: false`. Os bloqueios permanecem inclusive com dados válidos ou variáveis de ambiente sugerindo produção.

Os testes ZapSign passaram a integrar `npm test`, que antes executava somente 62 testes e deixava os 3 testes da PR fora da CI. Agora são 87 testes Node, incluindo um teste que executa 5 casos estruturais em Python. `npm run build` também verifica os módulos de pré-validação. Verificação local: Node 24.22.1 e Python 3.12; a CI mantém Node 22.

## Auditoria dos originais

O relatório [zapsign-source-audit.json](zapsign-source-audit.json) registra o hash de cada DOCX disponível. `audited` significa inspecionado, não aprovado para uso. Todos os 12 registros continuam com `sandbox: pending`.

| Modalidade | Documento | Original | Variáveis | Pendências observadas |
|---|---|---|---|---|
| Passivo bancário | Contrato | Conferido | 31, sem divergência | Prefixos R$; última parcela e extenso |
| Passivo bancário | Procuração | Conferido | 15, sem divergência | Âncora de rubrica ausente |
| Passivo bancário | Declaração | Conferido | 9, sem divergência | Âncora de rubrica ausente; prefixo R$ |
| Ação revisional | Contrato | Não localizado | 31 no catálogo, DOCX não conferido | Obter original |
| Ação revisional | Procuração | Conferido | 17, sem divergência | Âncora de rubrica ausente |
| Ação revisional | Declaração | Conferido | 9, sem divergência | Âncora de rubrica ausente; prefixo R$ |
| Superendividamento | Contrato | Conferido | 32, sem divergência | Prefixos R$; última parcela e extenso |
| Superendividamento | Procuração | Conferido | 15, sem divergência | Âncora de rubrica ausente |
| Superendividamento | Declaração | Conferido | 9, sem divergência | Âncora de rubrica ausente; prefixo R$ |
| Holding | Contrato | Conferido | 33, sem divergência | Prefixos R$; última parcela e extenso |
| Holding | Procuração | Conferido | 16, sem divergência | Âncora de rubrica ausente |
| Holding | Declaração | Conferido | 9, sem divergência | Âncora de rubrica ausente; prefixo R$ |

Nos 11 originais conferidos não foram encontradas imagens ou tabelas. O contrato revisional não foi localizado nas buscas nem na pasta Partelís consultada; isso não prova ausência em outras fontes.

Bloqueios concretos:

- O catálogo indica `<<signer1Rubrica>>` nas quatro procurações e quatro declarações; os arquivos têm `<<signer1>>`, mas não a rubrica. Não inserir âncora nem dispensar rubrica automaticamente.
- Sete arquivos já contêm `R$ {{CAMPO}}`, enquanto o roteiro e a validação exigem valores como `R$ 1.000,00`. A substituição literal produziria `R$ R$ 1.000,00`. Validar uma representação de transporte que preserve os originais e as chaves; não retirar o prefixo no catálogo, trocar `dinheiro` ou mudar os DOCX silenciosamente.
- Contratos expressam uma quantidade de parcelas de um valor único. O cálculo de R$ 10,00 em três parcelas resulta em 333, 333 e 334 centavos, mas não existe variável para representar a última parcela diferente. A pré-validação informa essa diferença e mantém a criação bloqueada. Não inventar variável nem alterar o total para contornar isso.
- O preenchimento de `HONORARIO FIXO EXTENSO` ainda não é calculado nem confrontado com o valor numérico. Aceitar texto não comprova coerência; o bloqueio explicita essa pendência.

Reproduzir a auditoria com os originais em diretórios privados:

```bash
python3 scripts/audit_zapsign.py /caminho/originais --catalog zapsign-formularios.json > auditoria.json
```

O comando só lê arquivos e retorna código 1 quando há bloqueios. Une runs XML fragmentados por parágrafo, compara variáveis e âncoras, detecta prefixos monetários, tabelas e imagens e recusa versões diferentes com o mesmo nome canônico. Cópias com sufixos `(1)`, `(2)` só são equivalentes quando seus bytes são idênticos. Os testes estruturais usam fixtures artificiais, sem recriar os documentos jurídicos. A auditoria não renderiza DOCX/PDF e não comprova posição visual das assinaturas.

## Menor sequência restante

1. **Resolver as fontes e as divergências.** Obter o contrato revisional original e definir, com revisão do responsável pelos modelos, o tratamento dos prefixos monetários, das rubricas ausentes e das parcelas diferentes. Preservar versões e hashes; qualquer eventual mudança nos documentos exige decisão explícita. Até lá, manter o bloqueio.
2. **Conectar cadastro e tela somente à pré-validação.** Mapear `client.name`, `client.taxId` PF, `client.email` e `client.phone` às variáveis correspondentes; não usar CNPJ de cliente como CPF. Nacionalidade, estado civil, profissão, RG e endereço completo ainda precisam de campos opcionais; cidade/UF não substituem endereço. `theme.name` sozinho não comprova a razão social do escritório. Não preencher condições jurídicas com inferências nem converter um lead em contratado. Reaproveitar a proposta aceita e versionada; comparar entrada, saldo e parcelas com os recebíveis existentes antes de qualquer envio. Campos de contratação permanecem opcionais no cadastro e obrigatórios apenas na preparação documental. Implementar extenso em português e testes de limites/centavos antes de liberar geração.
3. **Provisionar sandbox uma vez por modelo.** Configurar credencial exclusivamente de sandbox em segredo do servidor; nenhuma está disponível nesta sessão. Fixar a base `https://sandbox.api.zapsign.com.br/api/v1/`, rejeitar qualquer outro host e não fazer fallback para produção. Criar tabela/configuração com chave única por escritório, ambiente, modalidade e tipo, vinculando token do modelo e hashes do DOCX/catálogo. Persistir cada etapa concluída para retomar sem recriar modelos. Aplicar o `update_form_payload` exato do objeto, acrescentando somente o `template_id` retornado.
4. **Implementar criação recuperável em sandbox.** Persistir uma tentativa com chave única por escritório, proposta/versão e modelo antes do POST; vincular o snapshot dos valores. Reenvio simultâneo ou após timeout deve exigir reconciliação, sem repetir POST cegamente. Criar o documento, reconciliar o primeiro assinante retornado e acrescentar apenas os papéis ausentes, na ordem do catálogo. Guardar tokens no servidor sob isolamento de escritório. Validar esquema de resposta, identidade/quantidade dos assinantes e ausência de campos incompletos antes de disponibilizar qualquer link. Manter convites automáticos e notificações desligados durante os testes técnicos. Testar retorno incompleto, 401, 429, timeout, erro parcial e retomada sem duplicação; nunca registrar payloads ou tokens nos logs.
5. **Validar os 12 PDFs e estados antes de produção.** Para cada modelo, registrar hash do original, modelo/documento de sandbox, execução e revisão visual: todas as variáveis substituídas, moeda sem duplicação, extenso/total/parcelas coerentes, texto e paginação preservados, assinatura/rubrica nos locais esperados, ordem e quantidade corretas. Confirmar `signer_has_incomplete_fields` falso; resposta desconhecida ou incompleta deve bloquear links. Exercitar assinatura com identidades de teste controladas, recusa e acompanhamento por consulta autenticada; se houver webhook, tratar duplicatas e consultar o documento para confirmar o estado no provedor. Não marcar assinatura por evento recebido sem verificação. Testar isolamento entre escritórios e impedir acesso cruzado aos links. Só liberar produção em alteração posterior com evidência de 12/12 aprovações, revisão dos modelos e configuração própria de produção.

## Contratos da API confirmados na documentação oficial

Fontes consultadas em 02/11/2026. Documentação confirma o contrato esperado; execução real em sandbox permanece pendente.

| Operação | Caminho sob a base v1 | Detalhe para implementação |
|---|---|---|
| Criar modelo | `POST templates/create/` | Enviar DOCX original por `base64_docx`; obter `token` e guardar vínculo com o arquivo |
| Configurar formulário | `POST templates/update-form/` | `template_id` é obrigatório, além do payload fornecido |
| Criar documento | `POST models/create-doc/` | Usar `template_id` e `data: [{de, para}]`; a resposta exemplifica `token` e `signers[]` |
| Adicionar assinante | `POST docs/{doc_token}/add-signer/` | A documentação já lista `signature_placement` e `rubrica_placement`; confirmar posicionamento com estes modelos |
| Consultar estado | `GET docs/{doc_token}/` | Confirmar documento e assinantes; atualizar URLs temporárias de arquivo por consulta |

A criação via modelo já retorna um primeiro assinante no exemplo oficial. O roteiro fornecido pede adicionar cada papel depois; seguir isso sem reconciliação pode duplicar o contratante. Deve-se aproveitar/atualizar o primeiro e adicionar somente os ausentes. Usar a URL de assinatura retornada e validar ambiente/domínio; não construir um link de produção para um token de sandbox. E-mail de autenticação e convite automático são configurações distintas. Autorizar `tokenEmail` ou `tokenWhatsapp` exige decisão do escritório e teste específico, inclusive para procurações/declarações que não têm variáveis de contato próprias.

- [Ambientes e credenciais](https://docs.zapsign.com.br/ambiente-de-testes)
- [Criar modelo DOCX](https://docs.zapsign.com.br/modelos/create-template-docx)
- [Configurar formulário](https://docs.zapsign.com.br/modelos/create-template-docx/update-form)
- [Criar documento via modelo](https://docs.zapsign.com.br/documentos/criar-documento-via-modelo)
- [Adicionar assinante](https://docs.zapsign.com.br/signatarios/adicionar-signatario)
- [Detalhar documento](https://docs.zapsign.com.br/documentos/detalhar-documento)

## Critério de entrega desta PR

Esta etapa entrega auditoria reproduzível, validação financeira/de campos, rota autenticada sem efeitos e testes na CI. Interface, autopreenchimento, provisionamento de modelos, criação de documentos, persistência das tentativas, assinatura e acompanhamento são a sequência acima, ainda não implementada. Nenhum documento foi enviado ao ZapSign; nenhum teste remoto de sandbox ou PDF foi declarado aprovado. A PR permanece em rascunho e não deve ser integrada/publicada como gerador completo.
