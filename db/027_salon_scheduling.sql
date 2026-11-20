-- Chairs and other physical resources are separate from the live walk-in queue.
CREATE TABLE salon_resources (
 id text PRIMARY KEY,
 shop_id text NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 100),
 resource_key bigint GENERATED ALWAYS AS IDENTITY,
 UNIQUE(id,shop_id),
 UNIQUE(resource_key,id,shop_id),
 UNIQUE(shop_id,name)
);
CREATE TABLE salon_service_settings (
 shop_id text NOT NULL,
 service_id text NOT NULL,
 consultation_required boolean NOT NULL DEFAULT false,
 patch_test_required boolean NOT NULL DEFAULT false,
 PRIMARY KEY(shop_id,service_id),
 FOREIGN KEY(service_id,shop_id) REFERENCES services(id,shop_id) ON DELETE CASCADE
);
CREATE TABLE salon_service_stages (
 shop_id text NOT NULL,
 service_id text NOT NULL,
 position integer NOT NULL CHECK(position BETWEEN 1 AND 3),
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 80),
 duration_minutes integer NOT NULL CHECK(duration_minutes BETWEEN 1 AND 1440),
 staff_mode text NOT NULL CHECK(staff_mode IN ('booking','fixed','none')),
 staff_id text,
 salon_resource_id text,
 PRIMARY KEY(shop_id,service_id,position),
 FOREIGN KEY(shop_id,service_id) REFERENCES salon_service_settings(shop_id,service_id) ON DELETE CASCADE,
 FOREIGN KEY(staff_id,shop_id) REFERENCES barbers(id,shop_id),
 FOREIGN KEY(salon_resource_id,shop_id) REFERENCES salon_resources(id,shop_id),
 CHECK((staff_mode='fixed' AND staff_id IS NOT NULL) OR (staff_mode<>'fixed' AND staff_id IS NULL)),
 CHECK(staff_mode<>'none' OR salon_resource_id IS NOT NULL),
 CHECK(position<>1 OR staff_mode='booking'),
 CHECK(position<>3 OR staff_mode<>'none')
);
CREATE TABLE salon_appointment_stages (
 id text PRIMARY KEY,
 shop_id text NOT NULL,
 entry_id text NOT NULL,
 position integer NOT NULL,
 name text NOT NULL,
 starts_at timestamptz NOT NULL,
 ends_at timestamptz NOT NULL,
 barber_id text,
 salon_resource_id text,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','done')),
 UNIQUE(id,shop_id),
 UNIQUE(entry_id,position),
 FOREIGN KEY(entry_id,shop_id) REFERENCES schedule_entries(id,shop_id) ON DELETE CASCADE,
 FOREIGN KEY(barber_id,shop_id) REFERENCES barbers(id,shop_id),
 FOREIGN KEY(salon_resource_id,shop_id) REFERENCES salon_resources(id,shop_id),
 CHECK(ends_at>starts_at)
);
CREATE TABLE salon_appointment_requirements (
 entry_id text PRIMARY KEY,
 shop_id text NOT NULL,
 consultation_required boolean NOT NULL,
 patch_test_required boolean NOT NULL,
 UNIQUE(entry_id,shop_id),
 FOREIGN KEY(entry_id,shop_id) REFERENCES schedule_entries(id,shop_id) ON DELETE CASCADE
);
CREATE TABLE salon_requirement_records (
 id text PRIMARY KEY,
 shop_id text NOT NULL,
 entry_id text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('consultation','patch_test')),
 result text NOT NULL CHECK(result IN ('completed','passed','failed')),
 performed_on date NOT NULL,
 recorded_by text NOT NULL REFERENCES staff(id),
 recorded_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(entry_id,shop_id) REFERENCES salon_appointment_requirements(entry_id,shop_id) ON DELETE CASCADE,
 CHECK((kind='consultation' AND result='completed') OR (kind='patch_test' AND result IN ('passed','failed')))
);
CREATE INDEX salon_records_entry ON salon_requirement_records(shop_id,entry_id,recorded_at DESC);

