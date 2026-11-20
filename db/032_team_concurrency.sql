-- Serialize linking a profile with new reservations or timesheets so an
-- in-flight insert cannot retain the old physical-person identity.
CREATE OR REPLACE FUNCTION set_capacity_person() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.barber_id IS NULL THEN NEW.person_capacity_key:=NULL;
 ELSE SELECT p.capacity_key INTO NEW.person_capacity_key FROM barbers b JOIN team_people p ON p.id=b.person_id WHERE b.id=NEW.barber_id AND b.shop_id=NEW.shop_id FOR SHARE OF b;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION set_timesheet_person() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 SELECT b.person_id,p.capacity_key INTO NEW.person_id,NEW.person_capacity_key FROM barbers b JOIN team_people p ON p.id=b.person_id WHERE b.id=NEW.barber_id AND b.shop_id=NEW.shop_id FOR SHARE OF b;
 RETURN NEW;
END $$;
CREATE FUNCTION protect_location_group() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.location_group_id IS DISTINCT FROM OLD.location_group_id THEN RAISE EXCEPTION 'A location cannot be moved between businesses.' USING ERRCODE='P0001'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER location_group_immutable BEFORE UPDATE OF location_group_id ON shops FOR EACH ROW EXECUTE FUNCTION protect_location_group();
ALTER TABLE commission_payouts ADD COLUMN period_from date;
ALTER TABLE commission_payouts ADD COLUMN period_to date;
UPDATE commission_payouts SET period_from=(created_at AT TIME ZONE 'Pacific/Auckland')::date,period_to=(created_at AT TIME ZONE 'Pacific/Auckland')::date;
ALTER TABLE commission_payouts ALTER COLUMN period_from SET NOT NULL;
ALTER TABLE commission_payouts ALTER COLUMN period_to SET NOT NULL;
ALTER TABLE commission_payouts ADD CONSTRAINT commission_payout_period_valid CHECK(period_to>=period_from);
