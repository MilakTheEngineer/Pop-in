CREATE TABLE booking_email_outbox (
 id text PRIMARY KEY,
 shop_id text NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
 subject_type text NOT NULL CHECK(subject_type IN ('booking','visit')),
 subject_id text NOT NULL,
 event text NOT NULL CHECK(event IN ('confirmation','change','cancellation','reminder')),
 event_key text NOT NULL UNIQUE,
 payload_ciphertext text,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sending','sent','uncertain','superseded')),
 attempts integer NOT NULL DEFAULT 0,
 first_attempt_at timestamptz,
 lease_until timestamptz,
 provider_id text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX booking_email_outbox_pending ON booking_email_outbox(state,created_at);
