-- Records belong to the client as well as the appointment. Reassigning an
-- appointment must not disclose one client's records to another client.
ALTER TABLE salon_requirement_records ADD COLUMN client_id text;
UPDATE salon_requirement_records r SET client_id=e.client_id FROM schedule_entries e WHERE e.id=r.entry_id AND e.shop_id=r.shop_id;
ALTER TABLE salon_requirement_records ADD CONSTRAINT salon_record_client_shop_fk FOREIGN KEY(client_id,shop_id) REFERENCES clients(id,shop_id);
CREATE INDEX salon_records_client ON salon_requirement_records(shop_id,client_id,entry_id);
