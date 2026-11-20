-- Marketing permission belongs to a shop and a mobile number, not a guessed
-- person match. Existing contacts are not opted in by migration.
CREATE TABLE marketing_preferences (
 shop_id text NOT NULL REFERENCES shops(id) ON DELETE CASCADE, phone_key text NOT NULL,
 opted_in boolean NOT NULL, source text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(shop_id,phone_key)
);
CREATE TABLE marketing_consent_events (
 id text PRIMARY KEY, shop_id text NOT NULL, phone_key text NOT NULL, opted_in boolean NOT NULL,
 source text NOT NULL CHECK(source IN ('customer','staff','unsubscribe','inbound_stop')),
 actor_id text REFERENCES staff(id), evidence text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(shop_id,phone_key) REFERENCES marketing_preferences(shop_id,phone_key)
);
CREATE INDEX marketing_consent_history ON marketing_consent_events(shop_id,phone_key,created_at);

CREATE TABLE campaigns (
 id text PRIMARY KEY, shop_id text NOT NULL REFERENCES shops(id), name text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('all','reactivation','review','quiet_day')),
 message text NOT NULL, include_booking_link boolean NOT NULL DEFAULT true, offer_date date,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','scheduled','completed','cancelled')),
 scheduled_at timestamptz, last_error text NOT NULL DEFAULT '', last_attempt_at timestamptz, created_by text NOT NULL REFERENCES staff(id), created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
 UNIQUE(id,shop_id), CHECK(kind<>'quiet_day' OR offer_date IS NOT NULL)
);
CREATE TABLE campaign_recipients (
 id text PRIMARY KEY, campaign_id text NOT NULL, shop_id text NOT NULL, recipient_key text NOT NULL,
 phone_key text, client_id text, display_name text NOT NULL, status text NOT NULL CHECK(status IN ('local_preview','excluded')),
 reason text NOT NULL DEFAULT '', token_hash text UNIQUE, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(campaign_id,recipient_key), UNIQUE(id,shop_id), UNIQUE(id,campaign_id,shop_id),
 FOREIGN KEY(campaign_id,shop_id) REFERENCES campaigns(id,shop_id), FOREIGN KEY(client_id,shop_id) REFERENCES clients(id,shop_id),
 CHECK((status='local_preview' AND token_hash IS NOT NULL AND phone_key IS NOT NULL) OR (status='excluded' AND token_hash IS NULL))
);
CREATE TABLE inbox_threads (
 id text PRIMARY KEY, shop_id text NOT NULL REFERENCES shops(id), phone_key text NOT NULL, client_id text,
 unread boolean NOT NULL DEFAULT false, closed boolean NOT NULL DEFAULT false, last_message_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(shop_id,phone_key), UNIQUE(id,shop_id), FOREIGN KEY(client_id,shop_id) REFERENCES clients(id,shop_id)
);
CREATE TABLE inbox_messages (
 id text PRIMARY KEY, shop_id text NOT NULL, thread_id text NOT NULL, direction text NOT NULL CHECK(direction IN ('incoming','outgoing')),
 body text NOT NULL, status text NOT NULL CHECK(status IN ('local_preview','received_test')),
 campaign_recipient_id text, event_key text, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,shop_id), UNIQUE(shop_id,event_key), FOREIGN KEY(thread_id,shop_id) REFERENCES inbox_threads(id,shop_id),
 FOREIGN KEY(campaign_recipient_id,shop_id) REFERENCES campaign_recipients(id,shop_id)
);
CREATE INDEX inbox_messages_thread ON inbox_messages(shop_id,thread_id,created_at,id);
CREATE TABLE campaign_bookings (
 entry_id text PRIMARY KEY, shop_id text NOT NULL, campaign_id text NOT NULL, recipient_id text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(entry_id,shop_id) REFERENCES schedule_entries(id,shop_id),
 FOREIGN KEY(recipient_id,campaign_id,shop_id) REFERENCES campaign_recipients(id,campaign_id,shop_id)
);
ALTER TABLE deposit_holds ADD COLUMN campaign_recipient_id text;
ALTER TABLE deposit_holds ADD CONSTRAINT deposit_hold_campaign_shop_fk FOREIGN KEY(campaign_recipient_id,shop_id) REFERENCES campaign_recipients(id,shop_id);
