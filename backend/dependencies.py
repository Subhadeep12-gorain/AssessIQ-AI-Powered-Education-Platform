"""
dependencies.py — Reusable FastAPI dependency functions

These are injected into routes using `Depends(...)`.
Writing them once here means every route reuses the same logic
instead of copy-pasting DB/auth code.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import JWTError, jwt
from dotenv import load_dotenv
import os

from database import AsyncSessionLocal
from models import User

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "fallback_secret")
ALGORITHM  = os.getenv("ALGORITHM", "HS256")

# This tells FastAPI where to look for the Bearer token in the request header
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


# ─────────────────────────────────────────────
# DB SESSION DEPENDENCY
# Every route that needs DB access uses:
#   db: AsyncSession = Depends(get_db)
# ─────────────────────────────────────────────
async def get_db():
    """
    Creates a DB session, yields it to the route,
    then closes it automatically when the request is done.
    This is the 'async with' pattern — no manual closing needed.
    """
    async with AsyncSessionLocal() as session:
        yield session


# ─────────────────────────────────────────────
# AUTH DEPENDENCY
# Every protected route uses:
#   current_user: User = Depends(get_current_user)
# ─────────────────────────────────────────────
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    1. Extracts Bearer token from Authorization header
    2. Decodes the JWT to get the user's ID
    3. Fetches the user from the DB
    4. Checks if the user is suspended
    Returns the User object if everything passes.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        # Decode the JWT — this verifies the signature automatically
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # Fetch user from DB
    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception

    # Check suspension — this is how real-time suspension works
    if user.status == "suspended":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account suspended. Contact your administrator.",
            headers={"X-Error-Code": "account_suspended"},
        )

    return user


# ─────────────────────────────────────────────
# ROLE-SPECIFIC DEPENDENCIES
# Use these in routes that need a specific role:
#   teacher: User = Depends(require_teacher)
# ─────────────────────────────────────────────
async def require_teacher(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Teacher access required.")
    return current_user


async def require_student(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Student access required.")
    return current_user


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required.")
    return current_user


async def require_parent(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "parent":
        raise HTTPException(status_code=403, detail="Parent access required.")
    return current_user
