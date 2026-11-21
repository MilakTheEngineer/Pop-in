-- Existing shops keep their city and can add an address in Shop settings.
ALTER TABLE shops ADD COLUMN IF NOT EXISTS street_address text NOT NULL DEFAULT '';
