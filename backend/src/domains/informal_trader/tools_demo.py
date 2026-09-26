"""
`flask tools seed --me EMAIL` -- demo data in one account's business tools
(development only), so the credit book, jobs and the order book show real
numbers on the real API instead of empty screens.

Each tool seeds itself (credit_book/demo.py, jobs/demo.py,
order_book/demo.py) through its own services, so every total, alert and
audit row is what the app would make. The account's tools are switched on
(the credit book, jobs, the order book; the rest are left as they are).
Safe to run twice: a tool that already has its demo data is skipped.

The builder network has its own: `flask builders seed --me EMAIL`.
"""
from __future__ import annotations

import click
from flask import Flask
from flask.cli import AppGroup

from src.domains.identity.accounts.services import account_service
from src.domains.informal_trader.business_profile.services import business_profile_service
from src.domains.informal_trader.credit_book import demo as credit_demo
from src.domains.informal_trader.jobs import demo as jobs_demo
from src.domains.informal_trader.order_book import demo as order_book_demo

TOOLS_ON = ("creditBook", "jobs", "orderBook")


def seed_for(user) -> list[str]:
    profile = business_profile_service.get(user)
    tools = dict(profile.tools or {}) if profile else {}
    if not all(tools.get(t) for t in TOOLS_ON):
        business_profile_service.save(user, {"tools": {**tools, **{t: True for t in TOOLS_ON}}})
    return [credit_demo.seed(user), jobs_demo.seed(user), order_book_demo.seed(user)]


def register(app: Flask) -> None:
    tools = AppGroup("tools", help="Business tools (development tools).")

    @tools.command("seed")
    @click.option("--me", "email", required=True, help="The account that gets the demo data (it must exist).")
    def seed(email: str) -> None:
        """Demo data in EMAIL's credit book, jobs and order book."""
        # Made-up customers and orders: never in a real database.
        if app.config.get("ENV_NAME") not in ("development", "testing"):
            raise click.ClickException("Development only.")
        user = account_service.find_by_email(email.strip().lower())
        if user is None:
            raise click.ClickException(f"No account for {email}. Sign up in the app first.")
        for line in seed_for(user):
            click.echo(f"  {line}")
        click.echo("Done. Open the app: Account shows the tools; Home the numbers.")

    app.cli.add_command(tools)
