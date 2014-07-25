-- 2014-06-29
-- add frequency to promo banners
ALTER TABLE promo_banners ADD COLUMN rule_frequency integer DEFAULT 1;

