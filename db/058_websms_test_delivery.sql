-- One explicitly authorised test, not a customer reminder queue.
CREATE TABLE websms_test_reminder (
 id text PRIMARY KEY,
 shop_id text NOT NULL REFERENCES shops(id),
 status text NOT NULL CHECK(status IN ('sending','accepted','uncertain','delivered','undelivered')),
 provider_id text UNIQUE,
 parts integer,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE websms_test_receipt (
 provider_id text PRIMARY KEY,
 status text NOT NULL CHECK(status IN ('DELIVRD','UNDELIV')),
 received_at timestamptz NOT NULL DEFAULT now()
);
