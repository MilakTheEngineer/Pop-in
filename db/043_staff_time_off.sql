-- Account access is separate from a bookable profile. Only an owner may link them.
CREATE TABLE staff_barber_links (
  shop_id text NOT NULL,
  staff_id text NOT NULL,
  barber_id text NOT NULL,
  PRIMARY KEY (shop_id, staff_id),
  UNIQUE (shop_id, barber_id),
  FOREIGN KEY (staff_id, shop_id) REFERENCES memberships(staff_id, shop_id) ON DELETE CASCADE,
  FOREIGN KEY (barber_id, shop_id) REFERENCES barbers(id, shop_id) ON DELETE CASCADE
);

CREATE TABLE staff_time_off (
  id text PRIMARY KEY,
  shop_id text NOT NULL,
  barber_id text NOT NULL,
  requested_by text REFERENCES staff(id),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text NOT NULL DEFAULT '',
  status text NOT NULL CHECK (status IN ('pending','approved','declined','cancelled')),
  block_id text UNIQUE REFERENCES schedule_entries(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK ((status = 'approved') = (block_id IS NOT NULL)),
  FOREIGN KEY (barber_id, shop_id) REFERENCES barbers(id, shop_id)
);
