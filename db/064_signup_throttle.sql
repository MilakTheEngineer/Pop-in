CREATE TABLE owner_signup_attempts (id bigserial PRIMARY KEY, email_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX owner_signup_attempts_created_at ON owner_signup_attempts(created_at);
CREATE INDEX owner_signup_attempts_email_created ON owner_signup_attempts(email_hash,created_at);
