-- 修复时区：将所有 timestamp 列改为 timestamptz
-- 迁移日期: 2026-02-09

-- datasets 表
ALTER TABLE datasets
ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC',
ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';

-- data_items 表
ALTER TABLE data_items
ALTER COLUMN reviewed_at TYPE timestamptz USING reviewed_at AT TIME ZONE 'UTC',
ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC',
ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';

-- users 表
ALTER TABLE users
ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC',
ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';

-- tasks 表
ALTER TABLE tasks
ALTER COLUMN due_date TYPE timestamptz USING due_date AT TIME ZONE 'UTC',
ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC',
ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC',
ALTER COLUMN completed_at TYPE timestamptz USING completed_at AT TIME ZONE 'UTC';

-- folders 表
ALTER TABLE folders
ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC',
ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';

-- reference_docs 表
ALTER TABLE reference_docs
ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

-- share_links 表
ALTER TABLE share_links
ALTER COLUMN expires_at TYPE timestamptz USING expires_at AT TIME ZONE 'UTC',
ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC',
ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';

-- revisions 表
ALTER TABLE revisions
ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

-- 为新的默认值设置 server_default (使用 now() 返回 timestamptz)
ALTER TABLE datasets
ALTER COLUMN created_at
SET DEFAULT now(),
ALTER COLUMN updated_at
SET DEFAULT now();

ALTER TABLE data_items
ALTER COLUMN created_at
SET DEFAULT now(),
ALTER COLUMN updated_at
SET DEFAULT now();

ALTER TABLE users
ALTER COLUMN created_at
SET DEFAULT now(),
ALTER COLUMN updated_at
SET DEFAULT now();

ALTER TABLE tasks
ALTER COLUMN created_at
SET DEFAULT now(),
ALTER COLUMN updated_at
SET DEFAULT now();

ALTER TABLE folders
ALTER COLUMN created_at
SET DEFAULT now(),
ALTER COLUMN updated_at
SET DEFAULT now();

ALTER TABLE reference_docs
ALTER COLUMN created_at
SET DEFAULT now();

ALTER TABLE share_links
ALTER COLUMN created_at
SET DEFAULT now(),
ALTER COLUMN updated_at
SET DEFAULT now();

ALTER TABLE revisions ALTER COLUMN created_at SET DEFAULT now();