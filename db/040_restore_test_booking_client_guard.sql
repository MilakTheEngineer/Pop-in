-- The team-price migration replaced the appointment trigger and accidentally
-- removed the onboarding-test guard. Keep barber-specific price snapshots, but
-- never create a client profile for a test booking.
CREATE OR REPLACE FUNCTION attach_appointment_client() RETURNS trigger AS $$
BEGIN
 IF NEW.kind='appointment' THEN
  IF NEW.client_id IS NULL AND NOT NEW.onboarding_test THEN
   NEW.client_id:='booking:'||NEW.id;
   INSERT INTO clients(id,shop_id,name,phone,created_at,updated_at)
   VALUES(NEW.client_id,NEW.shop_id,NEW.customer_name,coalesce(NEW.customer_phone,''),NEW.created_at,NEW.created_at);
  END IF;
  IF NEW.price_cents_snapshot IS NULL THEN
   SELECT coalesce(p.price_cents,s.price_cents) INTO NEW.price_cents_snapshot
   FROM services s LEFT JOIN barber_service_prices p ON p.shop_id=s.shop_id AND p.service_id=s.id AND p.barber_id=NEW.barber_id
   WHERE s.id=NEW.service_id AND s.shop_id=NEW.shop_id;
  END IF;
 END IF;
 RETURN NEW;
END $$ LANGUAGE plpgsql;
