"""
数据库迁移脚本：添加 field_mapping 和 review_config 列
执行日期: 2025-12-28
"""

import asyncio
import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from app.core.database import engine
from sqlalchemy import text


async def migrate():
    """执行数据库迁移"""
    print("开始数据库迁移...")

    async with engine.begin() as conn:
        # 添加 field_mapping 列
        print("添加 field_mapping 列...")
        await conn.execute(
            text(
                """
            ALTER TABLE datasets 
            ADD COLUMN IF NOT EXISTS field_mapping JSONB DEFAULT NULL
        """
            )
        )

        # 添加 review_config 列
        print("添加 review_config 列...")
        await conn.execute(
            text(
                """
            ALTER TABLE datasets 
            ADD COLUMN IF NOT EXISTS review_config JSONB DEFAULT NULL
        """
            )
        )

        # 添加注释
        print("添加列注释...")
        await conn.execute(
            text(
                """
            COMMENT ON COLUMN datasets.field_mapping IS '字段映射配置：问题/回答/思考字段等'
        """
            )
        )

        await conn.execute(
            text(
                """
            COMMENT ON COLUMN datasets.review_config IS '审核规则配置：是否必填原因、审核模式等'
        """
            )
        )

        # 验证
        print("验证列已添加...")
        result = await conn.execute(
            text(
                """
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'datasets' 
              AND column_name IN ('field_mapping', 'review_config')
            ORDER BY column_name
        """
            )
        )

        rows = result.fetchall()
        if rows:
            print("\n✓ 迁移成功！已添加的列:")
            for row in rows:
                print(f"  - {row[0]} ({row[1]}, nullable: {row[2]})")
        else:
            print("\n✗ 迁移失败：未找到新添加的列")
            return False

    print("\n数据库迁移完成！")
    return True


if __name__ == "__main__":
    try:
        success = asyncio.run(migrate())
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n✗ 迁移失败: {e}", file=sys.stderr)
        import traceback

        traceback.print_exc()
        sys.exit(1)
