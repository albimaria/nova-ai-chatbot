from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config.settings import settings

from database.connection import Base
from database.connection import engine

from database import models

from routes.chat import router as chat_router

from routes.conversations import (
    router as conversations_router,
)

from routes.files import (
    router as files_router,
)

from routes.auth import (
    router as auth_router,
)


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.API_VERSION,
)


Base.metadata.create_all(
    bind=engine
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://albimaria.github.io",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {
        "message": "Nova AI Backend is running",
        "version": settings.API_VERSION,
    }


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "nova-backend",
    }


app.include_router(chat_router)

app.include_router(
    conversations_router
)

app.include_router(
    files_router
)

app.include_router(
    auth_router
)