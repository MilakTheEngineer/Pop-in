-- A visit has one organiser contact. Do not copy it into each person's client
-- profile: a shared family number is not proof of a shared client identity.
ALTER TABLE guest_visits ADD COLUMN organiser_phone text NOT NULL DEFAULT ''
 CHECK (char_length(organiser_phone) <= 40);
