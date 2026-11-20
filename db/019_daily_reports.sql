-- No shop is treated as payment-tracked until an owner explicitly opts in.
CREATE TABLE shop_payment_tracking (
 shop_id text PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
 start_date date NOT NULL,
 enabled_by text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
-- Manual ledger entries record money received outside Pop-in. They do not
-- charge a customer. Corrections are represented by refunds, not edits.
CREATE TABLE payment_entries (
 id text PRIMARY KEY,
 shop_id text NOT NULL REFERENCES shops(id),
 entry_id text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('payment','refund')),
 amount_cents integer NOT NULL CHECK(amount_cents BETWEEN 1 AND 1000000),
 tender text CHECK(tender IN ('cash','card','bank_transfer','other')),
 occurred_at timestamptz NOT NULL,
 recorded_by text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(entry_id,shop_id) REFERENCES schedule_entries(id,shop_id)
);
CREATE INDEX payment_entries_shop_time ON payment_entries(shop_id,occurred_at);
CREATE INDEX payment_entries_appointment ON payment_entries(shop_id,entry_id,occurred_at);
