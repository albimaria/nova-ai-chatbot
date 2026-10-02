import os

from dotenv import load_dotenv


load_dotenv()


class Settings:
    APP_NAME = os.getenv(
        "APP_NAME",
        "Nova AI Backend"
    )

    APP_ENV = os.getenv(
        "APP_ENV",
        "development"
    )

    API_VERSION = os.getenv(
        "API_VERSION",
        "v1"
    )

    GEMINI_API_KEY = os.getenv(
        "GEMINI_API_KEY"
    )


settings = Settings()