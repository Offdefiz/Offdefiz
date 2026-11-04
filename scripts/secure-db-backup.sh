#!/usr/bin/env bash
set -euo pipefail
umask 077
if [ -z "$PARTELIS_DATABASE_URL" ] || [ -z "$PARTELIS_AGE_RECIPIENT" ] || [ -z "$PARTELIS_BACKUP_DIR" ]; then
  echo "Configure PARTELIS_DATABASE_URL, PARTELIS_AGE_RECIPIENT e PARTELIS_BACKUP_DIR em variáveis privadas." >&2
  exit 2
fi
command -v pg_dump >/dev/null || { echo "pg_dump não instalado" >&2; exit 2; }
command -v age >/dev/null || { echo "age não instalado" >&2; exit 2; }
mkdir -p -- "$PARTELIS_BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TARGET="$PARTELIS_BACKUP_DIR/partelis-$STAMP.dump.age"
if [ -e "$TARGET" ]; then echo "Backup já existe, não sobrescrevendo." >&2; exit 2; fi
echo "Exportando backup criptografado; nenhum dump em texto claro será salvo..."
pg_dump --dbname="$PARTELIS_DATABASE_URL" --format=custom --no-owner --no-acl | age -r "$PARTELIS_AGE_RECIPIENT" -o "$TARGET"
test -s "$TARGET" || { echo "Arquivo vazio" >&2; exit 1; }
sha256sum "$TARGET" > "$TARGET.sha256"
echo "Backup criptografado em: $TARGET"
echo "Mantenha uma cópia externa e faça teste de restauração em banco descartável."