-- Every active booking or block reserves actual staff/chair intervals here.
-- Positive keys are staff; negative keys are physical resources.
CREATE TABLE schedule_capacity (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 shop_id text NOT NULL,
 entry_id text NOT NULL,
 stage_id text,
 barber_id text,
 barber_resource_key bigint,
 salon_resource_id text,
 salon_resource_key bigint,
 capacity_key bigint GENERATED ALWAYS AS (coalesce(barber_resource_key,-salon_resource_key)) STORED,
 starts_at timestamptz NOT NULL,
 ends_at timestamptz NOT NULL,
 active boolean NOT NULL,
 FOREIGN KEY(entry_id,shop_id) REFERENCES schedule_entries(id,shop_id) ON DELETE CASCADE,
 FOREIGN KEY(stage_id,shop_id) REFERENCES salon_appointment_stages(id,shop_id) ON DELETE CASCADE,
 FOREIGN KEY(barber_resource_key,barber_id,shop_id) REFERENCES schedule_resources(resource_key,barber_id,shop_id),
 FOREIGN KEY(salon_resource_key,salon_resource_id,shop_id) REFERENCES salon_resources(resource_key,id,shop_id),
 CHECK((barber_id IS NOT NULL AND barber_resource_key IS NOT NULL AND salon_resource_id IS NULL AND salon_resource_key IS NULL) OR (barber_id IS NULL AND barber_resource_key IS NULL AND salon_resource_id IS NOT NULL AND salon_resource_key IS NOT NULL)),
 CHECK(ends_at>starts_at)
);
INSERT INTO schedule_capacity(shop_id,entry_id,barber_id,barber_resource_key,starts_at,ends_at,active)
 SELECT shop_id,id,barber_id,resource_key,reserved_starts_at,reserved_ends_at,status IN ('booked','blocked') FROM schedule_entries;
ALTER TABLE schedule_entries DROP CONSTRAINT schedule_reservation_excl;
ALTER TABLE schedule_capacity ADD CONSTRAINT schedule_reservation_excl EXCLUDE USING gist (int8range(capacity_key,capacity_key,'[]') WITH &&,tstzrange(starts_at,ends_at,'[)') WITH &&) WHERE (active) DEFERRABLE INITIALLY IMMEDIATE;
CREATE INDEX schedule_capacity_shop_time ON schedule_capacity(shop_id,starts_at,ends_at) WHERE active;

