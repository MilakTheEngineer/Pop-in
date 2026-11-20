ALTER TABLE schedule_entries ADD CONSTRAINT schedule_entries_id_shop_key UNIQUE(id,shop_id);
ALTER TABLE guest_visit_people ADD CONSTRAINT guest_visit_people_entry_shop_fk FOREIGN KEY(entry_id,shop_id) REFERENCES schedule_entries(id,shop_id);
