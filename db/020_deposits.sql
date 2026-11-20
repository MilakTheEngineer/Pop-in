-- Deposit settings are opt-in; the seed does not require online payment.
CREATE TABLE deposit_policies (
 shop_id text PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
 refund_mode text NOT NULL DEFAULT 'refund' CHECK(refund_mode IN ('refund','retain')),
 terms text NOT NULL DEFAULT '',
 version integer NOT NULL DEFAULT 1 CHECK(version>0)
);
CREATE TABLE service_deposits (
 shop_id text NOT NULL,
 service_id text NOT NULL,
 enabled boolean NOT NULL DEFAULT false,
 method text NOT NULL CHECK(method IN ('fixed','percent')),
 value integer NOT NULL CHECK(value>0),
 PRIMARY KEY(shop_id,service_id),
 FOREIGN KEY(service_id,shop_id) REFERENCES services(id,shop_id) ON DELETE CASCADE
);
-- Stripe test accounts only. Never store platform credentials in the database.
CREATE TABLE deposit_merchants (
 shop_id text PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
 account_id text NOT NULL UNIQUE,
 charges_enabled boolean NOT NULL DEFAULT false,
 details_submitted boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE deposit_holds (
 id text PRIMARY KEY,
 shop_id text NOT NULL REFERENCES shops(id),
 token_hash text NOT NULL UNIQUE,
 hold_entry_id text NOT NULL UNIQUE,
 booking_entry_id text UNIQUE,
 service_id text NOT NULL,
 barber_id text NOT NULL,
 local_date date NOT NULL,
 local_time text NOT NULL,
 customer_name text NOT NULL,
 email text NOT NULL,
 phone text NOT NULL DEFAULT '',
 price_cents integer NOT NULL CHECK(price_cents>=0),
 deposit_cents integer NOT NULL CHECK(deposit_cents>0 AND deposit_cents<=price_cents),
 refund_mode text NOT NULL CHECK(refund_mode IN ('refund','retain')),
 terms text NOT NULL,
 account_id text NOT NULL,
 expires_at timestamptz NOT NULL,
 state text NOT NULL CHECK(state IN ('creating','pending','failed','expired','paid','refund_pending','refunded','refund_failed')),
 checkout_session_id text UNIQUE,
 payment_intent_id text UNIQUE,
 refund_id text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(hold_entry_id,shop_id) REFERENCES schedule_entries(id,shop_id),
 FOREIGN KEY(booking_entry_id,shop_id) REFERENCES schedule_entries(id,shop_id),
 FOREIGN KEY(service_id,shop_id) REFERENCES services(id,shop_id),
 FOREIGN KEY(barber_id,shop_id) REFERENCES barbers(id,shop_id)
);
CREATE INDEX deposit_holds_expiry ON deposit_holds(shop_id,state,expires_at);
-- Test transactions are kept separate from the report's manual real-money ledger.
CREATE TABLE deposit_test_payments (
 id text PRIMARY KEY,
 hold_id text NOT NULL UNIQUE REFERENCES deposit_holds(id),
 checkout_session_id text NOT NULL UNIQUE,
 payment_intent_id text NOT NULL UNIQUE,
 amount_cents integer NOT NULL CHECK(amount_cents>0),
 currency text NOT NULL CHECK(currency='nzd'),
 created_at timestamptz NOT NULL DEFAULT now()
);
