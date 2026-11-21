CREATE TABLE support_rate_lock (id integer PRIMARY KEY CHECK(id=1));
INSERT INTO support_rate_lock(id) VALUES(1);
CREATE TABLE support_reports (
 id text PRIMARY KEY,
 client_hash text NOT NULL,
 screen text NOT NULL,
 category text NOT NULL CHECK(category IN ('bug','idea','design','nothing')),
 message text NOT NULL,
 reply_email text,
 founder_shop_id text REFERENCES shops(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_reports_created ON support_reports(created_at DESC);
CREATE INDEX support_reports_client_created ON support_reports(client_hash,created_at DESC);
