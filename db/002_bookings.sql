-- A numeric resource gives GiST an equality dimension without requiring btree_gist.
CREATE TABLE schedule_resources (
  resource_key bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  barber_id text NOT NULL UNIQUE,
  shop_id text NOT NULL,
  UNIQUE(resource_key, barber_id, shop_id),
  FOREIGN KEY(barber_id,shop_id) REFERENCES barbers(id,shop_id) ON DELETE CASCADE
);
CREATE TABLE schedule_entries (
  id text PRIMARY KEY,
  shop_id text NOT NULL,
  barber_id text NOT NULL,
  resource_key bigint NOT NULL,
  kind text NOT NULL CHECK(kind IN ('appointment','block')),
  status text NOT NULL CHECK(status IN ('booked','completed','no_show','cancelled','blocked')),
  source text CHECK(source IN ('phone','walk_in')),
  service_id text,
  service_name text,
  duration_minutes integer,
  customer_name text,
  customer_phone text,
  label text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK ((kind='appointment' AND status IN ('booked','completed','no_show','cancelled') AND service_id IS NOT NULL AND service_name IS NOT NULL AND duration_minutes > 0 AND customer_name IS NOT NULL AND source IS NOT NULL) OR (kind='block' AND status IN ('blocked','cancelled') AND service_id IS NULL AND label IS NOT NULL)),
  FOREIGN KEY(resource_key,barber_id,shop_id) REFERENCES schedule_resources(resource_key,barber_id,shop_id),
  FOREIGN KEY(service_id,shop_id) REFERENCES services(id,shop_id),
  EXCLUDE USING gist (int8range(resource_key, resource_key, '[]') WITH &&, tstzrange(starts_at, ends_at, '[)') WITH &&) WHERE (status IN ('booked','blocked'))
);
CREATE INDEX schedule_entries_shop_time ON schedule_entries(shop_id, starts_at);
