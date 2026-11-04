#!/usr/bin/env bash
# Implantação assistida na VPS Ubuntu. Não executar em outro servidor.
# Uso: sudo bash ops/vps/deploy-commercial.sh <commit-completo>
set -Eeuo pipefail
umask 027
EXPECTED="${1:-}"
REPO="https://github.com/Offdefiz/Offdefiz.git"
BRANCH="feature/partelis-comercial-vps-20261104"
BASE="/srv/partelis"
APP="$BASE/app"
RELEASES="$BASE/releases"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
CANDIDATE=""
OLD=""
SWAPPED=0
VERIFY_DB="partelis_verify_release_$(date -u +%s)"
RESTORE_DB="partelis_verify_backup_$(date -u +%s)"
BACKUP="/var/backups/partelis/pre-commercial-$STAMP.dump"
CHECK_DIR=""

error(){ echo "FALHA: $*" >&2; exit 1; }
if [[ ${EUID} -ne 0 ]]; then error "Execute como root via sudo no terminal da VPS."; fi
[[ "$EXPECTED" =~ ^[a-f0-9]{40}$ ]] || error "Informe o SHA completo de 40 caracteres, não uma branch mutável."
for cmd in git curl node npm pg_isready runuser systemctl; do command -v "$cmd" >/dev/null || error "Dependência ausente: $cmd"; done
id partelis >/dev/null || error "Usuário partelis ausente."
[[ -d "$APP" && -r "$APP/server.cjs" ]] || error "Aplicação atual não encontrada em $APP."
[[ -r /etc/partelis/service.env ]] || error "Arquivo de ambiente ausente."
grep -q '^PARTELIS_OWNER_EMAIL=.' /etc/partelis/service.env || error "Superadmin não configurado."
systemctl is-active --quiet partelis || error "O serviço atual não está ativo; não substituir."
systemctl cat partelis | grep -q 'PARTELIS_STORAGE=postgres' || error "Serviço não confirmado em modo PostgreSQL."
pg_isready -q || error "PostgreSQL indisponível."
[[ -f "$APP/ops/native/backup.sh" ]] || error "Rotina de backup existente não encontrada."

cleanup(){
  if [[ -n "$CANDIDATE" && -d "$CANDIDATE" ]]; then rm -rf -- "$CANDIDATE"; fi
  if [[ -n "$CHECK_DIR" && -d "$CHECK_DIR" ]]; then rm -rf -- "$CHECK_DIR"; fi
  runuser -u postgres -- dropdb --if-exists "$VERIFY_DB" >/dev/null 2>&1 || true
  runuser -u postgres -- dropdb --if-exists "$RESTORE_DB" >/dev/null 2>&1 || true
}
rollback(){
  if (( SWAPPED )); then
    echo "Restaurando versão anterior do aplicativo..."
    systemctl stop partelis || true
    if [[ -d "$APP" ]]; then mv "$APP" "$RELEASES/failed-commercial-$STAMP"; fi
    if [[ -d "$OLD" ]]; then mv "$OLD" "$APP"; fi
    systemctl start partelis || true
  fi
}
finish(){ local code=$?; trap - EXIT; if (( code != 0 )); then rollback; fi; cleanup; exit "$code"; }
trap finish EXIT

echo "[1/8] Obter versão candidata sem modificar a aplicação atual"
mkdir -p "$RELEASES"
CANDIDATE="$(mktemp -d "$BASE/.commercial-XXXXXXXX")"
chown partelis:partelis "$CANDIDATE"
runuser -u partelis -- git clone --quiet --filter=blob:none --no-checkout "$REPO" "$CANDIDATE"
runuser -u partelis -- git -C "$CANDIDATE" fetch --quiet --depth 1 origin "refs/heads/$BRANCH"
runuser -u partelis -- git -C "$CANDIDATE" checkout --quiet --detach FETCH_HEAD
ACTUAL="$(git -C "$CANDIDATE" rev-parse HEAD)"
[[ "$ACTUAL" == "$EXPECTED" ]] || error "Revisão não corresponde ao SHA autorizado."
[[ -f "$CANDIDATE/ops/native/migrations/2026-11-04-sales-onboarding.sql" ]] || error "Migração incremental ausente."

