# Partelís — migração para VPS Hospede Aqui

Objetivo: Ubuntu 24.04 LTS, 2 vCPU, 4 GB RAM, São Paulo; domínio partelis.com.br. Migrar para Node.js + PostgreSQL próprios, sem Render ou Supabase.

## Estado desta entrega
Apenas a preparação do sistema operacional foi automatizada em bootstrap-ubuntu-2404.sh. **Nada deste diretório foi executado na VPS.** A aplicação ainda depende de Supabase: o servidor usa /auth/v1 (login, refresh, cadastro, recuperação) e /rest/v1 (escritórios, permissões e painel). O schema.sql também referencia auth.users e auth.uid(). Apontar diretamente ao Postgres local não funciona. Não publicar como versão comercial antes de adaptar o backend e realizar testes.

## Pré-condições de segurança
1. Trocar imediatamente pelo console do provedor a senha root que apareceu na captura de tela; nunca reutilizá-la ou copiá-la para GitHub.
2. Configurar SSH por chave de um usuário administrador com sudo; apenas depois desabilitar autenticação por senha e login remoto root, preservando acesso via console de recuperação.
3. Confirmar a identidade do servidor no painel da Hospede Aqui. Nunca comitar credenciais.

## Preparação da VPS
Após trocar a senha e validar acesso de administrador, o operador pode executar, depois de revisar:

    sudo bash ops/vps/bootstrap-ubuntu-2404.sh

O script instala Node.js 22, PostgreSQL, Nginx, Certbot, UFW, Fail2ban e atualizações automáticas. Cria o usuário restrito partelis e diretórios do aplicativo; libera SSH, HTTP e HTTPS. Não cria banco ou credenciais nem publica o sistema. A regra OpenSSH assume SSH na porta padrão 22 da VPS contratada; ajuste manualmente se o provedor usar outra porta.

## Domínio Umbler — depois da validação da aplicação
- Registro A da raiz (@) para o IPv4 da VPS; opcional CNAME www para partelis.com.br.
- Verificar DNS e emitir Let’s Encrypt com Certbot somente com Nginx configurado para o domínio.
- Colocar Nginx como proxy HTTPS para a aplicação ligada apenas a 127.0.0.1:4180.
- Preferir um subdomínio de homologação antes de mudar o domínio principal.

## Backend independente — obrigatório
- Migrar tabelas para PostgreSQL sem dependência de auth.users ou auth.uid().
- Implementar autenticação própria com senhas fortemente derivadas, proteção antiforça-bruta, cookies seguros, recuperação por e-mail e cadastro fechado.
- Todas as consultas SQL devem ser parametrizadas e autorizadas por papel, usuário e escritório; preservar controle de revisão de cj_state e auditoria.
- Garantir /admin exclusivo ao proprietário, independente de parâmetros do navegador.
- Restringir PostgreSQL a socket/localhost (nunca publicar a porta 5432).
- Backups externos criptografados, restauração testada, monitoramento e logs sem dados pessoais.
- Testes funcionais, RLS substituído por autorização auditada e teste de sete escritórios simultâneos com carga representativa.
- Preservar os módulos, inclusive trabalhos da PR #5 ainda pendentes; não fazer merge de versão que perca funcionalidades.

## Critérios para lançar
- [ ] Senha root exposta substituída; acesso SSH por chave e firewall revisado
- [ ] SO, Node.js e PostgreSQL validados
- [ ] Banco e identidades de teste recriados sem Supabase
- [ ] Autenticação e separação entre escritórios testadas
- [ ] Nginx, domínio e HTTPS com renovação
- [ ] Backup externo e restauração comprovada
- [ ] Fluxos de /admin, CRM, proposta, financeiro e documentos testados
- [ ] Teste de carga com sete escritórios simultâneos aprovado
- [ ] Só então encerrar Render e Supabase

Esta migração parte de um piloto sem clientes reais. Não insira dados reais antes da homologação.
