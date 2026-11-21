CREATE TABLE beta_simulated_emails (
 id text PRIMARY KEY,
 shop_id text NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
 subject_type text NOT NULL CHECK(subject_type IN ('booking','visit')),
 subject_id text NOT NULL,
 event text NOT NULL CHECK(event IN ('confirmation','change','cancellation')),
 version text NOT NULL,
 recipient text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(shop_id,subject_type,subject_id,event,version)
);
CREATE TABLE beta_visit_reminder_consent (
 visit_id text PRIMARY KEY REFERENCES guest_visits(id) ON DELETE CASCADE,
 sms boolean NOT NULL DEFAULT false,
 email boolean NOT NULL DEFAULT false
);
CREATE TABLE beta_visit_reminder_reservations (
 shop_id text NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
 visit_id text NOT NULL REFERENCES guest_visits(id) ON DELETE CASCADE,
 beta_month integer NOT NULL CHECK(beta_month IN (0,1)),
 channel text NOT NULL CHECK(channel IN ('sms','email')),
 segments integer NOT NULL CHECK(segments IN (0,1)),
 status text NOT NULL CHECK(status IN ('reserved','simulated','uncertain')),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(shop_id,visit_id)
);
