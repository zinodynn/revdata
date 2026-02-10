-- 添加导入历史记录表
-- 迁移日期: 2026-02-09

-- 创建导入操作类型枚举
CREATE TYPE importoperationtype AS ENUM ('upload', 'append');

-- 创建导入状态枚举
CREATE TYPE importstatus AS ENUM ('importing', 'completed', 'failed');

-- 创建导入历史表
CREATE TABLE IF NOT EXISTS import_histories (
    id SERIAL PRIMARY KEY,
    dataset_id INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    
    -- 操作信息
    operation_type importoperationtype NOT NULL,
    filename VARCHAR(500) NOT NULL,
    file_size INTEGER DEFAULT 0,
    
    -- 导入统计
    total_items INTEGER DEFAULT 0,
    imported_items INTEGER DEFAULT 0,
    skipped_duplicates INTEGER DEFAULT 0,
    
    -- 状态
    status importstatus DEFAULT 'importing',
    error_message TEXT,
    
    -- 去重配置快照
    dedup_config_snapshot JSON,
    skip_duplicates BOOLEAN DEFAULT FALSE,
    
    -- 数据项范围
    start_seq INTEGER,
    end_seq INTEGER,
    
    -- 激活状态
    is_active BOOLEAN DEFAULT TRUE,
    
    -- 操作人和时间
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_import_histories_dataset_id ON import_histories(dataset_id);
CREATE INDEX IF NOT EXISTS idx_import_histories_created_at ON import_histories(created_at);
CREATE INDEX IF NOT EXISTS idx_import_histories_is_active ON import_histories(is_active);

-- 为现有数据集创建初始导入历史记录（可选）
-- 注意：这会为每个已存在的数据集创建一条 'upload' 记录，但缺少详细信息
-- INSERT INTO import_histories (dataset_id, operation_type, filename, total_items, imported_items, status, is_active, created_by, created_at)
-- SELECT id, 'upload', COALESCE(source_file, name || '.unknown'), item_count, item_count, 'completed', TRUE, owner_id, created_at
-- FROM datasets
-- WHERE item_count > 0;
