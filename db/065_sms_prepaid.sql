-- Prepaid purchases and reservations are retained for reconciliation.
CREATE TABLE sms_credit_purchases (
 id text PRIMARY KEY, shop_id text NOT NULL REFERENCES shops(id),
 amount_cents integer NOT NULL CHECK(amount_cents>0), credits integer NOT NULL CHECK(credits>0),
 price_id text NOT NULL, checkout_id text UNIQUE, payment_id text UNIQUE,
 state text NOT NULL DEFAULT 'creating' CHECK(state IN ('creating','open','paid','cancelled','failed')),
 created_at timestamptz NOT NULL DEFAULT now(), paid_at timestamptz
);
CREATE TABLE sms_credit_reservations (
 outbox_id text PRIMARY KEY REFERENCES sms_reminder_outbox(id),
 shop_id text NOT NULL REFERENCES shops(id), credits integer NOT NULL CHECK(credits>0),
 state text NOT NULL CHECK(state IN ('reserved','released','consumed')),
 created_at timestamptz NOT NULL DEFAULT now()
);
