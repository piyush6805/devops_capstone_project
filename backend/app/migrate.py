"""Run one release migration after PostgreSQL becomes reachable."""
import logging
import time

from alembic import command
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from .db import engine


def main():
    logging.basicConfig(level=logging.INFO)
    for _ in range(60):
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
        except SQLAlchemyError:
            time.sleep(2)
            continue
        break
    else:
        raise SystemExit("Timed out waiting for PostgreSQL; migration failed")
    command.upgrade(Config("alembic.ini"), "head")
    print("Release migration completed.", flush=True)


if __name__ == "__main__":
    main()
