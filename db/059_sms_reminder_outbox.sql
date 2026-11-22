CREATE TABLE sms_reminder_outbox (
 id text PRIMARY KEY,
 shop_id text NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
 subject_type text NOT NULL CHECK(subject_type IN ('booking','visit')),
 subject_id text NOT NULL,
 starts_at timestamptz NOT NULL,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sending','accepted','delivered','undelivered','uncertain','superseded','failed')),
 segments integer NOT NULL DEFAULT 0 CHECK(segments BETWEEN 0 AND 11),
 billing_month date,
 provider_id text UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(shop_id,subject_type,subject_id)
);
CREATE INDEX sms_reminder_outbox_pending ON sms_reminder_outbox(state,created_at);
CREATE TABLE sms_delivery_receipts (
 provider_id text PRIMARY KEY,
 status text NOT NULL CHECK(status IN ('DELIVRD','UNDELIV','BLOCKED')),
 received_at timestamptz NOT NULL DEFAULT now()
);
-- Existing opt-ins do not prove which number was consented to; do not backfill.
ALTER TABLE beta_reminder_consent ADD COLUMN sms_phone text;
ALTER TABLE beta_visit_reminder_consent ADD COLUMN sms_phone text;
