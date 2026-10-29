# Caixa Jurídico

Aplicativo piloto para testes com dados fictícios. Interface e regras em JavaScript, servidor Node.js 22 e Supabase separado para autenticação e persistência. Não depende de Render para executar: o servidor aceita PORT e pode rodar em Docker ou outro provedor. Domínio próprio exige apontamento DNS, HTTPS e atualização de PUBLIC_APP_URL.

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
