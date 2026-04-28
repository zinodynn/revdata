-- Down Migration
DROP INDEX idx_data_items_source;

ALTER TABLE data_items DROP COLUMN added_by;

ALTER TABLE data_items DROP COLUMN source;