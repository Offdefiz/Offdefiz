# Partelís — backup e restauração verificável (P0)

**Status:** script versionado, ainda não executado. O Supabase Free não inclui backups diários automáticos. Não usar dados reais antes de validar a restauração e definir retenção.

## Pré-requisitos

- PostgreSQL pg_dump/pg_restore compatíveis com a versão do banco (PG 17).
- Ferramenta age e chave pública para criptografar o dump antes de gravar.
- String privada de conexão no ambiente; nunca salvar no GitHub, prompts, logs ou código.
- Armazenamento privado fora do servidor, com controle de acesso e retenção.

## Exportação

Definir PARTELIS_DATABASE_URL, PARTELIS_AGE_RECIPIENT e PARTELIS_BACKUP_DIR no ambiente privado.

    bash scripts/secure-db-backup.sh

O arquivo .dump.age é criptografado; .sha256 verifica integridade, mas não substitui restauração.

## Testar em banco descartável

1. Criar banco **descartável** separado da produção.
2. Conferir arquivo e hash: sha256sum -c arquivo.dump.age.sha256
3. Testar lista do conteúdo sem gravar dump descriptografado:

    age -d -i "$PARTELIS_AGE_IDENTITY_FILE" "$BACKUP" | pg_restore --list

4. Confirmar que a URL de teste não é a URL de produção, então restaurar somente no ambiente descartável:

    test "$PARTELIS_TEST_RESTORE_URL" != "$PARTELIS_DATABASE_URL" || exit 1
    age -d -i "$PARTELIS_AGE_IDENTITY_FILE" "$BACKUP" | pg_restore --dbname="$PARTELIS_TEST_RESTORE_URL" --clean --if-exists --no-owner --no-acl

5. Conferir tabelas, RLS, isolamento entre escritórios, Auth, migrações e o aplicativo.
6. Registrar data, hash, responsável, resultado e tempo de recuperação em inventário privado.

**Avisos:** dump de banco não contém os arquivos físicos do Supabase Storage, apenas metadados. Restauração em novo projeto pode exigir reconfiguração de extensões, políticas, Auth/Storage e credenciais. Jamais executar restauração destrutiva na base de produção sem plano de incidente e janela autorizada.

## Operação contínua

Agendar backup criptografado e cópia externa com frequência definida, retenção e teste periódico de restauração. Monitorar falhas e armazenamento. Esta documentação não comprova que o backup foi executado.

Fontes:
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
