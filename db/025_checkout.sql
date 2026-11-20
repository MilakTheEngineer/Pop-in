-- Money recorded in this ledger was handled outside Pop-in. Fees can be
-- unknown; never infer that an unrecorded provider fee was zero.
ALTER TABLE payment_entries ADD COLUMN purpose text NOT NULL DEFAULT 'unclassified' CHECK(purpose IN ('unclassified','deposit','balance'));
ALTER TABLE payment_entries ADD COLUMN fee_cents integer CHECK(fee_cents BETWEEN 0 AND 1000000);
ALTER TABLE payment_entries ADD COLUMN original_payment_id text;
ALTER TABLE payment_entries ADD CONSTRAINT payment_entries_id_shop_entry_unique UNIQUE(id,shop_id,entry_id);
ALTER TABLE payment_entries ADD CONSTRAINT payment_entries_original_fk FOREIGN KEY(original_payment_id,shop_id,entry_id) REFERENCES payment_entries(id,shop_id,entry_id);
ALTER TABLE payment_entries ADD CONSTRAINT payment_entries_payment_not_refund CHECK(kind='refund' OR original_payment_id IS NULL);

-- Stripe deposits are test-only in this app. Simulated checkout entries stay
-- outside the real manual ledger and its financial reports.
CREATE TABLE checkout_test_entries (
 id text PRIMARY KEY,
 shop_id text NOT NULL REFERENCES shops(id),
 entry_id text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('payment','refund')),
 purpose text NOT NULL CHECK(purpose IN ('deposit','balance')),
 amount_cents integer NOT NULL CHECK(amount_cents BETWEEN 1 AND 1000000),
 tender text NOT NULL CHECK(tender IN ('cash','card')),
 fee_cents integer CHECK(fee_cents BETWEEN 0 AND 1000000),
 original_payment_id text,
 occurred_at timestamptz NOT NULL DEFAULT now(),
 recorded_by text NOT NULL,
 UNIQUE(id,shop_id,entry_id),
 FOREIGN KEY(entry_id,shop_id) REFERENCES schedule_entries(id,shop_id),
 FOREIGN KEY(original_payment_id,shop_id,entry_id) REFERENCES checkout_test_entries(id,shop_id,entry_id),
 CHECK(kind='refund' OR original_payment_id IS NULL)
);
CREATE TABLE checkout_receipts (
 id text PRIMARY KEY,
 shop_id text NOT NULL REFERENCES shops(id),
 entry_id text NOT NULL,
 payment_id text UNIQUE REFERENCES payment_entries(id),
 test_payment_id text UNIQUE REFERENCES checkout_test_entries(id),
 snapshot jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((payment_id IS NOT NULL)::int+(test_payment_id IS NOT NULL)::int=1),
 FOREIGN KEY(entry_id,shop_id) REFERENCES schedule_entries(id,shop_id)
);
CREATE INDEX checkout_receipts_entry ON checkout_receipts(shop_id,entry_id);
