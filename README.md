# Telegram OPS — Central de Operações Comerciais

**MVP local validado, privado, em português, feito com Python 3.11+ e SQLite, sem dependências externas de Python. Não está publicado nem conectado ao bot real.**

## O que já funciona

- Painel responsivo com autenticação, proteção CSRF e relatórios em JSON.
- Catálogo comercial de grupos e canais sem presumir acesso a eles.
- Bot oficial Telegram com comandos privados ao proprietário, registro voluntário de grupos e leitura das estatísticas **somente quando bot autorizado**.
- Auditoria básica de membros (API oficial) aproximadamente a cada hora, quando o servidor estiver executando. A atividade monitorada soma apenas mensagens recebidas em grupos autorizados; o texto dos participantes não é armazenado.
- CRM de contatos, etapas de funil e oportunidades com atualização de status; controle de receitas/despesas informadas manualmente.
- Radar de pesquisa em feeds RSS **externos e cadastrados pelo próprio administrador**: coleta somente títulos e URLs de fontes editoriais públicas, sem recolher mensagens do Telegram, e deduplica resultados.
- Relatório diário automático no Telegram privado do proprietário, às 08h em America/Sao_Paulo, quando houver servidor estável e bot autenticado. Ajustável com `OPS_DAILY_REPORT_HOUR` e `OPS_REPORT_TIMEZONE`.
- Rascunhos, aprovação obrigatória, publicação imediata autorizada ou programada e trilha de eventos. Fila protege contra envios duplicados quando há falha incerta.
- Bot proprietário: `/meuid`, `/status`, `/relatorio`, `/comercial`, `/grupos`, `/oportunidades`, `/registrar`, `/vincular @canal` e `/desativar`.
- **Novo funil Opspulse:** links de divulgação personalizados e rastreáveis, catálogo digital, pedidos de compra manuais, painel de origens, mensagens apenas a inscritos por `/avisos`, cancelamento `/parar` e exclusão `/apagarme`.
- Controle de acesso: verificação de administrador do **bot e do proprietário** antes de registrar/publicar; desativação automática se o bot perder privilégios.
- Testes automatizados para autenticação, autorização e operações comerciais.

**O que NÃO está pronto:** pesquisas gerais automáticas no Telegram; o radar RSS depende de feeds externos e não é um mecanismo de busca universal no Telegram, compra/venda automática de grupos, contato indiscriminado com terceiros, cobrança real, moderação avançada por IA e execução 24 horas garantida. Essas funções exigem autorização, infraestrutura persistente e integrações adicionais. Nenhuma receita ou grupo real foi importado automaticamente.

## Como iniciar localmente

```bash
cd telegram-ops
# O Python 3.11+ já é suficiente; não é necessário pip install.
OPS_PASSWORD='crie-uma-senha-longa' python app.py
```

Abra `http://127.0.0.1:8080` no mesmo computador. A senha é a de `OPS_PASSWORD`.

Se não configurar a senha em um ambiente local, uma senha temporária aparecerá **no terminal**, sem ser salva nos arquivos. Não hospede sem definir credenciais fortes.

O banco fica em `ops.sqlite3` por padrão (não é incluído no ZIP). Para trocar de local: `OPS_DB_PATH=/caminho/persistente/ops.sqlite3`.

## Conectar ao Telegram (etapas na conta do proprietário)

1. No Telegram, abra **@BotFather** e execute `/newbot`. Escolha nome e @username disponível. Não compartilhe o token publicamente ou nesta conversa.
2. No **chat privado do seu bot**, execute `/meuid` depois que o servidor estiver conectado, para obter seu ID numérico. Alternativamente, o ID pode ser conhecido por outro meio autorizado; não confunda com o @username.
3. Configure estas variáveis **no ambiente privado do servidor**, nunca no GitHub:

```bash
export OPS_PASSWORD='SENHA_FORTE_E_UNICA'
export OPS_SESSION_SECRET='SEGREDO_ALEATORIO_DE_PELO_MENOS_32_CARACTERES'
export OPS_DB_PATH='./data/ops.sqlite3'
export TELEGRAM_BOT_TOKEN='TOKEN_DO_BOTFATHER'
export TELEGRAM_OWNER_ID='SEU_ID_NUMERICO'
export TELEGRAM_WEBHOOK_SECRET='SEGREDO_WEBHOOK_SOMENTE_LETRAS_NUMEROS_TRACO_E_UNDERLINE'
```

4. Para **uso público com webhook**, é necessária uma URL HTTPS estável. Configure também `OPS_HOST=0.0.0.0` e `OPS_PUBLIC_URL=https://seu-dominio` no servidor; rode `python app.py`.
5. Com as mesmas variáveis no ambiente, execute `python scripts/setup_webhook.py` **uma vez**. Isso configura o endereço e o segredo no Telegram. Se você fizer testes apenas localmente, o webhook não poderá receber eventos do Telegram sem um endpoint HTTPS acessível.
6. Adicione seu bot à comunidade **como administrador**, concedendo somente permissões necessárias para ler estatísticas e publicar mensagens. Dentro de um **grupo**, o proprietário cadastrado (ID `TELEGRAM_OWNER_ID`) escreve `/registrar`. O grupo então aparece como autorizado no painel.
7. Para canais públicos nos quais você e o bot são administradores, use `/vincular @nomedocanal` no privado do bot. Para grupos, use `/registrar` no grupo.
8. Para o radar público, acesse **Oportunidades → Radar de fontes RSS externas**, informe uma fonte RSS HTTPS autorizada e clique **Pesquisar agora**.
9. Abra **Publicações**, salve um rascunho, clique **Aprovar**, e só então **Publicar agora** ou aguarde a data programada (desde que o servidor esteja ativo).

