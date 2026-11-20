-- Import permission is explicit; ordinary shop membership is not owner access.
CREATE TABLE shop_owners (
  staff_id text NOT NULL,
  shop_id text NOT NULL,
  PRIMARY KEY(staff_id,shop_id),
  FOREIGN KEY(staff_id,shop_id) REFERENCES memberships(staff_id,shop_id) ON DELETE CASCADE
);
-- Only the fictional local demo is bootstrapped. Other owners are provisioned deliberately.
INSERT INTO shop_owners(staff_id,shop_id)
SELECT m.staff_id,m.shop_id FROM memberships m JOIN staff s ON s.id=m.staff_id
WHERE m.staff_id='demo' AND m.shop_id='rimu' AND s.email='demo@rimu.example';

CREATE TABLE import_drafts (
  id text PRIMARY KEY,
  shop_id text NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  staff_id text REFERENCES staff(id) ON DELETE SET NULL,
  file_hash text NOT NULL,
  config_hash text NOT NULL,
  plan_hash text NOT NULL,
  status text NOT NULL CHECK(status IN ('previewed','processing','complete')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE import_records (
  shop_id text NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK(kind IN ('client','appointment')),
  source_key text NOT NULL,
  content_hash text NOT NULL,
  entity_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(shop_id,kind,source_key)
);
ALTER TABLE schedule_entries DROP CONSTRAINT schedule_entries_source_check;
ALTER TABLE schedule_entries ADD CONSTRAINT schedule_entries_source_check CHECK(source IN ('phone','walk_in','guest','import'));
ALTER TABLE schedule_entries ADD COLUMN suppress_reminders boolean NOT NULL DEFAULT false;
