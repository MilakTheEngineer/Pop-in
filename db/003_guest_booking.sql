ALTER TABLE shops ADD COLUMN public_slug text UNIQUE;
UPDATE shops SET public_slug='rimu' WHERE id='rimu' AND public_slug IS NULL;
ALTER TABLE schedule_entries DROP CONSTRAINT schedule_entries_source_check;
ALTER TABLE schedule_entries ADD CONSTRAINT schedule_entries_source_check CHECK(source IN ('phone','walk_in','guest'));
CREATE TABLE guest_booking_links (
  entry_id text PRIMARY KEY REFERENCES schedule_entries(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  email text NOT NULL,
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
