-- 添加 error 状态枚举值和 error_message 字段
-- 迁移日期: 2026-02-09

-- 步骤 1: 添加新的 error 枚举值到 DatasetStatus
ALTER TYPE datasetstatus ADD VALUE IF NOT EXISTS 'error';

-- 步骤 2: 添加 error_message 列
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS error_message TEXT;

-- 为已有 error 状态的数据集设置默认错误消息（如果有的话）
UPDATE datasets
SET
    error_message = '未知错误'
WHERE
    status = 'error'
    AND error_message IS NULL;