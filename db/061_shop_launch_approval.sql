-- Approval is durable: intake flags and legacy pin changes must not revoke links.
CREATE TABLE shop_launch_approvals (
 shop_id text PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
 approved_at timestamptz NOT NULL DEFAULT now(),
 approved_by text REFERENCES staff(id) ON DELETE SET NULL,
 source text NOT NULL CHECK (source IN ('operator','legacy_pin'))
);
