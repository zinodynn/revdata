"""
One-off script to normalize DataItem JSON fields in the database.
Run with: `python -m backend.scripts.normalize_items` from the repo root (with backend venv activated)
"""

import asyncio

from app.core.database import AsyncSessionLocal
from app.models.data_item import DataItem
from app.utils import normalize_json_keys


async def main():
    updated = 0
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(DataItem))
        items = result.scalars().all()
        for item in items:
            orig_orig = item.original_content
            orig_curr = item.current_content
            norm_orig = normalize_json_keys(orig_orig)
            norm_curr = normalize_json_keys(orig_curr)
            if norm_orig != orig_orig or norm_curr != orig_curr:
                item.original_content = norm_orig
                item.current_content = norm_curr
                session.add(item)
                updated += 1
        if updated > 0:
            await session.commit()
    print(f"Normalized {updated} items")


if __name__ == "__main__":
    import sys

    from sqlalchemy import select

    asyncio.run(main())
