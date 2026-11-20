-- A receipt must reference a transaction from the same shop and appointment.
ALTER TABLE checkout_receipts DROP CONSTRAINT checkout_receipts_payment_id_fkey;
ALTER TABLE checkout_receipts DROP CONSTRAINT checkout_receipts_test_payment_id_fkey;
ALTER TABLE checkout_receipts ADD CONSTRAINT checkout_receipts_payment_scope_fk FOREIGN KEY(payment_id,shop_id,entry_id) REFERENCES payment_entries(id,shop_id,entry_id);
ALTER TABLE checkout_receipts ADD CONSTRAINT checkout_receipts_test_payment_scope_fk FOREIGN KEY(test_payment_id,shop_id,entry_id) REFERENCES checkout_test_entries(id,shop_id,entry_id);
