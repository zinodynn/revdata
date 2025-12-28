-- 添加is_left字段到auth_code_sessions表
ALTER TABLE auth_code_sessions
ADD COLUMN IF NOT EXISTS is_left BOOLEAN DEFAULT FALSE;
