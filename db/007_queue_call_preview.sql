CREATE TABLE queue_call_previews (
 id text PRIMARY KEY,
 shop_id text NOT NULL REFERENCES shops(id),
 queue_entry_id text NOT NULL UNIQUE REFERENCES queue_entries(id) ON DELETE CASCADE,
 request_key text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(shop_id,request_key)
);
