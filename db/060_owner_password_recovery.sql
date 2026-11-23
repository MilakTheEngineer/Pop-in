CREATE TABLE owner_password_recovery_tokens (
 id text PRIMARY KEY,
 staff_id text NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
 email text NOT NULL,
 token_hash text NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 used_at timestamptz,
 invalidated_at timestamptz
);
CREATE INDEX owner_password_recovery_rate ON owner_password_recovery_tokens(staff_id,created_at DESC);