CREATE FUNCTION sync_schedule_capacity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cfg salon_service_settings%ROWTYPE; st salon_service_stages%ROWTYPE; phase_start timestamptz; phase_end timestamptz; staff_start timestamptz; staff_end timestamptz; person text; rk bigint; physical_key bigint; phase_id text; local_day date; day_num int; open_time time; close_time time; shift_start time; shift_end time; is_closed boolean; is_off boolean; stage_count int; total_minutes int; moved boolean;
BEGIN
 IF TG_OP='UPDATE' THEN
  moved:=NEW.shop_id IS DISTINCT FROM OLD.shop_id OR NEW.barber_id IS DISTINCT FROM OLD.barber_id OR NEW.service_id IS DISTINCT FROM OLD.service_id OR NEW.starts_at IS DISTINCT FROM OLD.starts_at OR NEW.ends_at IS DISTINCT FROM OLD.ends_at OR NEW.buffer_before_minutes IS DISTINCT FROM OLD.buffer_before_minutes OR NEW.buffer_after_minutes IS DISTINCT FROM OLD.buffer_after_minutes OR NEW.kind IS DISTINCT FROM OLD.kind;
  IF NOT moved AND NOT (OLD.status NOT IN ('booked','blocked') AND NEW.status IN ('booked','blocked')) THEN
   UPDATE schedule_capacity SET active=(NEW.status IN ('booked','blocked')) WHERE entry_id=NEW.id AND shop_id=NEW.shop_id;
   RETURN NEW;
  END IF;
 END IF;
 DELETE FROM schedule_capacity WHERE entry_id=NEW.id AND shop_id=NEW.shop_id;
 DELETE FROM salon_appointment_stages WHERE entry_id=NEW.id AND shop_id=NEW.shop_id;
 SELECT * INTO cfg FROM salon_service_settings WHERE shop_id=NEW.shop_id AND service_id=NEW.service_id;
 IF NEW.kind='appointment' AND cfg.service_id IS NOT NULL THEN
  SELECT count(*),coalesce(sum(duration_minutes),0) INTO stage_count,total_minutes FROM salon_service_stages WHERE shop_id=NEW.shop_id AND service_id=NEW.service_id;
  IF stage_count<>3 OR total_minutes<>NEW.duration_minutes OR NEW.ends_at<>NEW.starts_at+(total_minutes*interval '1 minute') THEN RAISE EXCEPTION 'Salon service stages changed. Please choose a fresh time.' USING ERRCODE='P0001'; END IF;
  INSERT INTO salon_appointment_requirements(entry_id,shop_id,consultation_required,patch_test_required) VALUES(NEW.id,NEW.shop_id,cfg.consultation_required,cfg.patch_test_required) ON CONFLICT(entry_id) DO UPDATE SET consultation_required=EXCLUDED.consultation_required,patch_test_required=EXCLUDED.patch_test_required;
  phase_start:=NEW.starts_at;local_day:=(NEW.starts_at AT TIME ZONE 'Pacific/Auckland')::date;day_num:=extract(dow FROM local_day)::int;
  SELECT h.closed,h.opens,h.closes INTO is_closed,open_time,close_time FROM shop_hours h WHERE h.shop_id=NEW.shop_id AND h.day=day_num;
  IF is_closed IS DISTINCT FROM false OR NEW.starts_at < ((local_day+open_time) AT TIME ZONE 'Pacific/Auckland') OR NEW.ends_at > ((local_day+close_time) AT TIME ZONE 'Pacific/Auckland') THEN RAISE EXCEPTION 'Outside shop hours.' USING ERRCODE='P0001'; END IF;
  FOR st IN SELECT * FROM salon_service_stages WHERE shop_id=NEW.shop_id AND service_id=NEW.service_id ORDER BY position LOOP
   phase_end:=phase_start+(st.duration_minutes*interval '1 minute');person:=CASE st.staff_mode WHEN 'booking' THEN NEW.barber_id WHEN 'fixed' THEN st.staff_id ELSE NULL END;
   phase_id:=NEW.id||':'||st.position;
   INSERT INTO salon_appointment_stages(id,shop_id,entry_id,position,name,starts_at,ends_at,barber_id,salon_resource_id) VALUES(phase_id,NEW.shop_id,NEW.id,st.position,st.name,phase_start,phase_end,person,st.salon_resource_id);
   IF person IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM barber_services WHERE shop_id=NEW.shop_id AND barber_id=person AND service_id=NEW.service_id) THEN RAISE EXCEPTION 'A stage stylist is no longer assigned to this service.' USING ERRCODE='P0001'; END IF;
    SELECT sh.off,sh.starts,sh.ends INTO is_off,shift_start,shift_end FROM shifts sh WHERE sh.shop_id=NEW.shop_id AND sh.barber_id=person AND sh.day=day_num;
    staff_start:=phase_start-CASE WHEN st.position=1 THEN NEW.buffer_before_minutes*interval '1 minute' ELSE interval '0' END;
    staff_end:=phase_end+CASE WHEN st.position=3 THEN NEW.buffer_after_minutes*interval '1 minute' ELSE interval '0' END;
    IF is_off IS DISTINCT FROM false OR staff_start<((local_day+shift_start) AT TIME ZONE 'Pacific/Auckland') OR staff_end>((local_day+shift_end) AT TIME ZONE 'Pacific/Auckland') OR staff_start<((local_day+open_time) AT TIME ZONE 'Pacific/Auckland') OR staff_end>((local_day+close_time) AT TIME ZONE 'Pacific/Auckland') THEN RAISE EXCEPTION 'A stage stylist is outside their shift.' USING ERRCODE='P0001'; END IF;
    INSERT INTO schedule_resources(shop_id,barber_id) VALUES(NEW.shop_id,person) ON CONFLICT(barber_id) DO UPDATE SET barber_id=EXCLUDED.barber_id RETURNING resource_key INTO rk;
    INSERT INTO schedule_capacity(shop_id,entry_id,stage_id,barber_id,barber_resource_key,starts_at,ends_at,active) VALUES(NEW.shop_id,NEW.id,phase_id,person,rk,staff_start,staff_end,NEW.status IN ('booked','blocked'));
   END IF;
   IF st.salon_resource_id IS NOT NULL THEN
    SELECT resource_key INTO physical_key FROM salon_resources WHERE id=st.salon_resource_id AND shop_id=NEW.shop_id;
    IF physical_key IS NULL THEN RAISE EXCEPTION 'A stage resource is unavailable.' USING ERRCODE='P0001'; END IF;
    INSERT INTO schedule_capacity(shop_id,entry_id,stage_id,salon_resource_id,salon_resource_key,starts_at,ends_at,active) VALUES(NEW.shop_id,NEW.id,phase_id,st.salon_resource_id,physical_key,phase_start,phase_end,NEW.status IN ('booked','blocked'));
   END IF;
   phase_start:=phase_end;
  END LOOP;
 ELSE
  INSERT INTO schedule_capacity(shop_id,entry_id,barber_id,barber_resource_key,starts_at,ends_at,active) VALUES(NEW.shop_id,NEW.id,NEW.barber_id,NEW.resource_key,NEW.reserved_starts_at,NEW.reserved_ends_at,NEW.status IN ('booked','blocked'));
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER schedule_capacity_sync AFTER INSERT OR UPDATE OF status,shop_id,barber_id,service_id,starts_at,ends_at,buffer_before_minutes,buffer_after_minutes,kind ON schedule_entries FOR EACH ROW EXECUTE FUNCTION sync_schedule_capacity();
