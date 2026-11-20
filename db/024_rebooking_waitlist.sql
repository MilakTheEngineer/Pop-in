CREATE TABLE recurring_series (
 id text PRIMARY KEY,
 shop_id text NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
 barber_id text NOT NULL,
 service_id text NOT NULL,
 interval_weeks integer NOT NULL CHECK(interval_weeks IN (1,2,4,6,8)),
 start_date date NOT NULL,
 end_date date NOT NULL CHECK(end_date>=start_date),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,shop_id),
 FOREIGN KEY(barber_id,shop_id) REFERENCES barbers(id,shop_id),
 FOREIGN KEY(service_id,shop_id) REFERENCES services(id,shop_id)
);
ALTER TABLE schedule_entries ADD COLUMN recurrence_id text;
ALTER TABLE schedule_entries ADD FOREIGN KEY(recurrence_id,shop_id) REFERENCES recurring_series(id,shop_id);

CREATE TABLE waitlist_entries (
 id text PRIMARY KEY,
 shop_id text NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
 service_id text NOT NULL,
 preferred_barber_id text,
 first_name text NOT NULL,
 email text NOT NULL,
 phone text NOT NULL DEFAULT '',
 date_from date NOT NULL,
 date_to date NOT NULL CHECK(date_to>=date_from),
 weekdays integer[] NOT NULL,
 time_from time NOT NULL,
 time_to time NOT NULL CHECK(time_to>time_from),
 token_hash text NOT NULL UNIQUE,
 status text NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting','left','booked')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,shop_id),
 FOREIGN KEY(service_id,shop_id) REFERENCES services(id,shop_id),
 FOREIGN KEY(preferred_barber_id,shop_id) REFERENCES barbers(id,shop_id)
);
CREATE TABLE waitlist_openings (
 id text PRIMARY KEY,
 shop_id text NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
 barber_id text NOT NULL,
 source_entry_id text NOT NULL,
 starts_at timestamptz NOT NULL,
 ends_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 processed_at timestamptz,
 UNIQUE(id,shop_id),
 FOREIGN KEY(barber_id,shop_id) REFERENCES barbers(id,shop_id)
);
CREATE TABLE waitlist_offers (
 id text PRIMARY KEY,
 shop_id text NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
 waitlist_id text NOT NULL,
 opening_id text NOT NULL,
 barber_id text NOT NULL,
 starts_at timestamptz NOT NULL,
 ends_at timestamptz NOT NULL,
 price_cents integer NOT NULL CHECK(price_cents>=0),
 duration_minutes integer NOT NULL CHECK(duration_minutes>0),
 expires_at timestamptz NOT NULL,
 state text NOT NULL DEFAULT 'offered' CHECK(state IN ('offered','payment_pending','claimed','declined','expired','unavailable')),
 booking_entry_id text REFERENCES schedule_entries(id) ON DELETE SET NULL,
 deposit_hold_id text REFERENCES deposit_holds(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(opening_id,waitlist_id),
 FOREIGN KEY(waitlist_id,shop_id) REFERENCES waitlist_entries(id,shop_id) ON DELETE CASCADE,
 FOREIGN KEY(opening_id,shop_id) REFERENCES waitlist_openings(id,shop_id) ON DELETE CASCADE,
 FOREIGN KEY(barber_id,shop_id) REFERENCES barbers(id,shop_id)
);
CREATE UNIQUE INDEX waitlist_one_active_offer ON waitlist_offers(waitlist_id) WHERE state IN ('offered','payment_pending');
CREATE INDEX waitlist_unprocessed_openings ON waitlist_openings(shop_id,created_at) WHERE processed_at IS NULL;
CREATE FUNCTION record_waitlist_opening() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.kind='appointment' AND OLD.status='booked' AND OLD.starts_at>now()
    AND (NEW.status='cancelled' OR NEW.starts_at<>OLD.starts_at OR NEW.ends_at<>OLD.ends_at OR NEW.barber_id<>OLD.barber_id) THEN
  INSERT INTO waitlist_openings(id,shop_id,barber_id,source_entry_id,starts_at,ends_at)
  VALUES (md5(random()::text || clock_timestamp()::text || OLD.id),OLD.shop_id,OLD.barber_id,OLD.id,OLD.starts_at,OLD.ends_at);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER waitlist_opening_after_change AFTER UPDATE OF status,starts_at,ends_at,barber_id ON schedule_entries FOR EACH ROW EXECUTE FUNCTION record_waitlist_opening();

CREATE FUNCTION waitlist_deposit_transition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.state='paid' AND OLD.state IS DISTINCT FROM NEW.state THEN
  UPDATE waitlist_entries SET status='booked' WHERE id IN (SELECT waitlist_id FROM waitlist_offers WHERE deposit_hold_id=NEW.id AND state='payment_pending');
  UPDATE waitlist_offers SET state='claimed',booking_entry_id=NEW.booking_entry_id WHERE deposit_hold_id=NEW.id AND state='payment_pending';
 ELSIF NEW.state IN ('failed','expired','refund_pending','refund_failed','refunded') AND OLD.state IS DISTINCT FROM NEW.state THEN
  UPDATE waitlist_offers SET state='unavailable' WHERE deposit_hold_id=NEW.id AND state='payment_pending';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER waitlist_deposit_after_update AFTER UPDATE OF state ON deposit_holds FOR EACH ROW EXECUTE FUNCTION waitlist_deposit_transition();
