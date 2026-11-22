ALTER TABLE beta_regular_interest ADD COLUMN approved_at timestamptz;
ALTER TABLE beta_regular_interest ADD COLUMN approved_by text REFERENCES staff(id) ON DELETE SET NULL;
ALTER TABLE beta_regular_interest ADD COLUMN activated_at timestamptz;
UPDATE beta_regular_interest i SET approved_at=a.approved_at,approved_by=a.approved_by,activated_at=a.activated_at
FROM beta_applications a WHERE a.shop_id=i.shop_id AND a.kind='regular' AND a.state='approved';
