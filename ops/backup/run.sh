#!/usr/bin/env bash
set -euo pipefail
umask 077

: "${PGHOST:?}" "${PGPORT:?}" "${PGDATABASE:?}" "${PGUSER:?}" "${PGPASSWORD:?}"
: "${BACKUP_PASSPHRASE:?}" "${BACKUP_BUCKET:?}" "${BACKUP_ENDPOINT:?}"
: "${AWS_ACCESS_KEY_ID:?}" "${AWS_SECRET_ACCESS_KEY:?}" "${AWS_DEFAULT_REGION:?}"

work=$(mktemp -d /tmp/varello-backup.XXXXXXXX)
running=0
cleanup() {
  if [ "$running" = 1 ]; then pg_ctl -D "$work/pgdata" -m immediate stop >/dev/null 2>&1 || true; fi
  rm -rf -- "$work"
}
trap cleanup EXIT

archive="$work/backup.dump.gpg"
roundtrip="$work/download.dump.gpg"
key="postgres/$(date -u +%Y-%m-%dT%H-%M-%SZ)-$(cat /proc/sys/kernel/random/uuid).dump.gpg"
export GNUPGHOME="$work/gnupg"
mkdir -m 700 "$GNUPGHOME"

# No plaintext archive is written to disk. A failed dump or encryption aborts upload.
pg_dump --format=custom --no-owner --no-privileges \
  | gpg --batch --yes --pinentry-mode loopback --passphrase-fd 3 \
      --symmetric --cipher-algo AES256 --output "$archive" 3<<<"$BACKUP_PASSPHRASE"
test -s "$archive"
aws --endpoint-url "$BACKUP_ENDPOINT" s3 cp "$archive" "s3://$BACKUP_BUCKET/$key" --only-show-errors
aws --endpoint-url "$BACKUP_ENDPOINT" s3 cp "s3://$BACKUP_BUCKET/$key" "$roundtrip" --only-show-errors
cmp -s "$archive" "$roundtrip"

# Restore into an isolated, temporary local PostgreSQL instance, never the source.
initdb -D "$work/pgdata" --auth=trust --username=postgres >/dev/null
pg_ctl -D "$work/pgdata" -o "-k $work -h '' -p 55432" -w start >/dev/null
running=1
createdb -h "$work" -p 55432 -U postgres restore_check
gpg --batch --yes --pinentry-mode loopback --passphrase-fd 3 --decrypt "$roundtrip" 3<<<"$BACKUP_PASSPHRASE" \
  | pg_restore --exit-on-error --no-owner --no-privileges -h "$work" -p 55432 -U postgres -d restore_check
psql -X -v ON_ERROR_STOP=1 -h "$work" -p 55432 -U postgres -d restore_check \
  -c "SELECT 1 FROM schema_migrations LIMIT 1" >/dev/null
echo "Backup uploaded and restored successfully: $key"
