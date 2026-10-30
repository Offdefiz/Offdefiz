# Caixa Jurídico — contratos, assinaturas e Asaas (branch de desenvolvimento)

**Estado:** implementação inicial, não habilitada no aplicativo público. Nenhuma cobrança ou assinatura real é emitida por estes arquivos.

## Decisões aprovadas
- Gerar contratos a partir de modelos versionados, com proposta aceita e condições preservadas.
- Renderização de contrato pelo backend, PDF e hash SHA-256 sobre o PDF final.
- Assinatura por provedor especializado; avaliar Clicksign e Autentique pela API, custo, evidências, incorporação e licença SaaS.
- Asaas por conta própria de cada escritório, com cobranças associadas a parcelas reais somente após autorização.
- Webhooks autenticados e idempotentes; registrar payload mínimo e referência do evento; jamais marcar parcela como paga só por resposta do navegador.
- Supabase: isolamento por escritório e RLS, arquivos privados, trilha de auditoria.

## Princípios de segurança
**Não inserir dados reais de clientes no protótipo.** Nunca armazenar chave de API no front-end, Git, logs ou tabela legível por usuários. Cadastrar secrets exclusivamente no servidor. Testar com Sandbox e contas fictícias. Nunca reutilizar token Asaas entre escritórios. Webhook deve verificar `asaas-access-token` e proteger contra reprocessamento. Eventos de pagamento devem ser reconciliados com consulta ao Asaas. Disponibilizar documento final e evidências de assinatura com autorização por escritório, evitando bucket público.

## Variáveis previstas (não configuradas)
`ASAAS_ENV=sandbox`, `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`. Para operação multi-escritório, não usar uma única chave global: configurar credenciais individuais criptografadas por tenant.

## Próximas etapas antes de uso
1. Criar migrações de templates, documentos, signatários, envelopes, credenciais por tenant, cobranças e eventos, com RLS e testes.
2. Implementar rotas protegidas de prévia, geração PDF, envio para assinatura, status, cancelamento e evidências.
3. Integrar provedor de assinatura com adaptador dedicado, habilitando somente após homologação comercial e técnica.
4. Integrar criação de clientes e pagamentos Asaas, idempotência, webhooks, reconciliação e trilha de auditoria.
5. Construir telas, testes automatizados e testes ponta a ponta em ambiente de homologação; revisar validade jurídica dos contratos e política de privacidade.
6. Aprovação de produção separada, sem cobrar clientes automaticamente.

## Observação jurídica
Assinatura eletrônica simples/avançada não deve ser apresentada como assinatura qualificada ICP-Brasil. Integridade, autoria, evidências e requisitos específicos do título devem ser revisados antes do lançamento. Modelo de honorários deve ser validado por advogado habilitado.
