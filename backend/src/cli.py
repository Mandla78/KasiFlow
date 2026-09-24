"""
`flask` commands for work that has no screen yet.

    flask seed    load demo data (grows feature by feature; every seeded
                  record goes through the real services, never raw SQL)
"""
from __future__ import annotations

import click
from flask import Flask


def register_cli(app: Flask) -> None:
    @app.cli.command("seed")
    def seed() -> None:
        """Load demo data. Safe to run twice."""
        click.echo("Nothing to seed yet: seed data is added as each feature is built.")
