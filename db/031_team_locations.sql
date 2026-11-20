-- Existing shops remain independent locations until an owner creates a sibling.
CREATE TABLE location_groups (id text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now());
INSERT INTO location_groups(id) SELECT 'group:'||id FROM shops;
ALTER TABLE shops ADD COLUMN location_group_id text;
UPDATE shops SET location_group_id='group:'||id;
ALTER TABLE shops ALTER COLUMN location_group_id SET NOT NULL;
ALTER TABLE shops ADD CONSTRAINT shops_location_group_fk FOREIGN KEY(location_group_id) REFERENCES location_groups(id);
CREATE FUNCTION initialise_location_group() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.location_group_id IS NULL THEN
  NEW.location_group_id:='group:'||NEW.id;
  INSERT INTO location_groups(id) VALUES(NEW.location_group_id);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER shops_initialise_group BEFORE INSERT ON shops FOR EACH ROW EXECUTE FUNCTION initialise_location_group();
CREATE FUNCTION clean_empty_location_group() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 DELETE FROM location_groups WHERE id=OLD.location_group_id AND NOT EXISTS(SELECT 1 FROM shops WHERE location_group_id=OLD.location_group_id);
 RETURN OLD;
END $$;

-- Each physical person has one capacity key, even when represented by a
-- different barber profile at each location. Resource keys remain separate.
CREATE TABLE team_people (
 id text PRIMARY KEY, location_group_id text NOT NULL REFERENCES location_groups(id) ON DELETE CASCADE,
 capacity_key bigint GENERATED ALWAYS AS IDENTITY UNIQUE
);
INSERT INTO team_people(id,location_group_id) SELECT 'person:'||b.id,s.location_group_id FROM barbers b JOIN shops s ON s.id=b.shop_id;
ALTER TABLE barbers ADD COLUMN person_id text;
UPDATE barbers SET person_id='person:'||id;
ALTER TABLE barbers ALTER COLUMN person_id SET NOT NULL;
ALTER TABLE barbers ADD CONSTRAINT barbers_person_fk FOREIGN KEY(person_id) REFERENCES team_people(id);
CREATE UNIQUE INDEX one_profile_per_person_location ON barbers(shop_id,person_id);
CREATE FUNCTION initialise_team_person() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE group_id text;
BEGIN
 SELECT location_group_id INTO group_id FROM shops WHERE id=NEW.shop_id;
 IF NEW.person_id IS NULL THEN
  NEW.person_id:='person:'||NEW.id;
  INSERT INTO team_people(id,location_group_id) VALUES(NEW.person_id,group_id);
 ELSIF NOT EXISTS(SELECT 1 FROM team_people WHERE id=NEW.person_id AND location_group_id=group_id) THEN
  RAISE EXCEPTION 'A team member must belong to this location group.' USING ERRCODE='P0001';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER barbers_initialise_person BEFORE INSERT OR UPDATE OF person_id,shop_id ON barbers FOR EACH ROW EXECUTE FUNCTION initialise_team_person();
CREATE TRIGGER shops_clean_group AFTER DELETE ON shops FOR EACH ROW EXECUTE FUNCTION clean_empty_location_group();

ALTER TABLE schedule_capacity DROP CONSTRAINT schedule_reservation_excl;
ALTER TABLE schedule_capacity DROP COLUMN capacity_key;
ALTER TABLE schedule_capacity ADD COLUMN person_capacity_key bigint;
UPDATE schedule_capacity c SET person_capacity_key=p.capacity_key FROM barbers b JOIN team_people p ON p.id=b.person_id WHERE c.barber_id=b.id AND c.shop_id=b.shop_id;
ALTER TABLE schedule_capacity ADD CONSTRAINT capacity_person_key_fk FOREIGN KEY(person_capacity_key) REFERENCES team_people(capacity_key);
ALTER TABLE schedule_capacity ADD CONSTRAINT capacity_person_key_present CHECK((barber_id IS NOT NULL AND person_capacity_key IS NOT NULL) OR (barber_id IS NULL AND person_capacity_key IS NULL));
ALTER TABLE schedule_capacity ADD COLUMN capacity_key bigint GENERATED ALWAYS AS (coalesce(person_capacity_key,-salon_resource_key)) STORED;
ALTER TABLE schedule_capacity ADD CONSTRAINT schedule_reservation_excl EXCLUDE USING gist (int8range(capacity_key,capacity_key,'[]') WITH &&,tstzrange(starts_at,ends_at,'[)') WITH &&) WHERE(active) DEFERRABLE INITIALLY IMMEDIATE;
CREATE FUNCTION set_capacity_person() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.barber_id IS NULL THEN NEW.person_capacity_key:=NULL;
 ELSE SELECT p.capacity_key INTO NEW.person_capacity_key FROM barbers b JOIN team_people p ON p.id=b.person_id WHERE b.id=NEW.barber_id AND b.shop_id=NEW.shop_id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER capacity_set_person BEFORE INSERT OR UPDATE OF barber_id,shop_id,person_capacity_key ON schedule_capacity FOR EACH ROW EXECUTE FUNCTION set_capacity_person();
