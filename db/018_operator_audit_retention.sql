-- Keep the operator audit even if a shop is later removed. The audit contains
-- opaque identifiers and fixed action codes, not customer records or notes.
ALTER TABLE operator_support_audit DROP CONSTRAINT operator_support_audit_shop_id_fkey;
