ALTER TABLE shops ADD COLUMN queue_paused boolean NOT NULL DEFAULT false;
CREATE TABLE queue_entries (
  id text PRIMARY KEY,
  shop_id text NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  mobile text NOT NULL,
  service_id text NOT NULL,
  preferred_barber_id text,
  assigned_barber_id text,
  status text NOT NULL CHECK(status IN ('waiting','called','seated','left')),
  token_hash text UNIQUE NOT NULL,
  appointment_id text UNIQUE REFERENCES schedule_entries(id),
  joined_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status='called' AND assigned_barber_id IS NOT NULL) OR status<>'called'),
  FOREIGN KEY(service_id,shop_id) REFERENCES services(id,shop_id),
  FOREIGN KEY(preferred_barber_id,shop_id) REFERENCES barbers(id,shop_id),
  FOREIGN KEY(assigned_barber_id,shop_id) REFERENCES barbers(id,shop_id)
);
CREATE INDEX queue_entries_active ON queue_entries(shop_id,joined_at,id) WHERE status IN ('waiting','called');
CREATE UNIQUE INDEX queue_one_call_per_barber ON queue_entries(shop_id,assigned_barber_id) WHERE status='called';
CREATE TABLE queue_barber_availability (
  shop_id text NOT NULL,
  barber_id text NOT NULL,
  available_after timestamptz NOT NULL,
  PRIMARY KEY(shop_id,barber_id),
  FOREIGN KEY(barber_id,shop_id) REFERENCES barbers(id,shop_id) ON DELETE CASCADE
);
