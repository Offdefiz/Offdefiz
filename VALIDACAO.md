# Evidências — Telegram OPS / Opspulse — 23/10/2026

## Testes locais

- `python -m unittest discover -s tests -q`: 16 testes aprovados, 0 falhas.
- `python -m py_compile *.py scripts/*.py`: 0 erros de sintaxe.
- `node --check static/app.js`: 0 erros de sintaxe.
- Servidor HTTP iniciado localmente e endpoint `/health` respondeu HTTP 200.
- Chromium automatizado presente, mas a política do navegador bloqueou `http://127.0.0.1:18080/`; NÃO foi possível comprovar o visual da página por screenshot.

## Cobertura de testes

- Bloqueio sem sessão/CSRF, webhook protegido e permissões administrativas.
- Criação de grupos e fluxo de publicação com aprovação.
- Contagens, estatísticas, relatórios e radar externo.
- Cadastro de visitante por `/start c_origem`.
- Catálogo, preço, pedido pendente sem afirmar pagamento.
- Opt-in `/avisos`, cancelamento `/parar` e envio sem repetição a inscritos.
- Exclusão `/apagarme`, validação de link de grupo e recusa de tentativa de cadastro via grupo.

## Limitações reais

Não há token configurado no ambiente, webhook Telegram conectado, banco persistente ou automações em execução fora dos testes locais. Nenhuma mensagem comercial foi enviada de verdade, nenhum pagamento processado e nenhum conteúdo entregue. Render Free hiberna e descarta SQLite; não é um ambiente de produção seguro para clientes e pedidos.