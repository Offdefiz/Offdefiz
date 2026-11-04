# Partelís — Estudo de provedores de monitoramento judicial (03/11/2026)

## Decisão de segurança jurídica

NÃO utilizar a API pública DataJud do CNJ como insumo comercial da Partelís sem autorização expressa. O Termo de Uso 1.2, itens 3.3 e 3.8, limita exploração comercial; a Portaria CNJ nº 160/2020, na redação atribuída à Portaria nº 374 de 14/08/2026, prevê usos legais, não comerciais e autorizados, vedando distribuição, venda ou exploração comercial de dados. Além disso, o CNJ não garante precisão, integridade e atualidade.

Fontes:
https://datajud-wiki.cnj.jus.br/api-publica/termo-uso/
https://atos.cnj.jus.br/atos/detalhar/3453
https://www.cnj.jus.br/sistemas/datajud/api-publica/

A API pública pode ser estudada como referência de estrutura de metadados e para análise não comercial conforme suas condições, sem processamento de processos de clientes nem integração operacional nesta aplicação.

## Alternativa comercial inicialmente verificável

JUDIT API publica contrato de consultas e monitoramento em https://judit.io/planos-api/ . Página consultada em 03/11/2026:
- Faixa de referência anunciada no modelo API anual pós-pago: R$ 1.000/mês de volume, consultas a partir de R$ 0,25 por transação, monitoramento processual a partir de R$ 1,50 (na faixa exibida). Tarifas, unidade e mínimos variam conforme modelo/faixa.
- A própria página diferencia consulta pontual e monitoramento contínuo, autos processuais, DJEN e outras operações. Custos de anexos e novos processos podem ser separados.
- Solicitar proposta comercial, SLA, termos de licenciamento/revenda, cobertura dos tribunais e ambiente de sandbox antes de assumir qualquer preço como obrigação contratual.

A Partelís mira autônomos e escritórios de 1–2 advogados. Um mínimo mensal de fornecedor próximo de R$ 1.000 pode inviabilizar a inclusão sem limite de monitoramento em planos SaaS econômicos. Opções: venda como adicional, franquia mensal por escritório ou habilitação somente após volume suficiente. Não assumir pacote de preço até obter contrato.

## Arquitetura de integração futura

- Interface interna única: registerCase(workspaceId,caseId,cnj), pollUpdates(workspaceId,caseId), stopMonitoring(workspaceId,caseId).
- Autorização pela membership do escritório; nenhum workspaceId vindo do navegador determina permissão.
- Armazenar provider_id, checksum de evento, data da consulta, última movimentação, fonte, horário e eventual falha.
- Fila de retentativas com idempotência, backoff e cota mensal por escritório; bloquear quando exceder orçamento.
- Exibir dados como informação auxiliar que exige conferência no processo/diário, não como prazo, intimação certificada ou disparador de petição.
- Não capturar conteúdo de processos sigilosos sem base jurídica e autorização específica.
- Testar eventos duplicados, resposta vazia, indisponibilidade do tribunal, documento restrito, suspensão de assinatura e troca de fornecedor.

## Estado

Pesquisa de licenciamento e preço: inicial. Credencial e contrato comercial: indisponíveis. Adaptador ligado a processo real: NÃO IMPLEMENTADO. Nenhuma consulta de cliente feita.
