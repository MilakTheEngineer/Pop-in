ALTER TABLE location_groups ADD COLUMN plan_code text NOT NULL DEFAULT 'free' CHECK(plan_code IN ('free','pro','business','founder'));
UPDATE location_groups SET plan_code='founder' WHERE id IN (SELECT s.location_group_id FROM shops s JOIN beta_applications a ON a.shop_id=s.id WHERE a.kind='founding' AND a.state='approved');
ALTER TABLE shop_invitations ADD COLUMN barber_id text;
ALTER TABLE shop_invitations ADD CONSTRAINT invitation_barber_shop_fk FOREIGN KEY(barber_id,shop_id) REFERENCES barbers(id,shop_id) ON DELETE SET NULL (barber_id);
