#!/usr/bin/env bash
# Partelís — prepara VPS Ubuntu 24.04 LTS. NÃO publica a aplicação.
# Reexecutável. Não usa nem armazena credenciais de administradores.
set -Eeuo pipefail
trap 'echo "ERRO na linha $LINENO. Não prossiga para produção." >&2' ERR

if [ "$(id -u)" -ne 0 ]; then
  echo "Execute como root ou com sudo." >&2
  exit 1
fi
if [ ! -f /etc/os-release ]; then
  echo "Sistema operacional não reconhecido." >&2
  exit 1
fi
. /etc/os-release
if [ "$ID" != "ubuntu" ] || [ "$VERSION_ID" != "24.04" ]; then
  echo "Requer Ubuntu 24.04 LTS; detectado: $PRETTY_NAME" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl gnupg git nginx postgresql postgresql-client ufw fail2ban unattended-upgrades certbot python3-certbot-nginx

# Node.js 22, chave dedicada ao repositório apt NodeSource.
install -d -m 0755 /etc/apt/keyrings
curl --fail --silent --show-error --location \
  https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
  --output /tmp/partelis-nodesource-repo.gpg.key
gpg --batch --yes --dearmor \
  --output /etc/apt/keyrings/nodesource.gpg \
  /tmp/partelis-nodesource-repo.gpg.key
chmod 0644 /etc/apt/keyrings/nodesource.gpg
printf '%s\n' \
  'deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main' \
  > /etc/apt/sources.list.d/nodesource.list
apt-get update
apt-get install -y nodejs
rm -f /tmp/partelis-nodesource-repo.gpg.key

if ! id partelis >/dev/null 2>&1; then
  useradd --system --create-home --home-dir /srv/partelis \
    --shell /usr/sbin/nologin partelis
fi
install -d -m 0750 -o partelis -g partelis /srv/partelis/app
install -d -m 0700 -o root -g root /etc/partelis
install -d -m 0700 -o root -g root /var/backups/partelis

# Libera SSH antes de habilitar o firewall para não perder acesso.
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

systemctl enable --now postgresql nginx fail2ban
systemctl enable --now unattended-upgrades || true

echo
echo "Preparação concluída. Node: $(node --version) | $(psql --version)"
echo "PostgreSQL: $(systemctl is-active postgresql)"
echo "Nginx: $(systemctl is-active nginx)"
ufw status
echo
echo "AINDA PENDENTE: substituir senha root exposta, instalar chave SSH, restringir"
echo "acesso SSH, migrar Auth/API do Supabase, criar banco, apontar DNS,"
echo "HTTPS, serviço Node.js, backups externos, testes de segurança e carga."
echo "Não cadastrar clientes reais nem desligar Render/Supabase ainda."
