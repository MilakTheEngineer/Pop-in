-- Test bookings use the normal calendar and price snapshot but do not create
-- permanent fictional clients in the shop's client list.
CREATE OR REPLACE FUNCTION attach_appointment_client() RETURNS trigger AS $$
BEGIN
  IF NEW.kind='appointment' THEN
    IF NEW.client_id IS NULL AND NOT NEW.onboarding_test THEN
      NEW.client_id := 'booking:'||NEW.id;
      INSERT INTO clients(id,shop_id,name,phone,created_at,updated_at)
      VALUES(NEW.client_id,NEW.shop_id,NEW.customer_name,coalesce(NEW.customer_phone,''),NEW.created_at,NEW.created_at);
    END IF;
    IF NEW.price_cents_snapshot IS NULL THEN
      SELECT price_cents INTO NEW.price_cents_snapshot FROM services WHERE id=NEW.service_id AND shop_id=NEW.shop_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
