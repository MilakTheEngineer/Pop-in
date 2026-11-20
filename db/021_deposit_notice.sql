ALTER TABLE deposit_holds ADD COLUMN cancellation_minutes integer NOT NULL DEFAULT 0 CHECK(cancellation_minutes BETWEEN 0 AND 43200);
