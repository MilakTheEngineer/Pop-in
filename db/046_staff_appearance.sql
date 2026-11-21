CREATE TABLE shop_appearance (
 shop_id text PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
 theme text NOT NULL DEFAULT 'pine' CHECK(theme IN ('pine','navy','plum','slate','terracotta'))
);
