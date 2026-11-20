-- Event assignments follow their underlying shop resources when a shop is removed.
ALTER TABLE community_event_staff DROP CONSTRAINT community_event_staff_barber_id_shop_id_fkey;
ALTER TABLE community_event_staff ADD CONSTRAINT community_event_staff_barber_id_shop_id_fkey FOREIGN KEY(barber_id,shop_id) REFERENCES barbers(id,shop_id) ON DELETE CASCADE;
ALTER TABLE community_event_services DROP CONSTRAINT community_event_services_service_id_shop_id_fkey;
ALTER TABLE community_event_services ADD CONSTRAINT community_event_services_service_id_shop_id_fkey FOREIGN KEY(service_id,shop_id) REFERENCES services(id,shop_id) ON DELETE CASCADE;
