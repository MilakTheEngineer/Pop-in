-- Directory listings are explicitly enabled per shop. Secrets sign a directory
-- selection without creating a tracking record until a booking succeeds.
CREATE TABLE directory_profiles (
 shop_id text PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
 opted_in boolean NOT NULL DEFAULT false,
 description text NOT NULL DEFAULT '' CHECK(char_length(description)<=500),
 referral_secret text NOT NULL CHECK(length(referral_secret)=64),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE directory_photos (
 id text PRIMARY KEY, shop_id text NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
 photo bytea NOT NULL, content_type text NOT NULL CHECK(content_type IN ('image/jpeg','image/png','image/webp')),
 alt text NOT NULL CHECK(char_length(alt) BETWEEN 1 AND 120), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,shop_id)
);
CREATE INDEX directory_photos_shop ON directory_photos(shop_id,created_at,id);
CREATE TABLE directory_bookings (
 entry_id text PRIMARY KEY, shop_id text NOT NULL, selection_hash text NOT NULL UNIQUE,
 source text NOT NULL DEFAULT 'rotorua_directory' CHECK(source='rotorua_directory'),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(entry_id,shop_id) REFERENCES schedule_entries(id,shop_id) ON DELETE CASCADE
);
CREATE INDEX directory_bookings_shop ON directory_bookings(shop_id,created_at DESC);
ALTER TABLE deposit_holds ADD COLUMN directory_selection_hash text CHECK(directory_selection_hash IS NULL OR length(directory_selection_hash)=64);
