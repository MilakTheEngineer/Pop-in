-- Inventory quantities, dollar balances and visit entitlements have separate units.
CREATE TABLE products (
 id text PRIMARY KEY, shop_id text NOT NULL REFERENCES shops(id), name text NOT NULL,
 unit text NOT NULL, price_cents integer NOT NULL CHECK(price_cents>=0),
 cost_cents integer NOT NULL DEFAULT 0 CHECK(cost_cents>=0),
 on_hand integer NOT NULL DEFAULT 0 CHECK(on_hand>=0), reorder_at integer NOT NULL DEFAULT 0 CHECK(reorder_at>=0),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,shop_id)
);
CREATE TABLE purchase_orders (
 id text PRIMARY KEY, shop_id text NOT NULL REFERENCES shops(id), supplier text NOT NULL,
 status text NOT NULL CHECK(status IN ('draft','ordered','received','cancelled')),
 created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,shop_id)
);
CREATE TABLE purchase_order_lines (
 id text PRIMARY KEY, shop_id text NOT NULL, order_id text NOT NULL, product_id text NOT NULL,
 quantity integer NOT NULL CHECK(quantity>0), cost_cents integer NOT NULL CHECK(cost_cents>=0),
 FOREIGN KEY(order_id,shop_id) REFERENCES purchase_orders(id,shop_id),
 FOREIGN KEY(product_id,shop_id) REFERENCES products(id,shop_id)
);
CREATE TABLE commerce_orders (
 id text PRIMARY KEY, shop_id text NOT NULL, entry_id text NOT NULL,
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','committed','paid','refunded')),
 committed_at timestamptz, refunded_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(shop_id,entry_id), UNIQUE(id,shop_id),
 FOREIGN KEY(entry_id,shop_id) REFERENCES schedule_entries(id,shop_id)
);
CREATE TABLE commerce_lines (
 id text PRIMARY KEY, shop_id text NOT NULL, order_id text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('product','gift_card','package','membership')),
 label text NOT NULL, quantity integer NOT NULL CHECK(quantity>0), price_cents integer NOT NULL CHECK(price_cents>0),
 product_id text, code_hash text, code_last_four text, visits integer, service_id text, valid_until date,
 FOREIGN KEY(order_id,shop_id) REFERENCES commerce_orders(id,shop_id),
 FOREIGN KEY(product_id,shop_id) REFERENCES products(id,shop_id),
 FOREIGN KEY(service_id,shop_id) REFERENCES services(id,shop_id),
 CHECK((kind='product' AND product_id IS NOT NULL AND code_hash IS NULL AND visits IS NULL AND service_id IS NULL) OR
       (kind='gift_card' AND product_id IS NULL AND quantity=1 AND code_hash IS NOT NULL AND visits IS NULL AND service_id IS NULL) OR
       (kind IN ('package','membership') AND product_id IS NULL AND quantity=1 AND code_hash IS NOT NULL AND visits>0 AND service_id IS NOT NULL))
);
CREATE TABLE stock_movements (
 id text PRIMARY KEY, shop_id text NOT NULL, product_id text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('opening','adjustment','purchase_receipt','sale','sale_refund')),
 change integer NOT NULL CHECK(change<>0), balance_after integer NOT NULL CHECK(balance_after>=0),
 reference text NOT NULL, recorded_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(product_id,shop_id) REFERENCES products(id,shop_id)
);
CREATE TABLE prepaid_accounts (
 id text PRIMARY KEY, shop_id text NOT NULL REFERENCES shops(id), kind text NOT NULL CHECK(kind IN ('gift_card','package','membership')),
 code_hash text NOT NULL, code_last_four text NOT NULL, source_line_id text NOT NULL UNIQUE REFERENCES commerce_lines(id),
 client_id text, service_id text, valid_until date, status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','void')),
 original_cents integer, balance_cents integer, visits_issued integer, visits_remaining integer,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,shop_id), UNIQUE(shop_id,code_hash),
 FOREIGN KEY(service_id,shop_id) REFERENCES services(id,shop_id),
 CHECK((kind='gift_card' AND original_cents>0 AND balance_cents BETWEEN 0 AND original_cents AND visits_issued IS NULL AND visits_remaining IS NULL AND service_id IS NULL) OR
       (kind IN ('package','membership') AND original_cents IS NULL AND balance_cents IS NULL AND visits_issued>0 AND visits_remaining BETWEEN 0 AND visits_issued AND service_id IS NOT NULL))
);
CREATE TABLE prepaid_movements (
 id text PRIMARY KEY, shop_id text NOT NULL, account_id text NOT NULL, order_id text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('issue','redeem','reversal','void')),
 cents_change integer NOT NULL DEFAULT 0, visits_change integer NOT NULL DEFAULT 0,
 applied_cents integer NOT NULL DEFAULT 0 CHECK(applied_cents>=0), original_id text UNIQUE REFERENCES prepaid_movements(id),
 recorded_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(account_id,shop_id) REFERENCES prepaid_accounts(id,shop_id),
 FOREIGN KEY(order_id,shop_id) REFERENCES commerce_orders(id,shop_id),
 CHECK(cents_change=0 OR visits_change=0)
);
CREATE TABLE commerce_refunds (
 id text PRIMARY KEY, shop_id text NOT NULL, order_id text NOT NULL UNIQUE,
 recorded_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(order_id,shop_id) REFERENCES commerce_orders(id,shop_id)
);
CREATE INDEX stock_movements_history ON stock_movements(shop_id,product_id,created_at);
CREATE INDEX prepaid_movements_history ON prepaid_movements(shop_id,account_id,created_at);
