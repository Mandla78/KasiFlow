"""
`flask` commands for work that has no screen yet.

    flask seed                     load demo data (grows feature by feature;
                                   every seeded record goes through the real
                                   services, never raw SQL)
    flask suppliers load [FOLDER]  load supplier feeds (supplier.json +
                                   products.csv per sub-folder) through the
                                   same checks a supplier's own system gets.
                                   Default: seed/suppliers. Development only.
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