CREATE FUNCTION update_person_capacity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.person_id IS DISTINCT FROM OLD.person_id THEN
  UPDATE schedule_capacity SET barber_id=barber_id WHERE shop_id=NEW.shop_id AND barber_id=NEW.id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER barbers_update_capacity AFTER UPDATE OF person_id ON barbers FOR EACH ROW EXECUTE FUNCTION update_person_capacity();

CREATE TABLE barber_service_prices (
 shop_id text NOT NULL, barber_id text NOT NULL, service_id text NOT NULL,
 price_cents integer NOT NULL CHECK(price_cents BETWEEN 0 AND 1000000),
 PRIMARY KEY(shop_id,barber_id,service_id),
 FOREIGN KEY(barber_id,service_id) REFERENCES barber_services(barber_id,service_id) ON DELETE CASCADE,
 FOREIGN KEY(barber_id,shop_id) REFERENCES barbers(id,shop_id),
 FOREIGN KEY(service_id,shop_id) REFERENCES services(id,shop_id)
);
CREATE OR REPLACE FUNCTION attach_appointment_client() RETURNS trigger AS $$
BEGIN
 IF NEW.kind='appointment' THEN
  IF NEW.client_id IS NULL THEN
   NEW.client_id:='booking:'||NEW.id;
   INSERT INTO clients(id,shop_id,name,phone,created_at,updated_at) VALUES(NEW.client_id,NEW.shop_id,NEW.customer_name,coalesce(NEW.customer_phone,''),NEW.created_at,NEW.created_at);
  END IF;
  IF NEW.price_cents_snapshot IS NULL THEN
   SELECT coalesce(p.price_cents,s.price_cents) INTO NEW.price_cents_snapshot FROM services s LEFT JOIN barber_service_prices p ON p.shop_id=s.shop_id AND p.service_id=s.id AND p.barber_id=NEW.barber_id WHERE s.id=NEW.service_id AND s.shop_id=NEW.shop_id;
  END IF;
 END IF;
 RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TABLE barber_commission_rates (
 shop_id text NOT NULL, barber_id text NOT NULL, rate_basis_points integer NOT NULL CHECK(rate_basis_points BETWEEN 0 AND 10000),
 updated_at timestamptz NOT NULL DEFAULT now(), updated_by text NOT NULL REFERENCES staff(id),
 PRIMARY KEY(shop_id,barber_id), FOREIGN KEY(barber_id,shop_id) REFERENCES barbers(id,shop_id)
);
CREATE TABLE team_timesheets (
 id text PRIMARY KEY, shop_id text NOT NULL, barber_id text NOT NULL, person_id text NOT NULL REFERENCES team_people(id), person_capacity_key bigint NOT NULL REFERENCES team_people(capacity_key),
 starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, note text NOT NULL DEFAULT '',
 recorded_by text NOT NULL REFERENCES staff(id), created_at timestamptz NOT NULL DEFAULT now(), voided_at timestamptz, voided_by text REFERENCES staff(id),
 FOREIGN KEY(barber_id,shop_id) REFERENCES barbers(id,shop_id), CHECK(ends_at>starts_at),
 EXCLUDE USING gist (int8range(person_capacity_key,person_capacity_key,'[]') WITH &&,tstzrange(starts_at,ends_at,'[)') WITH &&) WHERE(voided_at IS NULL)
);
CREATE FUNCTION set_timesheet_person() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 SELECT b.person_id,p.capacity_key INTO NEW.person_id,NEW.person_capacity_key FROM barbers b JOIN team_people p ON p.id=b.person_id WHERE b.id=NEW.barber_id AND b.shop_id=NEW.shop_id;
 RETURN NEW;
