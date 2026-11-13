# Contratação por Pix e cartão
A página /contratar apresenta os preços já publicados: Solo R$ 59/mês, Escritório R$ 119/mês e Equipe R$ 199/mês.
Os botões dos planos da landing apontam para a contratação com o plano selecionado.
O pagamento é realizado em checkout hospedado no provedor. Nenhum dado de cartão passa pelo Partelís.
## Configuração de produção
Configure no ambiente do serviço os links HTTPS reais criados na conta do recebedor:
- PARTELIS_CHECKOUT_SOLO_PIX
- PARTELIS_CHECKOUT_SOLO_CARD
- PARTELIS_CHECKOUT_ESCRITORIO_PIX
- PARTELIS_CHECKOUT_ESCRITORIO_CARD
- PARTELIS_CHECKOUT_EQUIPE_PIX
- PARTELIS_CHECKOUT_EQUIPE_CARD

Cada link deve corresponder exatamente ao plano, preço mensal e método informados. Use links distintos para Pix e cartão e configure o método no provedor. A API não cria cobranças e não modifica as configurações do provedor.
Provedores aceitos: Asaas, Mercado Pago, Stripe e PagSeguro, nos domínios explicitamente permitidos em checkout.cjs.
Após configurar, reinicie o serviço. Nunca use chaves de API como valores dessas variáveis.
Sem link válido, a opção fica bloqueada e oferece contato comercial. Não há cobrança simulada nem confirmação de pagamento baseada no retorno do navegador.
A liberação do escritório permanece assistida no painel comercial existente: confirme o pagamento no provedor antes de criar/liberar acesso e convite. Não há webhook ou ativação automática nesta entrega.
## Verificação
Execute node --test checkout.test.cjs. Inclui rotas HTTP, catálogo, métodos separados, opção sem configuração e endereços maliciosos.
Antes da primeira venda, valide no provedor o recebedor, os preços, a periodicidade, a renovação e o método efetivo de cada link.
