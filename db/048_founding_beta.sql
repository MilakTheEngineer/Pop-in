CREATE TABLE beta_capacity (id integer PRIMARY KEY CHECK(id=1));
INSERT INTO beta_capacity(id) VALUES(1);
CREATE TABLE beta_applications (
 shop_id text PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('founding','regular')),
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','approved')),
 created_at timestamptz NOT NULL DEFAULT now(),
 approved_at timestamptz,
 approved_by text REFERENCES staff(id) ON DELETE SET NULL,
 activated_at timestamptz,
 core_granted_at timestamptz,
 core_granted_by text REFERENCES staff(id) ON DELETE SET NULL
);
CREATE TABLE beta_reports (
 id text PRIMARY KEY,
 shop_id text NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
 category text NOT NULL CHECK(category IN ('booking','calendar','walk-ins','setup','other')),
 created_at timestamptz NOT NULL DEFAULT now()
);
