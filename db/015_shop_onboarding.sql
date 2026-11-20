-- Existing shops retain their public pages; newly created shops start as drafts.
ALTER TABLE shops ADD COLUMN booking_published boolean NOT NULL DEFAULT true;
ALTER TABLE schedule_entries ADD COLUMN onboarding_test boolean NOT NULL DEFAULT false;
CREATE TABLE shop_onboarding (
 shop_id text PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
 final_export boolean NOT NULL DEFAULT false,
 switchover_at timestamptz,
 rollback_contact text NOT NULL DEFAULT '',
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE shop_invitations (
 id text PRIMARY KEY,
 shop_id text NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
 email text NOT NULL,
 token_hash text UNIQUE NOT NULL,
 created_by text NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL,
 accepted_at timestamptz,
 accepted_by text REFERENCES staff(id) ON DELETE SET NULL,
 revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX shop_invitation_list ON shop_invitations(shop_id,created_at DESC);
