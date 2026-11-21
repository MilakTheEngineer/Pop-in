-- Local simulation accounting. Historic reservations retain their original creation month.
ALTER TABLE beta_reminder_reservations DROP CONSTRAINT beta_reminder_reservations_segments_check;
ALTER TABLE beta_visit_reminder_reservations DROP CONSTRAINT beta_visit_reminder_reservations_segments_check;
ALTER TABLE beta_reminder_reservations ADD CHECK(segments >= 0);
ALTER TABLE beta_visit_reminder_reservations ADD CHECK(segments >= 0);
ALTER TABLE beta_reminder_reservations ADD COLUMN billing_month date;
ALTER TABLE beta_visit_reminder_reservations ADD COLUMN billing_month date;
UPDATE beta_reminder_reservations SET billing_month=date_trunc('month',created_at AT TIME ZONE 'Pacific/Auckland')::date;
UPDATE beta_visit_reminder_reservations SET billing_month=date_trunc('month',created_at AT TIME ZONE 'Pacific/Auckland')::date;
ALTER TABLE beta_reminder_reservations ALTER COLUMN billing_month SET NOT NULL;
ALTER TABLE beta_visit_reminder_reservations ALTER COLUMN billing_month SET NOT NULL;
CREATE TABLE beta_sms_pilot_lock (id integer PRIMARY KEY CHECK(id=1));
INSERT INTO beta_sms_pilot_lock VALUES(1);
