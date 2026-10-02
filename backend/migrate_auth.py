from sqlalchemy import inspect
from sqlalchemy import text

from database.connection import engine
from database.connection import SessionLocal

from database.models import User


def main():
    print("Starting Nova authentication migration...")

    inspector = inspect(engine)

    conversation_columns = [
        column["name"]
        for column in inspector.get_columns(
            "conversations"
        )
    ]

    if "user_id" not in conversation_columns:
        print(
            "Adding user_id column to conversations..."
        )

        with engine.begin() as connection:
            connection.execute(
                text(
                    """
                    ALTER TABLE conversations
                    ADD COLUMN user_id VARCHAR
                    REFERENCES users(id)
                    """
                )
            )

        print(
            "user_id column added successfully."
        )

    else:
        print(
            "user_id column already exists."
        )

    db = SessionLocal()

    try:
        users = (
            db.query(User)
            .order_by(
                User.created_at.asc()
            )
            .all()
        )

        if not users:
            print(
                "No users found."
            )
            print(
                "Please create an account first."
            )
            return

        first_user = users[0]

        print(
            f"Using account: {first_user.email}"
        )

        result = db.execute(
            text(
                """
                UPDATE conversations
                SET user_id = :user_id
                WHERE user_id IS NULL
                """
            ),
            {
                "user_id": first_user.id
            },
        )

        db.commit()

        print(
            f"Assigned {result.rowcount} "
            f"existing conversation(s) "
            f"to {first_user.email}."
        )

        remaining = db.execute(
            text(
                """
                SELECT COUNT(*)
                FROM conversations
                WHERE user_id IS NULL
                """
            )
        ).scalar()

        print(
            f"Unassigned conversations remaining: "
            f"{remaining}"
        )

        print(
            "Authentication migration completed successfully."
        )

    finally:
        db.close()


if __name__ == "__main__":
    main()