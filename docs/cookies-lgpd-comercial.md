# Cookies e consentimento no site comercial Partelís

Implementado em 11/11/2026 para `/`, `/contato`, `/contratar`, `/privacidade` e `/cookies`. Não altera fluxos autenticados.

## Inventário do código atual

| Nome | Uso | Categoria | Duração | Escopo |
| --- | --- | --- | --- | --- |
| `pt_cookie_consent` | escolha de privacidade (JSON versionado, categorias e data) | necessário | 180 dias | páginas comerciais |
| `cj_access` | acesso autenticado com HttpOnly e SameSite=Lax | necessário | 1 hora | somente após login |
| `cj_refresh` | renovação de sessão com HttpOnly e SameSite=Lax | necessário | 7 dias | somente após login |

No momento da implementação não constavam GA4, GTM, Meta Pixel ou outra ferramenta de tracking carregada por `landing.html` / `landing.js`; também foi removido o `@import` de fonte externa do CSS comercial. O formulário comercial continua separado do consentimento de cookies. As opções de marketing e analytics na central são **preferências sem serviços ativos** nesta versão; não criam cookies opcionais.

**Atenção:** fornecedores de hosting, scripts adicionados depois e sistemas de segurança de borda podem introduzir mecanismos não inventariados. Refazer auditoria de tráfego/cookies no navegador após cada integração.

## Contrato para integrações futuras

`cookie-consent.js` expõe `window.PartelisCookies` na página comercial:

- `allowed('analytics'|'marketing')`: retorna falso antes de decisão e ao rejeitar.
- `whenAllowed(category, activate)`: instala opcional somente após consentimento; `activate` pode retornar função de limpeza.
- `onChange(callback)`: notifica mudanças.
- `openPreferences()`: permite revisar e revogar.

**Antes de instalar qualquer pixel ou analytics, obrigatoriamente:**
1. Revisar o prestador, base legal, finalidade, transferência internacional, retenção e nomes de cookies reais.
2. Atualizar `cookies.html` e `VERSION` em `cookie-consent.js`, invalidando decisões antigas. Aceites anteriores não autorizam fornecedores novos.
3. Não inserir scripts externos diretamente no HTML/CSS; usar carregamento **somente** após `whenAllowed`.
4. Testar rejeição, bloqueio prévio, retirada, limpeza de cookies da integração, e tráfego de rede. Não enviar dados comerciais sensíveis ao analytics.
5. Submeter revisão jurídica e testes de navegação com leitores de tela e dispositivos móveis.

## Garantias e limitações

- Sem cookie wall: o visitante pode navegar e enviar formulário sem aceitar categorias opcionais.
- Rejeição tão visível quanto aceite; nenhum checkbox opcional pré-marcado em primeira visita.
- Preferência reaberta pelo rodapé de todas as páginas comerciais; validade de 180 dias, e reavaliação por versão.
- `SameSite=Lax; Secure` em HTTPS para o cookie de preferência; autenticação mantém cookies protegidos no servidor.
- Revogação chama a limpeza de integrações registradas e recarrega a página quando havia categoria previamente habilitada; terceiros precisam implementar limpeza própria para cookies de outros domínios.

## Publicação

A rotina `ops/vps/deploy-commercial.sh` agora verifica `/cookies`, `/cookie-consent.js`, presença no HTML comercial e formulário de contato. Mantém backup/restauração, troca atômica do app e rollback automático se os healthchecks falharem.

O workflow GitHub existente de publicação controlada aceita somente merges cuja mensagem contenha `partelis-cookie-release-20261111` ou o token anterior PR17. Publicação depende dos testes Node/PostgreSQL e do ambiente `production` configurado.
