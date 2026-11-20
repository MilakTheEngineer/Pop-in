CREATE OR REPLACE FUNCTION enforce_booking_rules() RETURNS trigger AS $$
DECLARE check_policy boolean := false; current_version integer; current_before integer; current_after integer;
BEGIN
 IF NEW.kind='appointment' AND NEW.status='booked' THEN
  IF TG_OP='INSERT' THEN check_policy:=true;
  ELSIF OLD.status<>'booked' OR NEW.shop_id IS DISTINCT FROM OLD.shop_id OR NEW.barber_id IS DISTINCT FROM OLD.barber_id OR NEW.starts_at IS DISTINCT FROM OLD.starts_at OR NEW.ends_at IS DISTINCT FROM OLD.ends_at OR NEW.buffer_before_minutes IS DISTINCT FROM OLD.buffer_before_minutes OR NEW.buffer_after_minutes IS DISTINCT FROM OLD.buffer_after_minutes OR NEW.rules_version IS DISTINCT FROM OLD.rules_version THEN check_policy:=true; END IF;
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
