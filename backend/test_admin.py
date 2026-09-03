import asyncio
from database import AsyncSessionLocal
from models import User, Class, Enrollment, Quiz
from sqlalchemy import select, func

async def test():
    async with AsyncSessionLocal() as db:
        try:
            teacher_count = await db.execute(
                select(func.count()).select_from(User).where(User.role == "teacher")
            )
            print("Teacher count:", teacher_count.scalar_one())
            
            # This is how classes.py did it without select_from:
            count_result = await db.execute(
                select(func.count()).select_from(Quiz).where(Quiz.teacher_id == 1)
            )
            print("Quiz Count with select_from:", count_result.scalar_one())
        except Exception as e:
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test())
