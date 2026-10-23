# Telegram OPS + Opspulse — Início rápido

## Já realizado

- Bot **@Opspulsbot** criado na conta do proprietário (verificado anteriormente pela conexão Lemma Telepath).
- Base local com painel comercial, links de campanha, catálogo, pedidos manuais, opt-in para novidades e exclusão de cadastro.
- Testes automatizados e verificações sintáticas locais do pacote.

## Para avaliar sem bot conectado

```bash
cd telegram-ops
OPS_PASSWORD='uma-senha-comprida' python app.py
```

Acesse `http://127.0.0.1:8080`, entre no painel e abra a aba **Funil Opspulse**. As campanhas criadas geram links `t.me/Opspulsbot?start=c_...` que só produzirão respostas após configuração real do token e webhook.

## Para ativar de verdade

São necessários: (1) hospedagem com banco persistente; (2) token BotFather em segredo; (3) `TELEGRAM_OWNER_ID` e `TELEGRAM_WEBHOOK_SECRET` privados; (4) URL HTTPS e execução de `scripts/setup_webhook.py`. É possível manter tudo separado de Duet e NoteJuris.

No BotFather não é necessário criar outro bot. Não envie tokens pelo ChatGPT, GitHub ou grupos.

Em Render Free o armazenamento local NÃO é durável e os serviços podem hibernar. O arquivo `render.yaml` é APENAS para visualização técnica; não habilita o bot real por padrão.

Consulte `GUIA_COMERCIAL.md` e `README.md` para funcionamento e limites.