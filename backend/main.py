import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi import Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from sqlalchemy import text

from config.settings import settings
from database.connection import engine
from database.migrate import run_migrations
from routes.auth import router as auth_router
from routes.chat import router as chat_router
from routes.conversations import router as conversations_router
from routes.conversations import shared_router
from routes.files import router as files_router
from routes.usage import router as usage_router


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)

logger = logging.getLogger("nova")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    run_migrations()
    logger.info("Nova backend ready (%s)", settings.APP_ENV)
    yield


app = FastAPI(title=settings.APP_NAME, version=settings.API_VERSION, lifespan=lifespan)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_error(request: Request, _error: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Something went wrong on Nova's side. Please try again."},
    )


@app.get("/")
def root():
    return {"message": "Nova AI Backend is running", "version": settings.API_VERSION}


@app.get("/health")
def health():
    # Reports the database type and reachability only, never the URL or credentials.
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        database = "ok"
    except Exception:
        logger.exception("Database health check failed")
        database = "unreachable"

    return {
        "status": "healthy" if database == "ok" else "degraded",
        "service": "nova-backend",
        "database": engine.dialect.name,
        "databaseStatus": database,
        "persistent": engine.dialect.name != "sqlite" or not settings.IS_HOSTED,
    }


app.include_router(auth_router)
app.include_router(chat_router)
app.include_router(conversations_router)
app.include_router(shared_router)
app.include_router(files_router)
app.include_router(usage_router)
