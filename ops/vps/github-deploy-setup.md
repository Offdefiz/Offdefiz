# Publicação protegida pela VPS

O workflow `Partelís · publicação automática em produção` publica cada push no
`main` após build, testes de regressão e integração PostgreSQL. Não exige uma
mensagem especial de commit. A revisão publicada é o SHA fixo daquele push.
O workflow manual `Publicar Partelís na VPS` continua disponível para uma revisão
específica. Ambos usam o ambiente `production` e a mesma fila de publicação,
sem interromper um deploy em execução. Sem os quatro segredos abaixo, a
publicação falha antes do SSH.

Para o fluxo autorizado de publicação automática, o ambiente `production` não
deve exigir aprovação manual. A integração no `main` continua sujeita às regras
do repositório e deve acontecer depois de validar a alteração. Uma alteração só
está publicada quando o job de deploy termina com sucesso e o healthcheck do
site confirma o funcionamento. Falha de acesso ou de deploy deve ser reportada
como bloqueio de publicação, sem considerar o trabalho concluído.

Segredos do ambiente `production`:

- `PARTELIS_VPS_HOST`: IP ou hostname da VPS;
- `PARTELIS_VPS_PORT`: porta SSH;
- `PARTELIS_VPS_HOST_KEY`: linha da chave pública do servidor conferida fora da rede
  com o fingerprint apresentado pelo provedor (não aceitar `ssh-keyscan` sem conferência);
- `PARTELIS_DEPLOY_KEY`: chave privada exclusiva do usuário de publicação.

Na VPS, criar o usuário `partelis-deploy` com a chave pública correspondente,
sem login por senha. O único comando permitido em `sudoers` para esse usuário
deve ser o wrapper root `/usr/local/sbin/partelis-deploy-commercial`, instalado
a partir de `ops/vps/partelis-deploy-commercial` com dono root e modo 0755. A
primeira publicação precisa instalar esse wrapper a partir de uma cópia
verificada do repositório.
Restringir o usuário SSH a este comando quando possível.

Antes da primeira execução, confirmar na VPS:

1. Serviço PostgreSQL local e `partelis` ativos, owner configurado;
2. `partelis-backup.service` produz cópia criptografada fora da VPS e restaura;
3. DNS e TLS válidos para `partelis.com.br`;
4. Revisão aprovada contém a migração incremental;
5. Nenhum dado real de cliente foi incluído na demonstração.

O script de deploy bloqueia a troca se backup, restauração, testes ou healthcheck
falharem. Seu rollback reverte o código, mas a migração deve ser aditiva. Não
disparar este workflow antes de validar o wrapper, a chave SSH e o backup.
