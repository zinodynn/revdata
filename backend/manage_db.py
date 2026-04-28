import asyncio
import os
import sys
import re
from datetime import datetime
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import settings

# 数据库迁移表名
MIGRATION_TABLE = "schema_migrations"
MIGRATIONS_DIR = "migrations"

async def get_db_engine():
    """获取数据库引擎"""
    return create_async_engine(settings.DATABASE_URL)

async def init_migration_table(conn):
    """初始化迁移记录表"""
    await conn.execute(text(f"""
        CREATE TABLE IF NOT EXISTS {MIGRATION_TABLE} (
            version VARCHAR(255) PRIMARY KEY,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """))

def get_migration_files():
    """获取所有迁移文件，按版本排序"""
    files = os.listdir(MIGRATIONS_DIR)
    
    # 匹配模式: YYYYMMDD_HHMM_name.up.sql / .down.sql
    pattern = re.compile(r"^(\d{8}_\d{4}_.+)\.(up|down)\.sql$")
    
    migrations = {}
    for f in files:
        match = pattern.match(f)
        if match:
            version = match.group(1)
            direction = match.group(2)
            if version not in migrations:
                migrations[version] = {}
            migrations[version][direction] = os.path.join(MIGRATIONS_DIR, f)
            
    # 只返回成对的文件(或至少有up的)
    sorted_versions = sorted(migrations.keys())
    return [(v, migrations[v]) for v in sorted_versions]

async def get_applied_migrations(conn):
    """获取已应用的迁移版本"""
    try:
        result = await conn.execute(text(f"SELECT version FROM {MIGRATION_TABLE}"))
        return {row[0] for row in result.fetchall()}
    except Exception:
        # 表可能不存在
        return set()

async def upgrade(fake=False):
    engine = await get_db_engine()
    async with engine.begin() as conn:
        await init_migration_table(conn)
        applied = await get_applied_migrations(conn)
        
        all_migrations = get_migration_files()
        
        print(f"Found {len(all_migrations)} migrations.")
        
        for version, files in all_migrations:
            if version in applied:
                continue
                
            if 'up' not in files:
                print(f"Skipping {version}: missing up.sql")
                continue
                
            print(f"Applying {version} (fake={fake})...")
            
            try:
                if not fake:
                    with open(files['up'], 'r', encoding='utf-8') as f:
                        sql = f.read()
                    
                    # 支持多条语句 (简单分割，虽然通常是一个文件)
                    # 注意：某些复杂的 PL/pgSQL 可能不能简单分割
                    for statement in sql.split(';'):
                        if statement.strip():
                            await conn.execute(text(statement))
                
                await conn.execute(text(f"INSERT INTO {MIGRATION_TABLE} (version) VALUES (:v)"), {"v": version})
                print(f"✅ Applied {version}")
            except Exception as e:
                print(f"❌ Failed to apply {version}: {e}")
                # 事务会自动回滚
                raise e

async def downgrade(steps=1):
    engine = await get_db_engine()
    async with engine.begin() as conn:
        await init_migration_table(conn)
        # 获取所有已应用的，按倒序排列
        result = await conn.execute(text(f"SELECT version FROM {MIGRATION_TABLE} ORDER BY version DESC"))
        applied_versions = [row[0] for row in result.fetchall()]
        
        if not applied_versions:
            print("No migrations to rollback.")
            return

        # 确定要回滚的版本
        to_rollback = applied_versions[:steps]
        
        # 获取文件映射
        all_migrations_map = dict(get_migration_files())
        
        for version in to_rollback:
            files = all_migrations_map.get(version)
            if not files or 'down' not in files:
                print(f"❌ Cannot rollback {version}: missing down.sql")
                break # 停止回滚，保证一致性
            
            print(f"Rolling back {version}...")
            with open(files['down'], 'r', encoding='utf-8') as f:
                sql = f.read()
            
            try:
                for statement in sql.split(';'):
                   if statement.strip():
                        await conn.execute(text(statement))
                
                await conn.execute(text(f"DELETE FROM {MIGRATION_TABLE} WHERE version = :v"), {"v": version})
                print(f"✅ Rolled back {version}")
            except Exception as e:
                print(f"❌ Failed to rollback {version}: {e}")
                raise e

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Database Migration Tool")
    subparsers = parser.add_subparsers(dest="command")
    
    up_parser = subparsers.add_parser("upgrade", help="Execute pending migrations")
    up_parser.add_argument("--fake", action="store_true", help="Record migration as applied without executing SQL")
    
    down_parser = subparsers.add_parser("downgrade", help="Rollback migrations")
    down_parser.add_argument("--steps", type=int, default=1, help="Number of steps to downgrade")
    
    args = parser.parse_args()
    
    if args.command == "upgrade":
        asyncio.run(upgrade(fake=args.fake))
    elif args.command == "downgrade":
        asyncio.run(downgrade(steps=args.steps))
    else:
        parser.print_help()
