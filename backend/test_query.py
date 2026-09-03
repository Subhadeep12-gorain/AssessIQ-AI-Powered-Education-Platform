import asyncio
from database import async_session_maker
from models import User, Class, Enrollment, Quiz
from sqlalchemy import select, func

async def test():
    async with async_session_maker() as db:
        # Teacher ID 3
        result = await db.execute(select(Class).where(Class.teacher_id == 3, Class.is_deleted == 0))
        classes = result.scalars().all()
        print("Classes found:", len(classes))
        
        output = []
        for c in classes:
            print("Processing class", c.id)
            count_result = await db.execute(
                select(func.count(Quiz.id)).where(Quiz.class_id == c.id)
            )
            count = count_result.scalar_one()
            output.append({
                "id": c.id,
                "assessment_count": count,
                "is_deleted": bool(c.is_deleted)
            })
        print(output)

if __name__ == "__main__":
    asyncio.run(test())
