-- 添加参考文档表
CREATE TABLE IF NOT EXISTS reference_docs (
    id SERIAL PRIMARY KEY,
    dataset_id INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_reference_docs_dataset_id ON reference_docs(dataset_id);

-- 添加数据集去重配置字段
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS dedup_config JSONB DEFAULT NULL;
