from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.db import get_db
from app.main import app


def move(client, product, delta, kind="RECEIPT"):
    return client.post(f"/api/products/{product['id']}/movements", json={"delta": delta, "kind": kind, "reason": "Test transaction"})


def test_health(client):
    assert client.get("/health").json() == {"status": "UP"}


def test_ready(client):
    assert client.get("/ready").json() == {"status": "READY"}


def test_ready_database_failure(client):
    class BrokenSession:
        def execute(self, _):
            raise OperationalError("SELECT 1", {}, Exception("offline"))
    app.dependency_overrides[get_db] = lambda: BrokenSession()
    try:
        assert client.get("/ready").status_code == 503
        assert client.get("/health").status_code == 200
    finally:
        app.dependency_overrides.clear()


def test_version(client):
    assert client.get("/api/version").json()["service"] == "StockPilot"


def test_metrics(client):
    client.get("/api/products")
    response = client.get("/metrics")
    assert response.status_code == 200
    assert "http_requests_total" in response.text


def test_create_zero_stock_and_normalized_sku(product):
    assert product["sku"] == "TEST-001"
    assert product["quantity"] == 0


def test_list_and_read(client, product):
    assert client.get("/api/products").json()[0]["id"] == product["id"]
    assert client.get(f"/api/products/{product['id']}").json() == product


def test_search(client, product):
    assert len(client.get("/api/products?search=hub").json()) == 1
    assert client.get("/api/products?search=missing").json() == []


def test_duplicate_sku(client, product):
    payload = {key: product[key] for key in ["sku", "name", "category", "unit_price", "reorder_level"]}
    payload["sku"] = payload["sku"].lower()
    assert client.post("/api/products", json=payload).status_code == 409


@pytest.mark.parametrize("field,value", [("name", "  "), ("unit_price", "-1"), ("unit_price", "1.999"), ("sku", "bad sku"), ("reorder_level", -1)])
def test_product_validation(client, field, value):
    payload = {"sku": "NEW-1", "name": "Valid", "category": "Office", "unit_price": "10.00"}
    payload[field] = value
    assert client.post("/api/products", json=payload).status_code == 422


def test_update_details(client, product):
    payload = {key: product[key] for key in ["sku", "name", "category", "unit_price", "reorder_level"]}
    payload["name"] = "Updated Hub"
    assert client.put(f"/api/products/{product['id']}", json=payload).json()["name"] == "Updated Hub"


def test_direct_quantity_update_refused(client, product):
    payload = {key: product[key] for key in ["sku", "name", "category", "unit_price", "reorder_level"]}
    payload["quantity"] = 100
    assert client.put(f"/api/products/{product['id']}", json=payload).status_code == 422


def test_receive_then_issue(client, product):
    assert move(client, product, 10).status_code == 201
    assert move(client, product, -3, "ISSUE").status_code == 201
    assert client.get(f"/api/products/{product['id']}").json()["quantity"] == 7
    assert len(client.get("/api/movements").json()) == 2


def test_insufficient_stock_is_atomic(client, product):
    move(client, product, 2)
    assert move(client, product, -3, "ISSUE").status_code == 409
    assert client.get(f"/api/products/{product['id']}").json()["quantity"] == 2
    assert len(client.get("/api/movements").json()) == 1


@pytest.mark.parametrize("delta,kind", [(0, "ADJUSTMENT"), (-1, "RECEIPT"), (1, "ISSUE"), (1, "INVALID")])
def test_movement_validation(client, product, delta, kind):
    assert move(client, product, delta, kind).status_code == 422


def test_adjustment(client, product):
    move(client, product, 9, "ADJUSTMENT")
    assert move(client, product, -2, "ADJUSTMENT").status_code == 201


def test_archive_preserves_history(client, product):
    move(client, product, 10)
    assert client.delete(f"/api/products/{product['id']}").status_code == 204
    assert client.get("/api/products").json() == []
    assert client.get(f"/api/products/{product['id']}").status_code == 404
    assert move(client, product, 1).status_code == 404
    assert client.get("/api/movements").json()[0]["sku"] == product["sku"]


def test_missing_product(client):
    assert client.get("/api/products/9999").status_code == 404
    assert client.delete("/api/products/9999").status_code == 404


def test_dashboard_and_low_stock(client, product):
    move(client, product, 6)
    assert client.get("/api/products?low_stock=true").json() == []
    assert client.get("/api/dashboard").json() == {"product_count": 1, "total_units": 6, "inventory_value": "603.00", "low_stock_count": 0}
    move(client, product, -1, "ISSUE")
    assert len(client.get("/api/products?low_stock=true").json()) == 1


def test_movement_product_filter(client, product):
    move(client, product, 2)
    assert len(client.get(f"/api/movements?product_id={product['id']}").json()) == 1
    assert client.get("/api/movements?product_id=9999").json() == []


def test_concurrent_withdrawals_cannot_oversell(client, product):
    move(client, product, 5)
    barrier = Barrier(2)

    def withdraw():
        with TestClient(app) as separate_client:
            barrier.wait(timeout=10)
            return move(separate_client, product, -4, "ISSUE").status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: withdraw(), range(2)))
    assert sorted(results) == [201, 409]
    assert client.get(f"/api/products/{product['id']}").json()["quantity"] == 1
    assert len(client.get("/api/movements").json()) == 2
