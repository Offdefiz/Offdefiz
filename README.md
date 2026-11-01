# Partelís

Partelís A1 — identidade oficial. Aplicativo piloto para testes com dados fictícios. Interface e regras em JavaScript, servidor Node.js 22 e Supabase separado para autenticação e persistência. Não depende de Render para executar: o servidor aceita PORT e pode rodar em Docker ou outro provedor. Domínio próprio exige apontamento DNS, HTTPS e atualização de PUBLIC_APP_URL.

## Executar

Configure SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY e PUBLIC_APP_URL conforme .env.example, usando variáveis do ambiente. Nenhuma chave administrativa é enviada ao navegador. Execute npm start. npm test verifica regras e proteção básica de rotas. Não há dependências npm para executar o servidor.

Rotas: /login, / (autenticada), /demo (demonstração fictícia isolada no navegador), /apresentacao (peça animada de apresentação), /health. A aplicação autenticada usa cookies HttpOnly e renovação de sessão. Não há cadastro público pela interface. Só contas vinculadas ao escritório recebem dados.

## Dados e permissões

schema.sql descreve o banco inicial e RLS. cj_workspaces, cj_memberships e cj_state separam escritórios. Ambas as contas de teste são gestores e podem simular funções para avaliar o fluxo. Membros sem vínculo não veem registros. O estado é um documento JSON versionado, adequado a este piloto; não se apresenta como modelo relacional final. Atualizações concorrentes são rejeitadas por revisão para evitar sobrescrever trabalho de outra pessoa.

As regras de negócio são executadas no servidor em cada ação. Nesta primeira hospedagem, só gestores escrevem na base via RLS; habilitar colaboradores com funções restritas exige desenhar a API privilegiada e as políticas por operação. Não cadastrar equipe ou clientes reais neste piloto.

## Funcionalidades

Atendimento, dívidas, funil, agenda, reagendamento, propostas versionadas, contratação, parcelas, baixa e estorno, retornos, sinalização ao gestor, passagem ao jurídico e fila por perfil. Gráficos representam recebimentos por data e distribuição atual por etapa; distribuição não é taxa de conversão. Identidade com cor personalizada e presets; tema escuro é preferência do dispositivo. Sombras, vidro e transições respeitam redução de movimento.

## Limites

Assinaturas e recebimentos são registros manuais. Não há geração de contrato, WhatsApp, e-mail, cobrança, conciliação, tribunais, transcrição, acordos ou cálculo de êxito. Modelo financeiro é fixo parcelado; mensalidade contínua permanece pendente. Estado compartilhado é atualizado periodicamente, sem colaboração em tempo real. Não há recuperação de senha self-service nesta versão; as credenciais iniciais ficam somente com o responsável.

Antes de dados reais: segurança independente, modelo relacional com entidades e índices, papéis finais, auditoria protegida, backups/restauração testados, retenção e documentação profissionalmente validada.

## Portabilidade

1. Copiar este código ou usar a imagem Docker.
2. Configurar as mesmas variáveis e um endereço HTTPS próprio.
3. Preservar o Supabase ou migrar banco e usuários com um plano de exportação e restauração separado. Trocar o frontend não exige migrar dados.
4. Atualizar PUBLIC_APP_URL, DNS e configurações de redirecionamento Auth se forem usadas.

As senhas temporárias, nonce de provisionamento, dados pessoais de clientes e documentos do acervo não pertencem ao repositório.

## Melhorias operacionais (incrementais)

- **Meu Dia** organiza as tarefas já existentes em inegociáveis (hoje, vencidas ou escaladas), negociações de alta alavanca e próximos passos. A classificação é determinística e não usa IA nem cria cobranças repetitivas.
- **Financeiro** inclui faixas de atraso (1–7, 8–30 e acima de 30 dias) e projeção de parcelas abertas por mês. Os indicadores são previsões e registros manuais, sem conciliação ou movimentação financeira real.
- **Agenda** oferece abertura manual de um compromisso genérico no Google Calendar e download local de arquivo `.ics`, sempre por ação explícita. **Não é sincronização**: não consulta nem altera automaticamente calendários externos. Os títulos exportados não contêm nomes de clientes; cada evento usa 60 minutos por padrão.
- As melhorias usam o mesmo estado do aplicativo, preservando os fluxos de atendimento, contrato e parcelas. Não há APIs externas, cobrança ou novos serviços contratados.

Para ativar sincronização real com Google Calendar será necessário OAuth por escritório/usuário, armazenamento protegido de tokens, tratamento de conflitos e autorização específica dos participantes.

## Identidade oficial Partelís A1

Logo: duas faixas diagonais arredondadas com os caminhos SVG aprovados; cores fixas #30145F e #8D59FF. Arquivos públicos `/brand-symbol.svg`, `/brand-horizontal.svg`, `/brand-horizontal-white.svg` e `/favicon.svg`; paleta e UI em `/partelis.css` (carregada após estilos legados), metadados, manifest, impressão e apresentação incorporados. Personalização por escritório (`cj_state.theme`) não modifica mais o logotipo ou a paleta oficial do SaaS. URLs, branch `caixa-juridico`, IDs de banco e chaves legadas de localStorage permanecem intocados para evitar perda de dados e falhas de autenticação. PNGs de ícones para iOS podem ser adicionados posteriormente; o manifest atual utiliza SVG.

## Liquid Glass — interface da Partelís

Camada `liquid-glass.css` carregada após `partelis.css` nas páginas da plataforma, login, conta e apresentação animada. Painéis, sidebar, topbar, modais, botões e formulários têm transparência, blur, realces de borda e sombras controladas; em tema escuro há tokens específicos. Fallback para browsers sem backdrop-filter, redução de transparência e prefers-reduced-motion. Mantidas as proporções exatas do SVG A1.

Página pública de documentação para criação de vídeos: `/identidade`. CSS servido em `/liquid-glass.css`. Não usar dados reais no vídeo.