### Diferença entre o Lemma Telepath e este bot

O Lemma Telepath é uma integração separada de leitura de conversas arquivadas, que não concede automaticamente permissões administrativas ao Telegram OPS. Este pacote não acessa o arquivo Telepath nem importa seus chats.

### Limitações importantes

- Bots do Telegram **não acessam todos os grupos da conta pessoal**, nem descobrem arbitrariamente chats privados.
- O registro `/registrar` funciona em **grupos/supergrupos**; `/vincular @canal` permite vincular canais públicos quando o bot e o proprietário são administradores. Canais privados precisam do ID e das permissões correspondentes.
- Bots não iniciam mensagens com pessoas que não os acionaram. Este projeto responde a contatos que iniciaram o bot e permite comunicados aos inscritos voluntários pelo comando `/avisos`.
- A contagem de mensagens só reflete as atualizações entregues pelo Telegram enquanto o webhook estiver ativo; não é uma contagem histórica de todo o grupo.
- Se o Telegram aceitar uma publicação mas não responder antes do tempo limite, o status vira `verificar_envio` e requer conferência manual. Evita repetir inadvertidamente uma mensagem.
- **Render Free** hiberna por inatividade e perde alterações do filesystem a cada suspensão ou deploy. Não utilize SQLite local nele para operações reais. Utilize hospedagem com disco persistente, ou migre o projeto para um banco externo persistente antes de publicar. O agendador em memória depende de um processo continuamente ativo.
- Esta versão não armazena conteúdo das conversas de grupos; somente contadores agregados e mensagens que o administrador cria como publicações.
- Não publique, compre, venda ou transfira grupos sem autorização e verificação das regras aplicáveis.

## Testar

```bash
python -m unittest discover -s tests -v
```

## Estrutura

- `app.py`: servidor HTTP, autenticação, painel e API privada.
- `db.py`: tabelas SQLite e relatórios.
- `telegram_service.py`: Bot API e autorização, auditoria e envio.
- `sales_service.py`: atendimento comercial opt-in, campanhas, catálogo, pedidos e notificações por consentimento.
- `GUIA_COMERCIAL.md`: funcionamento e cuidados com divulgação.
- `static/`: interface de operação para computador e celular.
- `scripts/setup_webhook.py`: registro protegido de webhook.
- `tests/`: testes automatizados.

## Implantação e bloqueios reais (22/10/2026)

- A conta Telegram pessoal conectada via Lemma Telepath **não fornece credenciais BotFather nem acesso administrativo** ao Telegram OPS.
- A criação de um bot exige autenticação e comando na conta pessoal via @BotFather. **Nunca compartilhe o token no chat**; configure-o somente nos segredos do servidor.
- GitHub está conectado, mas não foi criado repositório para este projeto. Duet e NoteJuris foram mantidos intocados.
- Render Free hiberna e perde SQLite local; seria inseguro publicar uma base operacional nele sem migrar para um banco persistente. O serviço não foi implantado.
- A execução local funciona enquanto o programa estiver aberto; relatórios e publicações agendadas dependem do serviço em execução.
- O radar NÃO garante clientes nem contatos: cria hipóteses comerciais com fontes externas revisáveis. Não aborda ninguém.

## Próximas melhorias sugeridas

1. Hospedagem com armazenamento persistente (ou migração para banco externo), backup automático e auditoria de permissões.
2. Agente de pesquisa por fontes públicas autorizadas e parcerias com opt-in; nunca coleta indiscriminada de chats.
3. Relatórios recorrentes, indicadores reais de conversão e gestão de propostas/contratos.
4. Aprovação via bot, moderação parametrizada e painel multiusuário com níveis de acesso.

## Publicação gratuita, sem colocar dados reais em risco

A pasta inclui `render.yaml`, um Blueprint de avaliação para Render Free. O serviço só deve ser lançado a partir de um repositório GitHub **exclusivo** para este projeto; não altere os repositórios de Duet, NoteJuris nem de perfil para improvisar a publicação. A opção `plan: free` não contrata uma instância paga, mas **não garante ausência de cobrança por excedentes** caso o workspace tenha método de pagamento e exceda cotas de bandwidth/build: confira limites no dashboard.

Na avaliação, o SQLite em `/tmp` é **volátil**, portanto o sistema não deve receber leads, dados privados, mensagens ou grupos reais. O bot não é ativado automaticamente. Antes da operação real, integrar um banco **persistente** com backup e registrar os segredos pelo painel do Render (nunca no GitHub). `RENDER_EXTERNAL_URL` é usado automaticamente quando disponível.

A integração GitHub disponível neste chat permite enviar arquivos a um repositório existente, mas não criar um novo repositório. Para manter projetos isolados, crie `telegram-ops` como repositório privado no GitHub antes de enviar os arquivos.

## Atualização comercial — 23/10/2026

Consulte `GUIA_COMERCIAL.md` para o funil Opspulse. O bot já foi criado pelo usuário e o @username é @Opspulsbot. Este pacote não contém credenciais. A antiga descrição de que o bot nunca envia mensagens comerciais foi substituída pela regra correta: mensagens privadas exclusivamente por iniciativa do usuário ou consentimento expresso para comunicados.