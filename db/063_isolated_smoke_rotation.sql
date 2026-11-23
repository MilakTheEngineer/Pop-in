-- Historical quarantine remains permanent. Expiry alone does not free the slot.
CREATE UNIQUE INDEX isolated_smoke_one_active ON isolated_smoke ((true)) WHERE closed_at IS NULL;
CREATE FUNCTION preserve_smoke_closure() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.closed_at IS NOT NULL AND NEW.closed_at IS DISTINCT FROM OLD.closed_at THEN
  RAISE EXCEPTION 'Closed fixtures cannot reopen';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER preserve_smoke_closure BEFORE UPDATE ON isolated_smoke FOR EACH ROW EXECUTE FUNCTION preserve_smoke_closure();
