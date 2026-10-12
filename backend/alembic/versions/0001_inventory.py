"""Create inventory products and immutable movement ledger."""
from alembic import op
import sqlalchemy as sa

revision = "0001_inventory"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("products",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("sku", sa.String(40), nullable=False, unique=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("category", sa.String(80), nullable=False),
        sa.Column("unit_price", sa.Numeric(12, 2), nullable=False),
        sa.Column("reorder_level", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("archived_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint("quantity >= 0", name="product_quantity_nonnegative"),
        sa.CheckConstraint("unit_price >= 0", name="product_price_nonnegative"),
        sa.CheckConstraint("reorder_level >= 0", name="product_reorder_nonnegative"))
    op.create_table("movements",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("delta", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("reason", sa.String(240), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("delta <> 0", name="movement_nonzero"),
        sa.CheckConstraint("kind IN ('RECEIPT', 'ISSUE', 'ADJUSTMENT')", name="movement_kind"),
        sa.CheckConstraint("(kind <> 'RECEIPT' OR delta > 0) AND (kind <> 'ISSUE' OR delta < 0)", name="movement_direction"))
    op.create_index("ix_movements_product_id", "movements", ["product_id"])


def downgrade():
    op.drop_table("movements")
    op.drop_table("products")
