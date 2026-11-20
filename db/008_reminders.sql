CREATE TABLE reminder_settings (
 shop_id text PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
 enabled boolean NOT NULL DEFAULT false,
 channel text NOT NULL DEFAULT 'email' CHECK(channel IN ('email','sms')),
 lead_minutes integer NOT NULL DEFAULT 1440 CHECK(lead_minutes IN (60,120,1440,2880))
);
CREATE TABLE reminder_log (
 id text PRIMARY KEY,
 shop_id text NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
 subject_type text NOT NULL CHECK(subject_type IN ('booking','visit')),
 subject_id text NOT NULL,
 starts_at timestamptz NOT NULL,
 channel text NOT NULL CHECK(channel IN ('email','sms')),
 recipient text,
 recipient_name text NOT NULL,
 message text NOT NULL,
 status text NOT NULL CHECK(status IN ('preview','failed')),
 error text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(shop_id,subject_type,subject_id,starts_at,channel)
);
CREATE INDEX reminder_log_shop_created ON reminder_log(shop_id,created_at DESC);
