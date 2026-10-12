# API contract

All application routes use `/api`. Swagger is available directly from the backend at `/docs`; browser requests remain on the same origin through Nginx or Ingress.

| Method | Path | Result |
|---|---|---|
| GET | `/api/products?search=&low_stock=false` | Active product list; searches SKU/name/category |
| GET | `/api/products/{id}` | Active product, or 404 |
| POST | `/api/products` | Create zero-stock product; 201 |
| PUT | `/api/products/{id}` | Replace editable product details |
| DELETE | `/api/products/{id}` | Archive, retain ledger; 204 |
| POST | `/api/products/{id}/movements` | Atomically record movement and update quantity; 201 |
| GET | `/api/movements?product_id=1` | Immutable ledger, newest first; includes archived products |
| GET | `/api/dashboard` | Active product count, total units, INR inventory value, low-stock count |
| GET | `/api/version` | Service name and image commit tag |
| GET | `/health` | Process liveness; independent of database |
| GET | `/ready` | Database access; 503 on failure |
| GET | `/metrics` | Prometheus text exposition |

Create/update body:

```json
{"sku":"ELEC-103","name":"Keyboard","category":"Electronics","unit_price":"1299.00","reorder_level":5}
```

SKU is trimmed and uppercased, contains only letters, digits, `_`, or `-`, and remains unique across archived products. Names/categories cannot be blank. Prices are nonnegative decimals with two fractional digits. Quantity is read-only and cannot be included in product writes. PUT requires the full editable representation.

Stock movement body:

```json
{"delta":10,"kind":"RECEIPT","reason":"Received delivery"}
```

`RECEIPT` requires positive delta, `ISSUE` negative delta, and `ADJUSTMENT` any nonzero signed delta. Quantity cannot become negative or exceed the supported PostgreSQL integer range. A row lock serializes stock changes and product archival. Each successful change commits the movement and quantity together. Failed operations leave both unchanged.

Errors use FastAPI's `detail` field: 422 for invalid fields, 404 for missing/archived product, and 409 for duplicate SKU or insufficient stock. Decimal response values are JSON strings to retain exact monetary precision. Low stock includes quantity equal to the reorder level.

Movement writes are not idempotent. The UI disables pending submissions and does not automatically retry mutations; after a network interruption, check the ledger before resubmitting. History stores a product reference and shows its current name/SKU. User identities and authentication are outside this demonstration's scope.
