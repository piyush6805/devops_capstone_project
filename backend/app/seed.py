"""Explicit, repeatable fictional demonstration data; never run at startup."""
from sqlalchemy import select
from .db import SessionLocal
from .models import Movement, Product


def main():
    with SessionLocal() as db:
        for sku, name, category, price, quantity in [
            ("ELEC-101", "USB-C Hub", "Electronics", "1499.00", 24),
            ("ELEC-102", "Wireless Mouse", "Electronics", "799.00", 3),
            ("OFF-201", "A5 Notebook", "Office", "149.00", 48),
            ("OFF-202", "Desk Organizer", "Office", "349.00", 0),
            ("ACC-301", "Laptop Sleeve", "Accessories", "599.00", 12),
        ]:
            if db.scalar(select(Product.id).where(Product.sku == sku)):
                continue
            product = Product(sku=sku, name=name, category=category, unit_price=price, reorder_level=5, quantity=quantity)
            db.add(product)
            db.flush()
            if quantity:
                db.add(Movement(product_id=product.id, delta=quantity, kind="RECEIPT", reason="Fictional opening stock"))
        db.commit()
    print("Fictional seed complete; existing SKUs were preserved.")


if __name__ == "__main__":
    main()
