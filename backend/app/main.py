from datetime import datetime, timezone

from fastapi import Depends, FastAPI, HTTPException, Query, Response
from prometheus_fastapi_instrumentator import Instrumentator
from sqlalchemy import func, or_, select, text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db
from .models import Movement, Product
from .schemas import DashboardOut, MovementInput, MovementOut, ProductInput, ProductOut

app = FastAPI(title="StockPilot API", version="1.0.0")
Instrumentator(excluded_handlers=["/health", "/ready", "/metrics"]).instrument(app).expose(app)


@app.get("/health")
def health():
    return {"status": "UP"}


@app.get("/ready")
def ready(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        raise HTTPException(503, "Database unavailable") from None
    return {"status": "READY"}


@app.get("/api/version")
def version():
    return {"service": "StockPilot", "commit": settings.app_version}


def active_product(db, product_id, lock=False):
    statement = select(Product).where(Product.id == product_id, Product.archived_at.is_(None))
    if lock:
        statement = statement.with_for_update()
    product = db.scalar(statement)
    if product is None:
        raise HTTPException(404, "Product not found")
    return product


def commit_product(db):
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "SKU already exists, including archived products") from None


@app.get("/api/products", response_model=list[ProductOut])
def products(search: str = "", low_stock: bool = False, db: Session = Depends(get_db)):
    statement = select(Product).where(Product.archived_at.is_(None))
    if search:
        statement = statement.where(or_(Product.name.icontains(search, autoescape=True), Product.sku.icontains(search, autoescape=True), Product.category.icontains(search, autoescape=True)))
    if low_stock:
        statement = statement.where(Product.quantity <= Product.reorder_level)
    return list(db.scalars(statement.order_by(Product.id.desc())))


@app.get("/api/products/{product_id}", response_model=ProductOut)
def product(product_id: int, db: Session = Depends(get_db)):
    return active_product(db, product_id)


@app.post("/api/products", response_model=ProductOut, status_code=201)
def create_product(payload: ProductInput, db: Session = Depends(get_db)):
    product = Product(**payload.model_dump())
    db.add(product)
    commit_product(db)
    db.refresh(product)
    return product


@app.put("/api/products/{product_id}", response_model=ProductOut)
def update_product(product_id: int, payload: ProductInput, db: Session = Depends(get_db)):
    product = active_product(db, product_id, lock=True)
    for key, value in payload.model_dump().items():
        setattr(product, key, value)
    commit_product(db)
    db.refresh(product)
    return product


@app.delete("/api/products/{product_id}", status_code=204)
def archive_product(product_id: int, db: Session = Depends(get_db)):
    product = active_product(db, product_id, lock=True)
    product.archived_at = datetime.now(timezone.utc)
    db.commit()
    return Response(status_code=204)


@app.post("/api/products/{product_id}/movements", response_model=MovementOut, status_code=201)
def move_stock(product_id: int, payload: MovementInput, db: Session = Depends(get_db)):
    product = active_product(db, product_id, lock=True)
    new_quantity = product.quantity + payload.delta
    if new_quantity < 0:
        raise HTTPException(409, "Insufficient stock")
    if new_quantity > 2147483647:
        raise HTTPException(409, "Stock exceeds supported quantity")
    movement = Movement(product_id=product.id, **payload.model_dump())
    product.quantity = new_quantity
    db.add(movement)
    db.commit()
    db.refresh(movement)
    return movement_response(movement, product)


def movement_response(movement, product):
    return {"id": movement.id, "product_id": product.id, "sku": product.sku, "product_name": product.name, "delta": movement.delta, "kind": movement.kind, "reason": movement.reason, "created_at": movement.created_at}


@app.get("/api/movements", response_model=list[MovementOut])
def movements(product_id: int | None = Query(default=None), db: Session = Depends(get_db)):
    statement = select(Movement, Product).join(Product).order_by(Movement.id.desc())
    if product_id is not None:
        statement = statement.where(Movement.product_id == product_id)
    return [movement_response(m, p) for m, p in db.execute(statement)]


@app.get("/api/dashboard", response_model=DashboardOut)
def dashboard(db: Session = Depends(get_db)):
    row = db.execute(select(func.count(Product.id), func.coalesce(func.sum(Product.quantity), 0), func.coalesce(func.sum(Product.quantity * Product.unit_price), 0), func.count(Product.id).filter(Product.quantity <= Product.reorder_level)).where(Product.archived_at.is_(None))).one()
    return DashboardOut(product_count=row[0], total_units=row[1], inventory_value=row[2], low_stock_count=row[3])
