# Database backups

The `varello-backup` Railway service takes an encrypted PostgreSQL dump, uploads it to the private `varello-pilot-backups` bucket, downloads it again and restores it into a temporary PostgreSQL instance. Its Railway cron is configured for 14:00 UTC daily. Check the service logs for `Backup uploaded and restored successfully`; a successful deployment alone does not prove the job ran.

The service stores the encryption passphrase and bucket credentials as Railway variables. Keep a separate, secure copy of the passphrase and the booking-email encryption key: without them the corresponding backups or queued email contents cannot be recovered if access to the Railway project is lost. Do not rotate either key without planning how existing data will be decrypted.

To recover, use a separate, empty PostgreSQL 18 instance first. Obtain the desired encrypted archive from the private bucket and the passphrase from the backup service's restricted variables. Decrypt the archive with GPG and restore it with `pg_restore --exit-on-error --no-owner --no-privileges` into that empty instance. Verify the schema, shop access and bookings before considering a cutover. Never restore into the live database as a test. Restore the booking-email key separately and keep outbound messaging disabled during a rehearsal.

Backups currently have no automatic expiry and failures are visible in Railway logs; independent alerting and a tested copy of recovery secrets outside Railway are still needed. Review storage usage and retention before the bucket grows significantly.