echo "[2/8] Verificações de sintaxe e regressão"
runuser -u partelis -- env NODE_PATH=/usr/share/nodejs npm --prefix "$CANDIDATE" run build
runuser -u partelis -- env NODE_PATH=/usr/share/nodejs npm --prefix "$CANDIDATE" test

echo "[3/8] Testes multi-escritório no banco descartável"
runuser -u postgres -- createdb -O partelis "$VERIFY_DB"
runuser -u partelis -- psql -v ON_ERROR_STOP=1 -q -d "$VERIFY_DB" < "$CANDIDATE/ops/native/schema.sql"
runuser -u partelis -- psql -v ON_ERROR_STOP=1 -q -d "$VERIFY_DB" < "$CANDIDATE/ops/native/migrations/2026-11-04-sales-onboarding.sql"
runuser -u partelis -- env NODE_PATH=/usr/share/nodejs PGDATABASE="$VERIFY_DB" /usr/bin/node "$CANDIDATE/ops/native/verify.cjs"
runuser -u partelis -- env NODE_PATH=/usr/share/nodejs PGDATABASE="$VERIFY_DB" /usr/bin/node "$CANDIDATE/ops/native/commercial.verify.cjs"

echo "[4/8] Backup EXTERNO criptografado obrigatório (falha bloqueia deploy)"
systemctl start partelis-backup.service || error "Backup externo não configurado ou falhou. Corrija antes de publicar."
echo "Backup externo concluído com sucesso."

echo "[5/8] Backup local e prova de restauração"
mkdir -p /var/backups/partelis
chown postgres:postgres /var/backups/partelis
chmod 0700 /var/backups/partelis
runuser -u postgres -- pg_dump -Fc -f "$BACKUP" partelis
runuser -u postgres -- createdb -O postgres "$RESTORE_DB"
runuser -u postgres -- pg_restore --exit-on-error --no-owner -d "$RESTORE_DB" "$BACKUP" >/dev/null
LIVE_COUNT="$(runuser -u postgres -- psql -At -d partelis -c 'SELECT count(*) FROM cj_workspaces')"
COPY_COUNT="$(runuser -u postgres -- psql -At -d "$RESTORE_DB" -c 'SELECT count(*) FROM cj_workspaces')"
[[ "$LIVE_COUNT" == "$COPY_COUNT" ]] || error "Restauração não comprovada."
echo "Backup e restauração validados, sem expor dados no log."

echo "[6/8] Migração aditiva no banco real"
runuser -u partelis -- psql -v ON_ERROR_STOP=1 -q -d partelis < "$CANDIDATE/ops/native/migrations/2026-11-04-sales-onboarding.sql"

echo "[7/8] Troca do serviço preservando a versão anterior"
OLD="$RELEASES/app-$STAMP"
systemctl stop partelis
mv "$APP" "$OLD"
if ! mv "$CANDIDATE" "$APP"; then
  mv "$OLD" "$APP"
  systemctl start partelis
  error "Não foi possível efetivar a troca."
fi
CANDIDATE=""
SWAPPED=1
systemctl start partelis
systemctl is-active --quiet partelis || error "Serviço falhou; rollback automático."

echo "[8/8] Testar saúde, site, app e demonstração pelo próprio domínio"
CHECK_DIR="$(mktemp -d)"
curl -fsS --max-time 12 -o "$CHECK_DIR/health.json" https://partelis.com.br/health
grep -q '"configured":true' "$CHECK_DIR/health.json" || error "Healthcheck público não passou."
curl -fsS --max-time 12 -o "$CHECK_DIR/home.html" https://partelis.com.br/
grep -q 'Solicitar apresentação e proposta' "$CHECK_DIR/home.html" || error "Site comercial não está servindo a nova versão."
curl -fsS --max-time 12 -o "$CHECK_DIR/demo.html" https://partelis.com.br/demo
grep -q 'window.CLOUD=false' "$CHECK_DIR/demo.html" || error "Demonstração não está isolada."
curl -fsS --max-time 12 -o "$CHECK_DIR/app.html" https://partelis.com.br/app
grep -q 'window.CLOUD=true' "$CHECK_DIR/app.html" || error "Aplicativo real não está separado."
SWAPPED=0
echo "PUBLICAÇÃO CONCLUÍDA com SHA: $EXPECTED"
echo "Aplicativo anterior preservado em $OLD"
echo "Backup local protegido em $BACKUP"
echo "Verificar login proprietário e criação de convite na interface antes de habilitar dados reais."
