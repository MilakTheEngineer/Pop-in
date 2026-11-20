-- Removing a service assignment must not silently erase an owner's price.
-- Only assigned services are offered, and the saved price applies again if
-- that service is later reassigned to the same profile.
ALTER TABLE barber_service_prices DROP CONSTRAINT barber_service_prices_barber_id_service_id_fkey;
ALTER TABLE barber_service_prices DROP CONSTRAINT barber_service_prices_barber_id_shop_id_fkey;
ALTER TABLE barber_service_prices DROP CONSTRAINT barber_service_prices_service_id_shop_id_fkey;
ALTER TABLE barber_service_prices ADD CONSTRAINT barber_service_prices_barber_shop_fk FOREIGN KEY(barber_id,shop_id) REFERENCES barbers(id,shop_id) ON DELETE CASCADE;
ALTER TABLE barber_service_prices ADD CONSTRAINT barber_service_prices_service_shop_fk FOREIGN KEY(service_id,shop_id) REFERENCES services(id,shop_id) ON DELETE CASCADE;
