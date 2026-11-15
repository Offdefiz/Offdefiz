# Contratação por Pix e cartão · PagBank

`/contratar` oferece os planos Solo R$59, Escritório R$119 e Equipe R$199.
Cada pagamento cobre um mês e a renovação é manual, para Pix e cartão. A página não cria assinatura recorrente. O cartão é preenchido exclusivamente no checkout hospedado no PagBank; o Partelís não recebe número, CVV ou validade.

## Ativação em produção

1. Aplicar `ops/native/migrations/2026-11-15-pagbank.sql` após a migração comercial.
2. No ambiente privado `/etc/partelis/service.env` da VPS configurar:
   - `PARTELIS_PAGBANK_TOKEN`: token real da conta recebedora, nunca em GitHub, HTML, logs ou documentação.
   - `PARTELIS_PAGBANK_ENABLED=true`.
   - `PUBLIC_APP_URL=https://partelis.com.br` (também pode estar definido na unidade systemd).
3. Reiniciar o serviço e consultar `/api/public/checkout`; deve retornar `provider: "pagbank"` e os métodos habilitados.
4. Abrir `/contratar`, iniciar uma contratação com o preço real e verificar no checkout o recebedor e o método. Não é necessário efetuar pagamento para conferir essa criação.

A API utilizada é exclusivamente `https://api.pagseguro.com` (produção). A URL de notificação é enviada em cada checkout:
`https://partelis.com.br/api/public/payments/pagbank`.
Não cadastrar essa rota no campo “URL do serviço de chave pública do Connect Token Challenge”: aquele campo é outro produto e não é webhook de pagamento.

Sem configuração válida, o gateway fica fechado e mantém o comportamento anterior de links manuais, caso existam. As variáveis `PARTELIS_CHECKOUT_{PLANO}_{PIX|CARD}` continuam disponíveis como alternativa legada.

## Segurança e confirmação

- Preços e identificação dos planos vêm do servidor; não há preço arbitrário enviado pelo navegador.
- A contratação é persistida no PostgreSQL antes da chamada ao provedor, com UUID e chave de idempotência. Reenvios da mesma tentativa usam a referência persistida; o checkout expira em duas horas por padrão.
- O corpo bruto recebido no webhook é validado conforme o contrato atual de Checkout: SHA-256 de `token-payload`, comparado em tempo constante ao header `x-authenticity-token`.
- Além da assinatura, o servidor consulta o pedido diretamente na API autenticada e confere referência local, item, quantidade, moeda BRL, valor e captura integral antes de marcar `paid`. URLs e status enviados no webhook não são fonte de verdade.
- Não existe confirmação de pagamento a partir do retorno do navegador.
- Reenvios são idempotentes na atualização transacional: não duplicam a solicitação comercial. Uma notificação atrasada não rebaixa um pagamento capturado. Estornos são registrados separadamente.
- Guardamos somente dados da contratação, identificadores e estado do pagamento, sem o payload completo, documento ou dados de cartão.
- Assinaturas ausentes, inválidas ou de um contrato diferente são rejeitadas; falhas da API retornam 503 para permitir reenvio do provedor.

## Operação dos acessos

Após `PAID`, uma solicitação de contratação é criada automaticamente no painel `/admin/comercial`. O proprietário pode acompanhar a tabela “Pagamentos PagBank”, confirmar os dados e emitir o convite pelo fluxo existente. A criação do escritório e entrega do convite permanecem assistidas: não há envio de e-mail automático nem cancelamento/suspensão automática de acesso por inadimplência ou estorno nesta integração.
A equipe deve configurar o plano e a data de renovação na operação comercial. O gateway não altera limites de usuários, permissões ou dados existentes.

## Verificação

`node --test checkout.test.cjs pagbank.test.cjs` verifica fechamento sem configuração, preços, métodos, destinos de redirecionamento, assinatura bruta, idempotência, divergências de valor e consulta independente da notificação. `node ops/native/payments.verify.cjs` verifica a persistência, reenvios e estornos em um PostgreSQL descartável com o esquema aplicado.

Referências oficiais:
- https://developer.pagbank.com.br/reference/criar-checkout
- https://developer.pagbank.com.br/reference/webhooks-checkout
- https://developer.pagbank.com.br/reference/confirmar-autenticidade-da-notificacao
- https://developer.pagbank.com.br/reference/consultar-pedido
