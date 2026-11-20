CREATE TABLE community_events (
 id text PRIMARY KEY, shop_id text NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
 title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 100),
 local_date date NOT NULL, starts time NOT NULL, ends time NOT NULL CHECK(ends>starts),
 venue text NOT NULL CHECK(length(trim(venue)) BETWEEN 1 AND 250),
 capacity integer NOT NULL CHECK(capacity BETWEEN 1 AND 500),
 sponsored_places integer NOT NULL CHECK(sponsored_places BETWEEN 0 AND capacity),
 partner_name text NOT NULL DEFAULT '' CHECK(length(partner_name)<=120),
 copy_en text NOT NULL DEFAULT '' CHECK(length(copy_en)<=1000), copy_mi text NOT NULL DEFAULT '' CHECK(length(copy_mi)<=1000),
 reviewed_en boolean NOT NULL DEFAULT false, reviewed_mi boolean NOT NULL DEFAULT false,
 visibility text NOT NULL CHECK(visibility IN ('private','public')),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),
 guest_token_hash text UNIQUE, partner_token_hash text UNIQUE,
 created_by text NOT NULL REFERENCES staff(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,shop_id)
);
CREATE TABLE community_event_staff (
 event_id text NOT NULL, shop_id text NOT NULL, barber_id text NOT NULL,
 PRIMARY KEY(event_id,barber_id),
 FOREIGN KEY(event_id,shop_id) REFERENCES community_events(id,shop_id) ON DELETE CASCADE,
 FOREIGN KEY(barber_id,shop_id) REFERENCES barbers(id,shop_id)
);
CREATE TABLE community_event_services (
 event_id text NOT NULL, shop_id text NOT NULL, service_id text NOT NULL,
 PRIMARY KEY(event_id,service_id),
 FOREIGN KEY(event_id,shop_id) REFERENCES community_events(id,shop_id) ON DELETE CASCADE,
 FOREIGN KEY(service_id,shop_id) REFERENCES services(id,shop_id)
);
ALTER TABLE schedule_entries ADD COLUMN community_event_id text;
ALTER TABLE schedule_entries ADD CONSTRAINT community_entry_shop_fk FOREIGN KEY(community_event_id,shop_id) REFERENCES community_events(id,shop_id);
CREATE INDEX community_entries_event_status ON schedule_entries(community_event_id,status) WHERE community_event_id IS NOT NULL;

-- Serialize an event's final place using the same shop lock used by ordinary
-- bookings. The existing capacity exclusion still protects linked barbers.
CREATE OR REPLACE FUNCTION enforce_booking_rules() RETURNS trigger AS $$
DECLARE check_policy boolean := false; current_version integer; current_before integer; current_after integer; ev community_events%ROWTYPE; used_places integer;
BEGIN
 IF TG_OP='UPDATE' AND NEW.community_event_id IS DISTINCT FROM OLD.community_event_id THEN
  RAISE EXCEPTION 'A community booking cannot be converted to another booking type.' USING ERRCODE='P0001';
 END IF;
 IF NEW.kind='appointment' AND NEW.status='booked' THEN
  IF TG_OP='INSERT' THEN check_policy:=true;
  ELSIF OLD.status<>'booked' OR NEW.shop_id IS DISTINCT FROM OLD.shop_id OR NEW.barber_id IS DISTINCT FROM OLD.barber_id OR NEW.starts_at IS DISTINCT FROM OLD.starts_at OR NEW.ends_at IS DISTINCT FROM OLD.ends_at OR NEW.buffer_before_minutes IS DISTINCT FROM OLD.buffer_before_minutes OR NEW.buffer_after_minutes IS DISTINCT FROM OLD.buffer_after_minutes OR NEW.rules_version IS DISTINCT FROM OLD.rules_version THEN check_policy:=true; END IF;
  IF check_policy THEN
   PERFORM id FROM shops WHERE id=NEW.shop_id FOR UPDATE;
   SELECT coalesce((SELECT version FROM booking_rules WHERE shop_id=NEW.shop_id),0),coalesce((SELECT buffer_before_minutes FROM booking_rules WHERE shop_id=NEW.shop_id),0),coalesce((SELECT buffer_after_minutes FROM booking_rules WHERE shop_id=NEW.shop_id),0) INTO current_version,current_before,current_after;
   IF NEW.rules_version<>current_version OR NEW.buffer_before_minutes<>current_before OR NEW.buffer_after_minutes<>current_after THEN RAISE EXCEPTION 'Booking rules changed. Please try again.' USING ERRCODE='P0001'; END IF;
   IF NEW.community_event_id IS NULL THEN
    IF EXISTS(SELECT 1 FROM shop_closures c WHERE c.shop_id=NEW.shop_id AND c.local_date >= (NEW.starts_at AT TIME ZONE 'Pacific/Auckland')::date AND c.local_date <= ((NEW.ends_at-interval '1 microsecond') AT TIME ZONE 'Pacific/Auckland')::date) THEN RAISE EXCEPTION 'The shop is closed on that date.' USING ERRCODE='P0001'; END IF;
   ELSE
    SELECT * INTO ev FROM community_events WHERE id=NEW.community_event_id AND shop_id=NEW.shop_id FOR UPDATE;
    IF ev.id IS NULL OR ev.status<>'published' OR NEW.source<>'guest' OR NEW.price_cents_snapshot IS DISTINCT FROM 0 OR NEW.ends_at<>NEW.starts_at+(NEW.duration_minutes*interval '1 minute') OR NEW.starts_at<=clock_timestamp() OR NEW.starts_at-current_before*interval '1 minute'<((ev.local_date+ev.starts) AT TIME ZONE 'Pacific/Auckland') OR NEW.ends_at+current_after*interval '1 minute'>((ev.local_date+ev.ends) AT TIME ZONE 'Pacific/Auckland') OR NOT EXISTS(SELECT 1 FROM community_event_staff x JOIN barber_services bs ON bs.shop_id=x.shop_id AND bs.barber_id=x.barber_id JOIN community_event_services y ON y.event_id=x.event_id AND y.shop_id=x.shop_id AND y.service_id=bs.service_id JOIN services v ON v.id=y.service_id AND v.shop_id=y.shop_id WHERE x.event_id=ev.id AND x.barber_id=NEW.barber_id AND y.service_id=NEW.service_id AND v.duration=NEW.duration_minutes AND NOT EXISTS(SELECT 1 FROM salon_service_settings ss WHERE ss.shop_id=v.shop_id AND ss.service_id=v.id)) THEN RAISE EXCEPTION 'This community time is no longer available.' USING ERRCODE='P0001'; END IF;
    SELECT count(*) INTO used_places FROM schedule_entries WHERE community_event_id=ev.id AND status IN ('booked','completed','no_show') AND id<>NEW.id;
    IF used_places>=least(ev.capacity,ev.sponsored_places) THEN RAISE EXCEPTION 'No sponsored places remain.' USING ERRCODE='P0001'; END IF;
    NEW.suppress_reminders:=true;
   END IF;
  END IF;
 END IF;
 NEW.reserved_starts_at:=NEW.starts_at-(NEW.buffer_before_minutes * interval '1 minute');
 NEW.reserved_ends_at:=NEW.ends_at+(NEW.buffer_after_minutes * interval '1 minute');
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
ALTER TABLE schedule_entries ADD CONSTRAINT community_entry_is_appointment CHECK(community_event_id IS NULL OR kind='appointment');
