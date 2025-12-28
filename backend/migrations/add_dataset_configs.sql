-- 添加字段映射和审核配置列到 datasets 表
-- 执行日期: 2025-12-28

-- 添加 field_mapping 列 (JSON类型，存储字段映射配置)
ALTER TABLE datasets 
ADD COLUMN IF NOT EXISTS field_mapping JSONB DEFAULT NULL;

-- 添加 review_config 列 (JSON类型，存储审核规则配置)
ALTER TABLE datasets 
ADD COLUMN IF NOT EXISTS review_config JSONB DEFAULT NULL;

-- 添加注释
COMMENT ON COLUMN datasets.field_mapping IS '字段映射配置：问题/回答/思考字段等';
COMMENT ON COLUMN datasets.review_config IS '审核规则配置：是否必填原因、审核模式等';

-- 验证列已添加
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'datasets' 
  AND column_name IN ('field_mapping', 'review_config');