END $$;
CREATE TRIGGER timesheet_set_person BEFORE INSERT OR UPDATE OF barber_id,shop_id,person_id,person_capacity_key ON team_timesheets FOR EACH ROW EXECUTE FUNCTION set_timesheet_person();
CREATE FUNCTION update_person_timesheets() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.person_id IS DISTINCT FROM OLD.person_id THEN UPDATE team_timesheets SET barber_id=barber_id WHERE shop_id=NEW.shop_id AND barber_id=NEW.id; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER barbers_update_timesheets AFTER UPDATE OF person_id ON barbers FOR EACH ROW EXECUTE FUNCTION update_person_timesheets();

-- Commission is attached to the original paid appointment, not inferred from
-- current prices or a later rate. Adjustments preserve the original sale.
CREATE TABLE commission_sales (
 id text PRIMARY KEY, shop_id text NOT NULL, barber_id text NOT NULL, entry_id text NOT NULL,
 sale_price_cents integer NOT NULL CHECK(sale_price_cents>=0), rate_basis_points integer NOT NULL CHECK(rate_basis_points BETWEEN 0 AND 10000),
 commission_cents integer NOT NULL CHECK(commission_cents>=0), payment_id text, prepaid_movement_id text,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(shop_id,entry_id), UNIQUE(id,shop_id),
 FOREIGN KEY(barber_id,shop_id) REFERENCES barbers(id,shop_id),
 FOREIGN KEY(entry_id,shop_id) REFERENCES schedule_entries(id,shop_id),
 FOREIGN KEY(payment_id,shop_id,entry_id) REFERENCES payment_entries(id,shop_id,entry_id), FOREIGN KEY(prepaid_movement_id) REFERENCES prepaid_movements(id),
 CHECK((payment_id IS NOT NULL)::int+(prepaid_movement_id IS NOT NULL)::int=1)
);
CREATE TABLE commission_adjustments (
 id text PRIMARY KEY, shop_id text NOT NULL, sale_id text NOT NULL, amount_cents integer NOT NULL CHECK(amount_cents<>0),
 reason text NOT NULL, kind text NOT NULL DEFAULT 'manual' CHECK(kind IN ('manual','reconciliation')), source_payment_id text UNIQUE REFERENCES payment_entries(id), source_prepaid_id text UNIQUE REFERENCES prepaid_movements(id),
 recorded_by text NOT NULL REFERENCES staff(id), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,shop_id), FOREIGN KEY(sale_id,shop_id) REFERENCES commission_sales(id,shop_id)
);
CREATE TABLE commission_payouts (
 id text PRIMARY KEY, shop_id text NOT NULL, barber_id text NOT NULL, amount_cents integer NOT NULL CHECK(amount_cents>0),
 reference text NOT NULL, recorded_by text NOT NULL REFERENCES staff(id), created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(barber_id,shop_id) REFERENCES barbers(id,shop_id), UNIQUE(id,shop_id)
);
CREATE TABLE commission_payout_items (
 payout_id text NOT NULL, shop_id text NOT NULL, sale_id text UNIQUE, adjustment_id text UNIQUE, amount_cents integer NOT NULL,
 FOREIGN KEY(payout_id,shop_id) REFERENCES commission_payouts(id,shop_id), FOREIGN KEY(sale_id,shop_id) REFERENCES commission_sales(id,shop_id), FOREIGN KEY(adjustment_id,shop_id) REFERENCES commission_adjustments(id,shop_id), CHECK((sale_id IS NOT NULL)::int+(adjustment_id IS NOT NULL)::int=1)
);

