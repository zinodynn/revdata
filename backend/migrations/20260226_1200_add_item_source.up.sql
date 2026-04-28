-- Up Migration
ALTER TABLE data_items
ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT 'imported';

ALTER TABLE data_items
ADD COLUMN added_by INTEGER REFERENCES users (id) ON DELETE SET NULL;

CREATE INDEX idx_data_items_source ON data_items (source);