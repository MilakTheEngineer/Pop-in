-- A connection belongs to one shop and one barber. No calendar event titles or
-- customer details are imported. The sandbox is isolated from real providers.
CREATE TABLE calendar_integrations (
 id text PRIMARY KEY,
 shop_id text NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
 barber_id text NOT NULL,
 provider text NOT NULL CHECK(provider IN ('google','sandbox')),
 account_email text NOT NULL,
 token_ciphertext text,
 status text NOT NULL DEFAULT 'connected' CHECK(status IN ('connected','error','disconnected')),
 last_success timestamptz,
 last_error text,
 conflict_count integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,shop_id), UNIQUE(shop_id,barber_id),
 FOREIGN KEY(barber_id,shop_id) REFERENCES barbers(id,shop_id)
);
ALTER TABLE schedule_entries ADD COLUMN calendar_integration_id text;
ALTER TABLE schedule_entries ADD CONSTRAINT calendar_busy_shop_fk FOREIGN KEY(calendar_integration_id,shop_id) REFERENCES calendar_integrations(id,shop_id);
ALTER TABLE schedule_entries ADD CONSTRAINT calendar_busy_kind CHECK(calendar_integration_id IS NULL OR (kind='block' AND label='External calendar busy'));
CREATE INDEX calendar_busy_entries ON schedule_entries(calendar_integration_id) WHERE calendar_integration_id IS NOT NULL;
CREATE TABLE calendar_exports (
 integration_id text NOT NULL, shop_id text NOT NULL, entry_id text NOT NULL, remote_id text NOT NULL,
 PRIMARY KEY(integration_id,entry_id), UNIQUE(integration_id,remote_id),
 FOREIGN KEY(integration_id,shop_id) REFERENCES calendar_integrations(id,shop_id) ON DELETE CASCADE,
 FOREIGN KEY(entry_id,shop_id) REFERENCES schedule_entries(id,shop_id) ON DELETE CASCADE
);
CREATE TABLE calendar_oauth_states (
 state_hash text PRIMARY KEY, shop_id text NOT NULL, barber_id text NOT NULL, staff_id text NOT NULL REFERENCES staff(id),
 verifier_ciphertext text NOT NULL, expires_at timestamptz NOT NULL,
 FOREIGN KEY(barber_id,shop_id) REFERENCES barbers(id,shop_id)
);
CREATE TABLE calendar_sandbox_events (
 integration_id text NOT NULL REFERENCES calendar_integrations(id) ON DELETE CASCADE,
 remote_id text NOT NULL, origin text NOT NULL CHECK(origin IN ('external','popin')),
 starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, active boolean NOT NULL DEFAULT true,
 PRIMARY KEY(integration_id,remote_id), CHECK(ends_at>starts_at)
);
