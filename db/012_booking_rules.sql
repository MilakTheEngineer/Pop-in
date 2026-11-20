CREATE TABLE booking_rules (
 shop_id text PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
 minimum_notice_minutes integer NOT NULL DEFAULT 0 CHECK(minimum_notice_minutes BETWEEN 0 AND 43200),
 horizon_days integer CHECK(horizon_days BETWEEN 1 AND 730),
 cancellation_minutes integer NOT NULL DEFAULT 0 CHECK(cancellation_minutes BETWEEN 0 AND 43200),
 buffer_before_minutes integer NOT NULL DEFAULT 0 CHECK(buffer_before_minutes BETWEEN 0 AND 120),
 buffer_after_minutes integer NOT NULL DEFAULT 0 CHECK(buffer_after_minutes BETWEEN 0 AND 120),
 version integer NOT NULL DEFAULT 1 CHECK(version>0)
);
CREATE TABLE barber_booking_exceptions (
 shop_id text NOT NULL,
 barber_id text NOT NULL,
 minimum_notice_minutes integer CHECK(minimum_notice_minutes BETWEEN 0 AND 43200),
 horizon_days integer CHECK(horizon_days BETWEEN 1 AND 730),
 cancellation_minutes integer CHECK(cancellation_minutes BETWEEN 0 AND 43200),
 PRIMARY KEY(shop_id,barber_id),
 FOREIGN KEY(barber_id,shop_id) REFERENCES barbers(id,shop_id) ON DELETE CASCADE
);
CREATE TABLE shop_closures (
 shop_id text NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
 local_date date NOT NULL,
 reason text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(shop_id,local_date)
);
ALTER TABLE schedule_entries ADD COLUMN buffer_before_minutes integer NOT NULL DEFAULT 0 CHECK(buffer_before_minutes BETWEEN 0 AND 120);
ALTER TABLE schedule_entries ADD COLUMN buffer_after_minutes integer NOT NULL DEFAULT 0 CHECK(buffer_after_minutes BETWEEN 0 AND 120);
ALTER TABLE schedule_entries ADD COLUMN rules_version integer NOT NULL DEFAULT 0;
ALTER TABLE schedule_entries ADD COLUMN reserved_starts_at timestamptz;
ALTER TABLE schedule_entries ADD COLUMN reserved_ends_at timestamptz;
UPDATE schedule_entries SET reserved_starts_at=starts_at,reserved_ends_at=ends_at;
ALTER TABLE schedule_entries ALTER COLUMN reserved_starts_at SET NOT NULL;
ALTER TABLE schedule_entries ALTER COLUMN reserved_ends_at SET NOT NULL;
ALTER TABLE schedule_entries DROP CONSTRAINT schedule_entries_int8range_tstzrange_excl;
ALTER TABLE schedule_entries ADD CONSTRAINT schedule_reservation_excl EXCLUDE USING gist (int8range(resource_key,resource_key,'[]') WITH &&,tstzrange(reserved_starts_at,reserved_ends_at,'[)') WITH &&) WHERE (status IN ('booked','blocked')) DEFERRABLE INITIALLY IMMEDIATE;
CREATE FUNCTION enforce_booking_rules() RETURNS trigger AS $$
DECLARE check_policy boolean := false; current_version integer; current_before integer; current_after integer;
BEGIN
 IF NEW.kind='appointment' AND NEW.status='booked' THEN
  IF TG_OP='INSERT' THEN check_policy:=true;
  ELSIF OLD.status<>'booked' OR NEW.shop_id IS DISTINCT FROM OLD.shop_id OR NEW.barber_id IS DISTINCT FROM OLD.barber_id OR NEW.starts_at IS DISTINCT FROM OLD.starts_at OR NEW.ends_at IS DISTINCT FROM OLD.ends_at OR NEW.buffer_before_minutes IS DISTINCT FROM OLD.buffer_before_minutes OR NEW.buffer_after_minutes IS DISTINCT FROM OLD.buffer_after_minutes THEN check_policy:=true; END IF;
  IF check_policy THEN
   PERFORM id FROM shops WHERE id=NEW.shop_id FOR UPDATE;
   SELECT coalesce((SELECT version FROM booking_rules WHERE shop_id=NEW.shop_id),0),coalesce((SELECT buffer_before_minutes FROM booking_rules WHERE shop_id=NEW.shop_id),0),coalesce((SELECT buffer_after_minutes FROM booking_rules WHERE shop_id=NEW.shop_id),0) INTO current_version,current_before,current_after;
   IF NEW.rules_version<>current_version OR NEW.buffer_before_minutes<>current_before OR NEW.buffer_after_minutes<>current_after THEN RAISE EXCEPTION 'Booking rules changed. Please try again.' USING ERRCODE='P0001'; END IF;
   IF EXISTS(SELECT 1 FROM shop_closures c WHERE c.shop_id=NEW.shop_id AND c.local_date >= (NEW.starts_at AT TIME ZONE 'Pacific/Auckland')::date AND c.local_date <= ((NEW.ends_at-interval '1 microsecond') AT TIME ZONE 'Pacific/Auckland')::date) THEN RAISE EXCEPTION 'The shop is closed on that date.' USING ERRCODE='P0001'; END IF;
  END IF;
 END IF;
 NEW.reserved_starts_at:=NEW.starts_at-(NEW.buffer_before_minutes * interval '1 minute');
 NEW.reserved_ends_at:=NEW.ends_at+(NEW.buffer_after_minutes * interval '1 minute');
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER schedule_reservation BEFORE INSERT OR UPDATE ON schedule_entries FOR EACH ROW EXECUTE FUNCTION enforce_booking_rules();
