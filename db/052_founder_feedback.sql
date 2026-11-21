ALTER TABLE beta_applications ADD COLUMN application_shop text;
ALTER TABLE beta_applications ADD COLUMN application_town text;
ALTER TABLE beta_applications ADD COLUMN team_size integer CHECK(team_size BETWEEN 1 AND 10000);
ALTER TABLE beta_applications ADD COLUMN contact_email text;
CREATE TABLE beta_regular_interest (
 shop_id text PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO beta_regular_interest(shop_id,created_at) SELECT shop_id,created_at FROM beta_applications WHERE kind='regular' ON CONFLICT DO NOTHING;
CREATE TABLE founder_feedback (
 id text PRIMARY KEY,
 shop_id text NOT NULL REFERENCES beta_applications(shop_id) ON DELETE CASCADE,
 author_id text REFERENCES staff(id) ON DELETE SET NULL,
 category text NOT NULL CHECK(category IN ('bug','idea','design','nothing')),
 note text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX founder_feedback_shop_time ON founder_feedback(shop_id,created_at DESC);
ALTER TABLE beta_reminder_reservations DROP CONSTRAINT beta_reminder_reservations_beta_month_check;
ALTER TABLE beta_reminder_reservations ADD CHECK(beta_month>=0);
ALTER TABLE beta_visit_reminder_reservations DROP CONSTRAINT beta_visit_reminder_reservations_beta_month_check;
ALTER TABLE beta_visit_reminder_reservations ADD CHECK(beta_month>=0);
