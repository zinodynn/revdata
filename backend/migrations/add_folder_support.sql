-- 添加目录（文件夹）支持
-- 用于组织数据集的多层嵌套结构

-- 创建 folders 表
CREATE TABLE IF NOT EXISTS folders (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    parent_id INTEGER REFERENCES folders(id) ON DELETE CASCADE,
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_folders_owner_id ON folders(owner_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id);

-- 为 datasets 表添加 folder_id 字段
ALTER TABLE datasets ADD COLUMN IF NOT EXISTS folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_datasets_folder_id ON datasets(folder_id);

-- 添加注释
COMMENT ON TABLE folders IS '数据集目录表，支持多层嵌套结构';
COMMENT ON COLUMN folders.name IS '目录名称';
COMMENT ON COLUMN folders.parent_id IS '父目录ID，NULL表示根目录';
COMMENT ON COLUMN folders.owner_id IS '所有者用户ID';
COMMENT ON COLUMN datasets.folder_id IS '所属目录ID，NULL表示在根目录';
