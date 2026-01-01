"""执行数据库迁移：添加is_left字段"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text

from app.core.database import engine


async def run_migration():
    async with engine.begin() as conn:
        # 添加is_left字段
        await conn.execute(
            text(
                """
            ALTER TABLE auth_code_sessions
            ADD COLUMN IF NOT EXISTS is_left BOOLEAN DEFAULT FALSE
        """
            )
        )
        print("✓ 添加is_left字段成功")

        # 验证
        result = await conn.execute(
            text(
                """
            SELECT column_name, data_type, column_default
            FROM information_schema.columns
            WHERE table_name = 'auth_code_sessions' AND column_name = 'is_left'
        """
            )
        )
        row = result.fetchone()
        if row:
            print(f"  - {row[0]}: {row[1]}, default: {row[2]}")


if __name__ == "__main__":
    asyncio.run(run_migration())
