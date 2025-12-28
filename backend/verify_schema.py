"""
验证数据库 schema 是否正确
"""

import asyncio
import sys
from pathlib import Path

backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from app.core.database import engine
from sqlalchemy import text


async def verify_schema():
    """验证数据库 schema"""
    print("验证数据库 schema...\n")

    async with engine.connect() as conn:
        # 检查 users 表
        print("检查 users 表...")
        result = await conn.execute(
            text(
                """
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users' 
            ORDER BY ordinal_position
        """
            )
        )
        users_cols = result.fetchall()
        print(f"✓ users 表有 {len(users_cols)} 列:")
        for col in users_cols:
            print(f"  - {col[0]} ({col[1]})")

        # 检查 datasets 表
        print("\n检查 datasets 表...")
        result = await conn.execute(
            text(
                """
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'datasets' 
            ORDER BY ordinal_position
        """
            )
        )
        datasets_cols = result.fetchall()
        print(f"✓ datasets 表有 {len(datasets_cols)} 列:")
        for col in datasets_cols:
            print(f"  - {col[0]} ({col[1]})")

        # 检查关键列
        print("\n检查关键列...")
        required_users_cols = ["password_hash"]
        required_datasets_cols = ["field_mapping", "review_config"]

        users_col_names = [c[0] for c in users_cols]
        datasets_col_names = [c[0] for c in datasets_cols]

        all_good = True
        for col in required_users_cols:
            if col in users_col_names:
                print(f"✓ users.{col} 存在")
            else:
                print(f"✗ users.{col} 缺失")
                all_good = False

        for col in required_datasets_cols:
            if col in datasets_col_names:
                print(f"✓ datasets.{col} 存在")
            else:
                print(f"✗ datasets.{col} 缺失")
                all_good = False

        if all_good:
            print("\n✓ 数据库 schema 验证通过！")
        else:
            print("\n✗ 数据库 schema 存在问题")

        return all_good


if __name__ == "__main__":
    try:
        success = asyncio.run(verify_schema())
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n✗ 验证失败: {e}", file=sys.stderr)
        import traceback

        traceback.print_exc()
        sys.exit(1)
