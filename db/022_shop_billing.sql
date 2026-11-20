-- Pop-in subscriptions are separate from a shop's customer deposits.
CREATE SEQUENCE billing_sync_revision_seq;
CREATE TABLE shop_billing_accounts (
 shop_id text PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
 customer_id text NOT NULL UNIQUE,
 subscription_id text UNIQUE,
 subscription_item_id text,
 price_id text,
 amount_cents integer CHECK(amount_cents>=0),
 currency text,
 interval_unit text,
 subscription_status text,
 period_start timestamptz,
 period_end timestamptz,
 cancel_at_period_end boolean NOT NULL DEFAULT false,
 portal_payment_enabled boolean NOT NULL DEFAULT false,
 portal_allowed_prices jsonb NOT NULL DEFAULT '[]'::jsonb,
 portal_configuration_id text,
 sync_revision bigint NOT NULL DEFAULT 0,
 synced_at timestamptz,
 checkout_attempt_id text,
 checkout_price_id text,
 checkout_session_id text,
 checkout_started_at timestamptz
);
CREATE TABLE shop_billing_invoices (
 id text PRIMARY KEY,
 shop_id text NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
 invoice_number text,
 created_at timestamptz NOT NULL,
 status text NOT NULL,
 amount_due integer NOT NULL CHECK(amount_due>=0),
 amount_paid integer NOT NULL CHECK(amount_paid>=0),
 currency text NOT NULL,
 hosted_url text,
 pdf_url text,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX shop_billing_invoices_shop_date ON shop_billing_invoices(shop_id,created_at DESC);
CREATE TABLE shop_billing_events (
 id text PRIMARY KEY,
 shop_id text NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
 event_type text NOT NULL,
 processed_at timestamptz NOT NULL DEFAULT now()
);
-- No SMS integration is connected yet. Coverage is absent by default, and
-- local preview messages are never inserted into this usage ledger.
CREATE TABLE shop_sms_coverage (
 shop_id text PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
 source text NOT NULL CHECK(source IN ('provider','test_fixture')),
 covered_from timestamptz NOT NULL
);
CREATE TABLE shop_sms_usage (
 shop_id text NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
 source text NOT NULL CHECK(source IN ('provider','test_fixture')),
 external_id text NOT NULL,
 occurred_at timestamptz NOT NULL,
 units integer NOT NULL CHECK(units>0),
 PRIMARY KEY(source,external_id)
);
CREATE INDEX shop_sms_usage_period ON shop_sms_usage(shop_id,occurred_at);
