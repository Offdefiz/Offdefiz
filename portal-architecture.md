# Partelís — Portal do Cliente (planejamento técnico)

## Objetivo
Um único PWA multi-tenant (white-label discreto por escritório): a marca Partelís permanece como fornecedor tecnológico e o escritório apresenta sua própria identidade complementar. Cada pessoa autenticada pode estar vinculada a um ou mais clientes/casos, sempre por autorização explícita.

## Estado implementado
A rota pública `/cliente/demo` exibe SOMENTE dados fictícios definidos estaticamente em `cliente.js`. Permite navegar por casos, entender honorários e vencimentos, simular localmente uma mensagem e alternar newsletter (sem enviar, coletar ou persistir dados). Não existe endpoint que exponha dados reais nem integração com `cj_state` para o portal público. A rota `/cliente` não está habilitada como login real.

## Entidades propostas (não implementadas na base)
- `portal_people`: pessoa física autorizada e identidade autenticada (auth.uid).
- `portal_client_access`: `auth_user_id`, `workspace_id`, `client_id`, `case_id`, status, nível de visibilidade e datas de concessão/revogação. Vínculo sempre validado no servidor e nas policies.
- `portal_case_updates`: `workspace_id`, `case_id`, status comercial/jurídico, resumo publicável, data, autor, `approved_at`, `visible_to_client`. NUNCA copiar descrição interna ou histórico de transcrição automaticamente para cliente.
- `portal_deadlines`: `workspace_id`, `case_id`, origem (prazo judicial confirmado, compromisso interno, previsão), timezone, responsável, validação e visibilidade. Diferenciar prazos reais de lembretes.
- `portal_fees` e `portal_installments`: contratos e parcelas associados a cliente+workspace, pagamento lançado/confirmado, conciliação, histórico e comprovantes seguros. Nunca deduzir pagamento a partir de proposta.
- `portal_messages`: workspace, case, sender, recipient, body, timestamps, delivery/read status, attachments restritos, auditoria e retenção.
- `portal_newsletters`, `portal_newsletter_receipts`, `portal_consents`: publicação por escritório, segmentação e consentimento voluntário auditável.
- `portal_documents`: armazenamento privado, permissões de objeto, links assinados efêmeros, antivírus e limites de tamanho.

## Segurança e privacidade — barreiras obrigatórias antes de habilitar clientes reais
1. **Não dar acesso de cliente à tabela JSON `cj_state`.** Atualmente contém toda a operação do escritório; acesso direto exporia dados de outras pessoas.
2. Usar Supabase Auth para cliente, com papel próprio e `auth.uid()`. Adotar políticas RLS em TODAS as novas tabelas, filtrando por `workspace_id` + `client_id` + `case_id` + autorização ativa. Nunca confiar em IDs enviados pelo navegador para conceder acesso.
3. Mensagens não são WhatsApp nem transporte de dados sem backend; implementar endpoints, fila e política de notificação com consentimento. Não afirmar leitura/entrega antes de confirmação.
4. Atualizações jurídicas passam por revisão humana, com data/autor. Não sincronizar tribunais por padrão. Intimações e prazos processuais não podem depender exclusivamente de avisos no portal.
5. Financeiro: diferenciar valor contratado, cobrado, confirmado e em disputa. Não habilitar boleto/PIX sem PSP contratado e conciliação.
6. Conteúdo jurídico: triagem e aprovação da equipe, conformidade com sigilo, dever de informação e regras aplicáveis de publicidade profissional.
7. LGPD: finalidade, base legal, transparência, retenção, logs, controle de revogação, backups criptografados, resposta a incidentes, testes automatizados de isolamento A/B e revisão de autorização.
8. Teste de penetração/segurança antes de produção. Não usar dados reais de clientes durante o protótipo.

## Entregáveis de produção sugeridos
Fase 1: convite seguro, vínculo de usuário, lista de casos e atualização manual aprovada.
Fase 2: honorários/vencimentos e documentos privados, auditoria.
Fase 3: mensagens reais, push e newsletter opt-in.
Fase 4: integrações processuais e pagamento real, apenas após validação jurídica e técnica.

## Critério de aceite do isolamento
Autenticar usuário A do escritório A e tentar ler caso do cliente B, caso de outro cliente do mesmo escritório e caso de outro escritório: TODAS as tentativas devem resultar em 403/0 linhas, inclusive por IDs manipulados, buscas, download de arquivos e subscrições realtime.
