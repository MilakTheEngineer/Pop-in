-- Keep the full imported busy window even when an existing appointment occupies
-- part of it. A later cancellation must not reopen that external busy time.
CREATE TABLE calendar_busy_windows (
 integration_id text NOT NULL, shop_id text NOT NULL, starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
 PRIMARY KEY(integration_id,starts_at,ends_at),
 FOREIGN KEY(integration_id,shop_id) REFERENCES calendar_integrations(id,shop_id) ON DELETE CASCADE,
 CHECK(ends_at>starts_at)
);
CREATE INDEX calendar_busy_window_time ON calendar_busy_windows(shop_id,starts_at,ends_at);
CREATE FUNCTION guard_external_calendar_busy() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE person text;
BEGIN
 IF NEW.active AND NEW.barber_id IS NOT NULL THEN
  SELECT b.person_id INTO person FROM barbers b WHERE b.id=NEW.barber_id AND b.shop_id=NEW.shop_id;
  -- Share the same physical-person lock with the importer, including linked locations.
  PERFORM id FROM team_people WHERE id=person FOR UPDATE;
  IF EXISTS(SELECT 1 FROM schedule_entries e WHERE e.id=NEW.entry_id AND e.shop_id=NEW.shop_id AND e.calendar_integration_id IS NULL)
     AND EXISTS(SELECT 1 FROM calendar_busy_windows w JOIN calendar_integrations i ON i.id=w.integration_id AND i.shop_id=w.shop_id JOIN barbers b ON b.id=i.barber_id AND b.shop_id=i.shop_id WHERE i.status<>'disconnected' AND b.person_id=person AND w.starts_at<NEW.ends_at AND w.ends_at>NEW.starts_at) THEN
   RAISE EXCEPTION 'External calendar busy time is unavailable.' USING ERRCODE='P0001';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER external_calendar_capacity_guard BEFORE INSERT OR UPDATE OF active,starts_at,ends_at,barber_id ON schedule_capacity FOR EACH ROW EXECUTE FUNCTION guard_external_calendar_busy();
