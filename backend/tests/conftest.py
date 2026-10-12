import os

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

test_url = os.environ.get("TEST_DATABASE_URL")
if not test_url or not make_url(test_url).database.endswith("_test") or make_url(test_url).get_backend_name() != "postgresql":
    raise RuntimeError("Set TEST_DATABASE_URL to a dedicated PostgreSQL database ending in _test; production DBs are refused")
os.environ["DATABASE_URL"] = test_url

from app.main import app  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def migrated_database():
    command.upgrade(Config("alembic.ini"), "head")
    yield


@pytest.fixture(autouse=True)
def clean_database(migrated_database):
    engine = create_engine(test_url)
    with engine.begin() as connection:
        connection.execute(text("TRUNCATE movements, products RESTART IDENTITY CASCADE"))
    engine.dispose()


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def product(client):
    return client.post("/api/products", json={"sku": "test-001", "name": "Test Hub", "category": "Electronics", "unit_price": "100.50", "reorder_level": 5}).json()
