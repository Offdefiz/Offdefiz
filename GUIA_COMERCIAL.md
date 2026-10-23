# Opspulse — funil de vendas digitais

Este projeto NÃO inicia conversas com membros de outros grupos e não faz spam. Quem clica em um link de campanha `https://t.me/Opspulsbot?start=c_<codigo>` conversa voluntariamente com o bot. Isso permite identificar a origem da visita, mostrar catálogo e registrar solicitação de compra.

## Jornada de conversão

1. O proprietário cria uma campanha no painel **Funil Opspulse** e copia o link gerado.
2. Compartilha esse link apenas em diretórios, listas ou comunidades que permitam sua divulgação.
3. A pessoa inicia o bot voluntariamente pelo link, recebe o menu e fica registrada como visitante.
4. `/catalogo` mostra produtos e preços configurados; `/comprar N` registra pedido pendente para confirmação manual. Não há cobrança nem entrega automática.
5. `/entrar` mostra um link para o grupo, se o proprietário configurou um.
6. `/avisos` autoriza novidades futuras; `/parar` cancela; `/apagarme` exclui dados pessoais registrados nesse sistema.
7. O proprietário pode criar um comunicado no painel e confirmar o envio manual em lotes de até 20 pessoas inscritas. Avisos sem consentimento não são enviados. Envios de resultado incerto não são repetidos automaticamente.

## Padrão de campanha sugerido

Título: `Conheça nossa seleção digital`
Texto: `Catálogo organizado de produtos digitais, preços transparentes e atendimento automatizado. Veja as opções no nosso bot: [link personalizado]`. 

Não prometa acesso imediato antes de conferir pagamento, estoque digital e direitos de uso. Não divulgue mídia íntima de terceiros sem consentimento, pirataria ou conteúdos proibidos. O projeto é adequado a produtos e arquivos cuja distribuição você está autorizado a fazer.

## Token e ativação

- Bot existente: **@Opspulsbot**. Não é necessário criar outro.
- Guarde o token do BotFather como segredo, configurado exclusivamente no ambiente do servidor (`TELEGRAM_BOT_TOKEN`).
- O ID numérico do proprietário (`TELEGRAM_OWNER_ID`) é exigido para alertas e operações administrativas.
- Configure `TELEGRAM_WEBHOOK_SECRET` e use `scripts/setup_webhook.py` após ter domínio HTTPS estável.
- Sem token e armazenamento persistente, o sistema pode ser avaliado localmente, mas não realiza operação comercial real.

## Alertas de produção

A versão usa SQLite, adequado apenas a host com disco persistente. Render Free perde arquivos após hibernar, reiniciar ou implantar novamente; usá-lo em produção poderia perder clientes, pedidos e consentimentos. Não ative o webhook nem registre pedidos reais no Render Free antes de migrar os dados para banco persistente (por exemplo, projeto Supabase SEPARADO).

O Telegram limita o início de conversa pelo bot. A autorização `/avisos` é separada da ação inicial `/start`.