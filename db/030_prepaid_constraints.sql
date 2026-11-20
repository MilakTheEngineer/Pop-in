ALTER TABLE prepaid_accounts ADD CONSTRAINT prepaid_client_shop_fk FOREIGN KEY(client_id,shop_id) REFERENCES clients(id,shop_id);
CREATE UNIQUE INDEX commerce_prepaid_code_unique ON commerce_lines(shop_id,code_hash) WHERE code_hash IS NOT NULL;
