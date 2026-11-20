CREATE TABLE operator_booking_telemetry (
 shop_id text NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
 environment text NOT NULL CHECK(environment IN ('unknown','local','staging','pilot','production')),
 source text NOT NULL CHECK(source IN ('staff','guest','whanau','queue')),
 last_seen_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(shop_id,environment,source)
);
CREATE TABLE operator_booking_events (
 id text PRIMARY KEY,
 shop_id text NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
 environment text NOT NULL CHECK(environment IN ('unknown','local','staging','pilot','production')),
 source text NOT NULL CHECK(source IN ('staff','guest','whanau','queue')),
 operation text NOT NULL CHECK(operation IN ('create','move','seat')),
 code text NOT NULL CHECK(code IN ('slot_unavailable','rejected','failed')),
 occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX operator_booking_event_time ON operator_booking_events(environment,shop_id,occurred_at DESC);
CREATE TABLE operator_support_audit (
 id text PRIMARY KEY,
 shop_id text NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
 environment text NOT NULL CHECK(environment IN ('unknown','local','staging','pilot','production')),
 event_source text NOT NULL CHECK(event_source IN ('booking','preview')),
 event_id text NOT NULL,
 action text NOT NULL CHECK(action IN ('acknowledge','reopen')),
 operator_id text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX operator_audit_event ON operator_support_audit(environment,shop_id,event_source,event_id,created_at DESC,id DESC);
-- Only the rehearsal script writes this evidence. It is scoped explicitly to
-- synthetic local PGlite staging, not a managed PostgreSQL backup or restore.
CREATE TABLE operator_restore_evidence (
 id text PRIMARY KEY,
 environment text NOT NULL CHECK(environment='staging'),
 method text NOT NULL CHECK(method='synthetic_pglite'),
 result text NOT NULL CHECK(result='verified'),
 archive_sha256 text NOT NULL CHECK(archive_sha256 ~ '^[a-f0-9]{64}$'),
 archive_bytes bigint NOT NULL CHECK(archive_bytes>0),
 migration_count integer NOT NULL CHECK(migration_count>0),
 checks_passed integer NOT NULL CHECK(checks_passed>0),
 duration_ms integer NOT NULL CHECK(duration_ms>=0),
 verified_at timestamptz NOT NULL DEFAULT now()
);
