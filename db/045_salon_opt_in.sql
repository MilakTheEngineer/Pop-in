ALTER TABLE shops ADD COLUMN salon_enabled boolean NOT NULL DEFAULT false;
-- Preserve shops already using salon stages or resources.
UPDATE shops SET salon_enabled=true WHERE EXISTS (SELECT 1 FROM salon_service_settings s WHERE s.shop_id=shops.id) OR EXISTS (SELECT 1 FROM salon_resources r WHERE r.shop_id=shops.id);

ALTER TABLE salon_service_stages DROP CONSTRAINT salon_service_stages_check2;
ALTER TABLE salon_service_stages ADD CONSTRAINT salon_first_stage_has_stylist CHECK(position<>1 OR staff_mode IN ('booking','fixed'));

CREATE FUNCTION check_salon_first_stylist() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.kind='appointment' AND EXISTS (SELECT 1 FROM salon_service_stages s WHERE s.shop_id=NEW.shop_id AND s.service_id=NEW.service_id AND s.position=1 AND s.staff_mode='fixed' AND s.staff_id<>NEW.barber_id) THEN
  RAISE EXCEPTION 'The booking stylist must match the fixed application stylist.' USING ERRCODE='P0001';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER salon_first_stylist_guard BEFORE INSERT OR UPDATE OF shop_id,barber_id,service_id,starts_at,ends_at ON schedule_entries FOR EACH ROW EXECUTE FUNCTION check_salon_first_stylist();
