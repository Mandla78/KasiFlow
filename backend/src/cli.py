"""
`flask` commands for work that has no screen yet.

    flask seed                     load demo data (grows feature by feature;
                                   every seeded record goes through the real
                                   services, never raw SQL)
    flask builders seed [--me EMAIL]  sample builders with client-confirmed
                                   builds (development only; see
                                   builder_network/seed.py)
    flask tools seed --me EMAIL    demo data in that account's credit book,
                                   jobs and order book (development only;
                                   see informal_trader/tools_demo.py)
    flask suppliers load [FOLDER]  load supplier feeds (supplier.json +
                                   products.csv per sub-folder) through the
                                   same checks a supplier's own system gets.
                                   Default: seed/suppliers. Development only.
    flask orders move REF STATUS   play the supplier's side of an order
                                   (accepted, rejected, out_for_delivery,
                                   ready_for_collection, delivered,
                                   collected) until suppliers' own systems
                                   do it through the integration API.
                                   Development only.
"""
from __future__ import annotations

from pathlib import Path

import click
from flask import Flask
from flask.cli import AppGroup

SEED_SUPPLIERS = Path(__file__).resolve().parent.parent / "seed" / "suppliers"


def register_cli(app: Flask) -> None:
    @app.cli.command("seed")
    def seed() -> None:
        """Load demo data. Safe to run twice."""
        click.echo("Nothing to seed yet: seed data is added as each feature is built.")

    suppliers = AppGroup("suppliers", help="Supplier feeds.")

    @suppliers.command("load")
    @click.argument("folder", required=False, type=click.Path(file_okay=False, path_type=Path))
    @click.option("--verified/--not-verified", default=True, help="Mark the suppliers as checked (seed data only).")
    def load(folder: Path | None, verified: bool) -> None:
        """Load every supplier folder under FOLDER. Safe to run twice."""
        # Seed data is fictional: it must never reach a production database.
        if app.config.get("ENV_NAME") not in ("development", "testing"):
            raise click.ClickException("Seed suppliers load only in development.")
        from src.domains.supplier.integration.services.feed_loader import FeedRefused, load_directory

        root = folder or SEED_SUPPLIERS
        folders = sorted(p for p in root.iterdir() if p.is_dir()) if root.is_dir() else []
        if not folders:
            raise click.ClickException(f"No supplier folders in {root}. Run: python seed/generate_dataset.py")
        failed = 0
        for f in folders:
            try:
                r = load_directory(f, source="seed", verified=verified, full=True)
            except FeedRefused as e:
                failed += 1
                click.echo(f"  {f.name}: REFUSED - {e}")
                continue
            new = " (new)" if r.created_supplier else ""
            click.echo(
                f"  {r.supplier}{new}: {r.rows} rows, {r.created} created, {r.updated} updated, "
                f"{r.unchanged} unchanged, {r.deactivated} switched off, {r.failed} failed"
            )
            for e in r.errors[:5]:
                click.echo(f"      row {e['row']} {e['field']}: {e['reason']}")
        if failed:
            raise click.ClickException(f"{failed} supplier feed(s) refused.")

    app.cli.add_command(suppliers)

    orders = AppGroup("orders", help="Orders (development tools).")

    @orders.command("move")
    @click.argument("reference")
    @click.argument("status")
    def move(reference: str, status: str) -> None:
        """Move order REFERENCE (e.g. AKZ-2026-000101) to STATUS as the supplier would."""
        if app.config.get("ENV_NAME") not in ("development", "testing"):
            raise click.ClickException("Only in development: suppliers move real orders from their own systems.")
        from src.core.exceptions import AppError
        from src.domains.commerce.orders.repositories import order_repository
        from src.domains.commerce.orders.services import order_service

        order = order_repository.by_reference(reference.strip().upper())
        if order is None:
            raise click.ClickException(f"No order {reference}.")
        try:
            order_service.supplier_move(order.id, status)
        except AppError as e:
            raise click.ClickException(e.message) from None
        click.echo(f"  {order.reference}: now {status.replace('_', ' ')}")

    app.cli.add_command(orders)

    from src.domains.informal_trader.builder_network.seed import register as register_builders

    register_builders(app)

    from src.domains.informal_trader.tools_demo import register as register_tools

    register_tools(app)
