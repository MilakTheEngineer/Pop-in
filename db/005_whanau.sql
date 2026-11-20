ALTER TABLE schedule_entries DROP CONSTRAINT schedule_entries_int8range_tstzrange_excl;
ALTER TABLE schedule_entries ADD CONSTRAINT schedule_entries_int8range_tstzrange_excl EXCLUDE USING gist (int8range(resource_key, resource_key, '[]') WITH &&, tstzrange(starts_at, ends_at, '[)') WITH &&) WHERE (status IN ('booked','blocked')) DEFERRABLE INITIALLY IMMEDIATE;
CREATE TABLE guest_visits (
 id text PRIMARY KEY,
 shop_id text NOT NULL REFERENCES shops(id),
 token_hash text NOT NULL UNIQUE,
 email text NOT NULL,
 status text NOT NULL CHECK(status IN ('booked','cancelled')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,shop_id)
);
CREATE TABLE guest_visit_people (
 visit_id text NOT NULL,
 shop_id text NOT NULL,
 entry_id text NOT NULL UNIQUE REFERENCES schedule_entries(id),
 position integer NOT NULL CHECK(position BETWEEN 0 AND 3),
 price_cents integer NOT NULL CHECK(price_cents >= 0),
 PRIMARY KEY(visit_id,position),
 FOREIGN KEY(visit_id,shop_id) REFERENCES guest_visits(id,shop_id)
);
