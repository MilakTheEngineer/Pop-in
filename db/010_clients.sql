CREATE TABLE clients (
  id text PRIMARY KEY,
  shop_id text NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  preferred_barber_id text,
  private_notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,shop_id),
  FOREIGN KEY(preferred_barber_id,shop_id) REFERENCES barbers(id,shop_id)
);
CREATE INDEX clients_shop_name ON clients(shop_id,lower(name));
ALTER TABLE schedule_entries ADD COLUMN client_id text;
ALTER TABLE schedule_entries ADD COLUMN price_cents_snapshot integer CHECK(price_cents_snapshot >= 0);
ALTER TABLE schedule_entries ADD CONSTRAINT schedule_entry_client_shop_fk FOREIGN KEY(client_id,shop_id) REFERENCES clients(id,shop_id);
CREATE INDEX schedule_entries_client_time ON schedule_entries(shop_id,client_id,starts_at);

-- Existing bookings have no verified identity. Keep each separate for staff review.
INSERT INTO clients(id,shop_id,name,phone,email,created_at,updated_at)
SELECT 'booking:'||e.id,e.shop_id,e.customer_name,coalesce(e.customer_phone,''),coalesce(g.email,''),e.created_at,e.created_at
FROM schedule_entries e LEFT JOIN guest_booking_links g ON g.entry_id=e.id
WHERE e.kind='appointment';
UPDATE schedule_entries SET client_id='booking:'||id WHERE kind='appointment';

-- Every new appointment starts with its own profile unless staff explicitly chose one.
-- This trigger runs inside the booking statement, including group and queue seating.
CREATE FUNCTION attach_appointment_client() RETURNS trigger AS $$
BEGIN
  IF NEW.kind='appointment' THEN
    IF NEW.client_id IS NULL THEN
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
CREATE TRIGGER schedule_attach_client BEFORE INSERT ON schedule_entries FOR EACH ROW EXECUTE FUNCTION attach_appointment_client();

-- Only copy an email to a newly created booking profile, never to a selected profile
-- or to an individual in a whānau visit, whose contact belongs to the organiser.
CREATE FUNCTION attach_guest_client_email() RETURNS trigger AS $$
BEGIN
  UPDATE clients c SET email=NEW.email
  FROM schedule_entries e WHERE e.id=NEW.entry_id AND e.client_id=c.id AND e.shop_id=c.shop_id AND c.id='booking:'||e.id AND c.email='';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER guest_email_to_client AFTER INSERT ON guest_booking_links FOR EACH ROW EXECUTE FUNCTION attach_guest_client_email();
