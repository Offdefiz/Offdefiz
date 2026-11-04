#!/bin/bash
# A dedicated rclone Drive remote named partelis-drive and an age recipient are required.
set -euo pipefail
umask 077
: "${AGE_RECIPIENT:?Configure the offline recovery key recipient}"
tmp=$(mktemp -d)
trap 'rm -rf -- "$tmp"' EXIT
archive="partelis-$(date -u +%Y%m%dT%H%M%SZ).dump.age"
runuser -u postgres -- pg_dump -Fc partelis | age -r "$AGE_RECIPIENT" -o "$tmp/$archive"
remote="partelis-drive:"
folder="${DRIVE_FOLDER_ID:?Configure a pasta de destino no Drive}"
rclone copyto --drive-root-folder-id "$folder" "$tmp/$archive" "$remote$archive"
expected=$(sha256sum "$tmp/$archive" | cut -d' ' -f1)
actual=$(rclone cat --drive-root-folder-id "$folder" "$remote$archive" | sha256sum | cut -d' ' -f1)
test "$actual" = "$expected"
echo "Backup externo verificado: $archive"
