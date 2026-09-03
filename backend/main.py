"""
main.py — FastAPI application entry point

This is where:
  1. All routers are mounted (auth, classes, documents, quizzes, submissions, admin, parent)
  2. CORS is configured (allows the React frontend at localhost:5173 to call this backend)
  3. The database tables are created on startup
  4. The app is started with: uvicorn main:app --reload
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from database import create_all_tables
from routers import auth, classes, documents, quizzes, submissions, admin, parent


# ─────────────────────────────────────────────
# STARTUP / SHUTDOWN LIFECYCLE
# ─────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Called once when the server starts.
    Creates all database tables (safe — won't overwrite existing data).
    """
    print("[START] AssessIQ Backend starting...")
    await create_all_tables()
    print("[OK] Database tables ready")
    yield
    print("[STOP] Server shutting down")


# ─────────────────────────────────────────────
# CREATE THE APP
# ─────────────────────────────────────────────

app = FastAPI(
    title       = "AssessIQ API",
    description = "AI-powered assessment platform backend",
    version     = "1.0.0",
    lifespan    = lifespan,
)


# ─────────────────────────────────────────────
# CORS — Very important for React frontend
# Without this, the browser blocks ALL requests from localhost:5173 → localhost:8000
# ─────────────────────────────────────────────

import os

# Dynamic CORS origins (supports localhost, vercel deployments, and custom env)
custom_origins = [orig.strip() for orig in os.getenv("CORS_ORIGINS", "").split(",") if orig.strip()]
allowed_origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    "https://assessiq.vercel.app",
] + custom_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins     = allowed_origins,
    allow_origin_regex= r"https://.*\.vercel\.app",
    allow_credentials = True,
    allow_methods     = ["*"],     # GET, POST, PUT, PATCH, DELETE, OPTIONS
    allow_headers     = ["*"],     # Authorization, Content-Type, etc.
)


# ─────────────────────────────────────────────
# REGISTER ALL ROUTERS
# Each router handles a group of related endpoints
# ─────────────────────────────────────────────

app.include_router(auth.router)
app.include_router(classes.router)
app.include_router(documents.router)
app.include_router(quizzes.router)
app.include_router(submissions.router)
app.include_router(admin.router)
app.include_router(parent.router)


# ─────────────────────────────────────────────
# ROOT HEALTH CHECK
# Visit http://localhost:8000 to confirm server is running
# ─────────────────────────────────────────────

@app.get("/")
async def health_check():
    return {
        "status":  "ok",
        "message": "AssessIQ API is running",
        "docs":    "Visit /docs for interactive API documentation",
    }
