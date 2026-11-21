-- Consent is opt-in and is not inferred from existing contact information.
CREATE TABLE beta_reminder_consent (
 entry_id text PRIMARY KEY REFERENCES schedule_entries(id) ON DELETE CASCADE,
 sms boolean NOT NULL DEFAULT false,
 email boolean NOT NULL DEFAULT false
);
-- Reservations are deliberately retained after uncertain provider outcomes.
CREATE TABLE beta_reminder_reservations (
 shop_id text NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
 entry_id text NOT NULL REFERENCES schedule_entries(id) ON DELETE CASCADE,
 beta_month integer NOT NULL CHECK(beta_month IN (0,1)),
 channel text NOT NULL CHECK(channel IN ('sms','email')),
 segments integer NOT NULL CHECK(segments IN (0,1)),
 status text NOT NULL CHECK(status IN ('reserved','simulated','uncertain')),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(shop_id,entry_id)
);