CREATE FUNCTION reconcile_commission(p_shop text,p_entry text,p_payment text,p_prepaid text,p_actor text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE e record; r record; sale record; net_paid integer; credits integer; extras integer; covered integer; target integer; previous integer; delta integer;
BEGIN
 SELECT x.id,x.shop_id,x.barber_id,x.status,x.onboarding_test,coalesce(g.price_cents,v.price_cents,x.price_cents_snapshot) AS price INTO e
 FROM schedule_entries x LEFT JOIN guest_booking_links g ON g.entry_id=x.id LEFT JOIN guest_visit_people v ON v.entry_id=x.id AND v.shop_id=x.shop_id WHERE x.id=p_entry AND x.shop_id=p_shop;
 IF NOT FOUND OR e.onboarding_test OR e.price IS NULL OR EXISTS(SELECT 1 FROM deposit_holds WHERE shop_id=p_shop AND booking_entry_id=p_entry) THEN RETURN; END IF;
 SELECT coalesce(sum(CASE WHEN kind='payment' THEN amount_cents ELSE -amount_cents END),0)::int INTO net_paid FROM payment_entries WHERE shop_id=p_shop AND entry_id=p_entry;
 SELECT coalesce(sum(l.price_cents*l.quantity),0)::int INTO extras FROM commerce_orders o JOIN commerce_lines l ON l.order_id=o.id AND l.shop_id=o.shop_id WHERE o.shop_id=p_shop AND o.entry_id=p_entry;
 SELECT coalesce(sum(CASE WHEN m.kind='redeem' THEN m.applied_cents WHEN m.kind='reversal' THEN -m.applied_cents ELSE 0 END),0)::int INTO credits FROM commerce_orders o JOIN prepaid_movements m ON m.order_id=o.id AND m.shop_id=o.shop_id WHERE o.shop_id=p_shop AND o.entry_id=p_entry;
 SELECT * INTO sale FROM commission_sales WHERE shop_id=p_shop AND entry_id=p_entry FOR UPDATE;
 IF NOT FOUND THEN
  IF e.status<>'completed' OR net_paid+credits<e.price+extras OR (p_payment IS NULL AND p_prepaid IS NULL) THEN RETURN; END IF;
  SELECT rate_basis_points INTO r FROM barber_commission_rates WHERE shop_id=p_shop AND barber_id=e.barber_id;
  IF NOT FOUND THEN RETURN; END IF;
  INSERT INTO commission_sales(id,shop_id,barber_id,entry_id,sale_price_cents,rate_basis_points,commission_cents,payment_id,prepaid_movement_id)
  VALUES('sale:'||p_entry,p_shop,e.barber_id,p_entry,e.price,r.rate_basis_points,round(e.price*r.rate_basis_points/10000.0)::int,p_payment,p_prepaid) ON CONFLICT(shop_id,entry_id) DO NOTHING;
  RETURN;
 END IF;
 covered:=greatest(0,least(sale.sale_price_cents,sale.sale_price_cents+net_paid+credits-(e.price+extras)));
 target:=round(covered*sale.rate_basis_points/10000.0)::int;
 SELECT sale.commission_cents+coalesce(sum(amount_cents),0)::int INTO previous FROM commission_adjustments WHERE sale_id=sale.id AND kind='reconciliation';
 delta:=target-previous;
 IF delta<>0 THEN
  INSERT INTO commission_adjustments(id,shop_id,sale_id,amount_cents,reason,kind,source_payment_id,source_prepaid_id,recorded_by)
  VALUES('reconcile:'||coalesce(p_payment,p_prepaid),p_shop,sale.id,delta,'Payment or prepaid balance changed','reconciliation',p_payment,p_prepaid,p_actor) ON CONFLICT DO NOTHING;
 END IF;
END $$;
CREATE FUNCTION commission_payment_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN PERFORM reconcile_commission(NEW.shop_id,NEW.entry_id,NEW.id,NULL,NEW.recorded_by); RETURN NEW; END $$;
CREATE TRIGGER commission_payment AFTER INSERT ON payment_entries FOR EACH ROW EXECUTE FUNCTION commission_payment_event();
CREATE FUNCTION commission_prepaid_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE entry text;
BEGIN
 IF NEW.kind IN ('redeem','reversal') THEN SELECT entry_id INTO entry FROM commerce_orders WHERE id=NEW.order_id AND shop_id=NEW.shop_id; PERFORM reconcile_commission(NEW.shop_id,entry,NULL,NEW.id,NEW.recorded_by); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER commission_prepaid AFTER INSERT ON prepaid_movements FOR EACH ROW EXECUTE FUNCTION commission_prepaid_event();
CREATE FUNCTION commission_completion_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE payment text; prepaid text; actor text;
BEGIN
 IF NEW.status='completed' AND OLD.status IS DISTINCT FROM NEW.status THEN
  SELECT id,recorded_by INTO payment,actor FROM payment_entries WHERE shop_id=NEW.shop_id AND entry_id=NEW.id AND kind='payment' ORDER BY occurred_at DESC,id DESC LIMIT 1;
  IF payment IS NULL THEN SELECT m.id,m.recorded_by INTO prepaid,actor FROM prepaid_movements m JOIN commerce_orders o ON o.id=m.order_id AND o.shop_id=m.shop_id WHERE o.shop_id=NEW.shop_id AND o.entry_id=NEW.id AND m.kind='redeem' ORDER BY m.created_at DESC,m.id DESC LIMIT 1; END IF;
  IF payment IS NOT NULL OR prepaid IS NOT NULL THEN PERFORM reconcile_commission(NEW.shop_id,NEW.id,payment,prepaid,actor); END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER commission_completion AFTER UPDATE OF status ON schedule_entries FOR EACH ROW EXECUTE FUNCTION commission_completion_event();
