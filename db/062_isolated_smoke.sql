-- Durable quarantine: deleting/expiring runtime access never makes fixture mail live.
CREATE TABLE isolated_smoke (
 shop_id text PRIMARY KEY REFERENCES shops(id),
 owner_id text NOT NULL REFERENCES staff(id),
 operator_id text NOT NULL REFERENCES staff(id),
 emails text[] NOT NULL,
 expires_at timestamptz NOT NULL,
 closed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE isolated_smoke_capture (
 id bigserial PRIMARY KEY,
 shop_id text NOT NULL REFERENCES isolated_smoke(shop_id),
 event_key text NOT NULL UNIQUE,
 kind text NOT NULL CHECK(kind IN ('account','booking','sms')),
 payload_ciphertext text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION quarantine_smoke_outbox() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM isolated_smoke WHERE shop_id=NEW.shop_id) THEN
  IF TG_TABLE_NAME='booking_email_outbox' THEN
   INSERT INTO isolated_smoke_capture(shop_id,event_key,kind,payload_ciphertext)
   VALUES(NEW.shop_id,NEW.event_key,'booking',NEW.payload_ciphertext) ON CONFLICT(event_key) DO NOTHING;
  ELSE
   INSERT INTO isolated_smoke_capture(shop_id,event_key,kind)
   VALUES(NEW.shop_id,'sms/'||NEW.id,'sms') ON CONFLICT(event_key) DO NOTHING;
  END IF;
  RETURN NULL;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER quarantine_smoke_email BEFORE INSERT OR UPDATE ON booking_email_outbox FOR EACH ROW EXECUTE FUNCTION quarantine_smoke_outbox();
CREATE TRIGGER quarantine_smoke_sms BEFORE INSERT OR UPDATE ON sms_reminder_outbox FOR EACH ROW EXECUTE FUNCTION quarantine_smoke_outbox();
CREATE FUNCTION reject_smoke_integration() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM isolated_smoke WHERE shop_id=NEW.shop_id) THEN
  RAISE EXCEPTION 'External integrations are unavailable for isolated fixtures';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER reject_smoke_calendar BEFORE INSERT OR UPDATE ON calendar_integrations FOR EACH ROW EXECUTE FUNCTION reject_smoke_integration();
CREATE TRIGGER reject_smoke_payments BEFORE INSERT OR UPDATE ON deposit_merchants FOR EACH ROW EXECUTE FUNCTION reject_smoke_integration();
CREATE TRIGGER reject_smoke_deposits BEFORE INSERT OR UPDATE ON service_deposits FOR EACH ROW EXECUTE FUNCTION reject_smoke_integration();
