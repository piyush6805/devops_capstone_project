"""Bounded schema gate used before starting Kubernetes backend replicas."""
import time
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from .db import engine


def main():
    expected = ScriptDirectory.from_config(Config("alembic.ini")).get_current_head()
    for _ in range(120):
        try:
            with engine.connect() as connection:
                if connection.scalar(text("SELECT version_num FROM alembic_version")) == expected:
                    return
        except SQLAlchemyError:
            pass
        time.sleep(2)
    raise SystemExit("Timed out waiting for migration Job; inspect its logs")


if __name__ == "__main__":
    main()
