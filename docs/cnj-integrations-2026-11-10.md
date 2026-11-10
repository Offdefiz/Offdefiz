# Integrações CNJ — 10/11/2026

## Implementado
- DataJud manual por processo, com atualização de capa e movimentos idempotentes.
- DJEN público por número: adaptador com paginação limitada e indicador de resultado parcial.
- Caixa por processo: publicação, estado de revisão e leitura individual por usuário.
- Fila PostgreSQL com índice único para jobs pendentes; worker único por banco, retomada após falha, cinco tentativas e backoff.
- Monitoramento horário somente de processos ativos públicos com CNJ; timer verifica fila a cada cinco minutos.
- Worker revalida perfil/escritório ativo/ACL antes de consultar e gravar.
- Status, erros por código e reprocessamento manual pela interface. Nenhum conteúdo externo vai para logs.
- Indícios e publicações exigem revisão humana. Nenhum prazo fatal automático.

## Ativação e limites
Configurar flags apenas após homologação:
PARTELIS_DATAJUD_ENABLED=true e DATAJUD_API_KEY em /etc/partelis/service.env.
PARTELIS_DJEN_ENABLED=true para o conector público DJEN.
Nenhuma chave foi incluída no repositório.
DataJud: termos oficiais restringem exploração comercial; obter autorização compatível antes do uso no SaaS.
DJEN: página/documentação e endpoint retornaram 403 no ambiente de verificação; testes usam respostas simuladas e não comprovam homologação de rede.
A consulta DJEN por OAB está no adaptador testado; ainda não existe cadastro de inscrições por escritório nem captura completa de processos desconhecidos. Não declarar OAB operacional.
Uma consulta DJEN pode retornar resultado parcial após cinco páginas; isto aparece como status partial. Não é cobertura histórica integral.
O ciclo do worker processa no máximo dez jobs; o intervalo efetivo depende da fila. Monitoramento não garante atualização em tempo real.
Não há A1, acesso a autos sigilosos, e-mail, calendário de prazos ou confirmação jurídica automatizada nesta entrega.

## Instalação do worker
Copiar ops/native/systemd/partelis-cnj.service e partelis-cnj.timer para /etc/systemd/system/.
systemctl daemon-reload
systemctl enable --now partelis-cnj.timer
systemctl start partelis-cnj.service
Acompanhar systemctl status partelis-cnj.timer e cj_cnj_jobs via painel por processo.

## Verificação
npm run build
npm test
CI PostgreSQL executa ops/native/legal.verify.cjs em banco descartável partelis_verify_* e restaura backup separado.
Nunca executar os verificadores no banco real.
Fontes: https://hcomunicaapi.cnj.jus.br/ ; https://www.cnj.jus.br/programas-e-acoes/processo-judicial-eletronico-pje/comunicacoes-processuais/orientacoes-aos-tribunais/ ; https://datajud-wiki.cnj.jus.br/api-publica/termo-uso/
