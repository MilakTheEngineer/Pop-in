ALTER TABLE memberships ADD COLUMN activation_tracked boolean NOT NULL DEFAULT false;
ALTER TABLE memberships ADD COLUMN first_workspace_at timestamptz;
ALTER TABLE memberships ADD COLUMN activation_notified_at timestamptz;
ALTER TABLE memberships ADD COLUMN bookable_staff boolean NOT NULL DEFAULT false;
ALTER TABLE shop_invitations ADD COLUMN bookable_staff boolean NOT NULL DEFAULT false;
