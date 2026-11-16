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

- O checkout guarda um pedido pendente com nome, escritório, e-mail, valor, plano e método antes de enviar ao PagBank. Com links estáticos a saída é a mesma, mas só o proprietário pode atestar que recebeu o pagamento.
- Em **Admin → Gerenciar contas e contratações → Pedidos e pagamentos**, localize o cadastro pelo e-mail. Para links estáticos, confira a transação aprovada, valor, método e e-mail no PagBank. Clique em **Confirmar pagamento e liberar** e informe o e-mail que conferiu e a referência única. Não use o e-mail, comprovante avulso ou volta do checkout como prova de pagamento. Se não puder vincular a transação ao cadastro sem ambiguidade, não confirme.
- Na integração por API, o PagBank informa o pagamento validado e o painel oferece **Liberar acesso**. Mantém-se a confirmação humana de liberação. O clique cria o escritório no plano comprado com o limite de usuários, registra o vencimento em 30 dias, gera um convite e tenta enviar o e-mail.
- A renovação continua manual. O vencimento registrado é uma referência operacional, sem débito ou suspensão automática. As solicitações comerciais normais e os convites de avaliação e beta continuam separados.
- Para envio automático, configure no ambiente privado do servidor `PARTELIS_EMAIL_API_KEY` (chave de envio da API Resend) e `PARTELIS_EMAIL_FROM` (endereço de um domínio já verificado). A mensagem vai apenas ao e-mail de acesso do cadastro. Se o provedor recusar ou não estiver configurado, o painel informa isso e permite copiar o link ou reenviar. Não há garantia de entrega na caixa de entrada só pelo aceite do provedor.
- A migração de conciliação é aditiva e idempotente. A rotina da VPS a aplica antes de trocar o serviço. Em hospedeiros que apenas reiniciam o Node, o próprio serviço aplica essa mesma migração se ela estiver ausente. O usuário PostgreSQL da aplicação precisa ser o proprietário das tabelas, conforme a instalação da VPS.

## Verificação

`node --test checkout.test.cjs pagbank.test.cjs` verifica fechamento sem configuração, preços, métodos, destinos de redirecionamento, assinatura bruta, idempotência, divergências de valor e consulta independente da notificação. `node ops/native/payments.verify.cjs` e `node ops/native/reconciliation.verify.cjs` verifica a persistência, reenvios e estornos em um PostgreSQL descartável com o esquema aplicado.

Referências oficiais:
- https://developer.pagbank.com.br/reference/criar-checkout
- https://developer.pagbank.com.br/reference/webhooks-checkout
- https://developer.pagbank.com.br/reference/confirmar-autenticidade-da-notificacao
- https://developer.pagbank.com.br/reference/consultar-pedido
