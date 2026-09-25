===========================================================================
SUPPLIER 00 -- READ ME FIRST
The supplier side of Akayza, end to end: what, in what order, and why.
Written Friday 25 September 2026. Branch: mandla/supplier.
===========================================================================

THE ONE-LINE IDEA

  A spaza shop or builder finds the right suppliers near them, orders
  stock, pays in the app (or in cash that BOTH sides confirm), and gets a
  proper invoice and receipt -- and every one of those moments lands on
  the trader's two-sided record. Suppliers don't sign up to an app: their
  own systems (ERP) connect to our API.


FILES IN THIS FOLDER

  00_READ_ME_FIRST.txt          this file: scope, order, reasons
  01_END_TO_END_FLOW.txt        the whole journey, trader and supplier
  02_FRONTEND_PLAN.txt          screens and feature folders (mock first)
  03_DATASET_PLAN.txt           synthetic suppliers + products (CSV/JSON),
                                images 1-7 per product, logos
  04_BACKEND_PLAN.txt           domains, tables, APIs, the supplier
                                recommendation engine
  05_ERP_INTEGRATION.txt        how supplier systems connect (research +
                                our design): keys, scopes, bulk import,
                                webhooks, sandbox
  06_SECURITY_BY_DESIGN.txt     threats and controls for this side
  07_PAYMENTS_AND_PAYOUTS.txt   PayFast checkout, ITN checks, how money
                                reaches suppliers, the cash path
  08_ORDER_EMAILS_AND_DOCUMENTS.txt  order emails, PDF invoice/receipt,
                                VAT invoice rules
  09_BUILD_ORDER_AND_TIMELINE.txt    phases to Sunday 09:00 and what's cut
  10_RESEARCH_NOTES.txt         sources, and what is still to verify
  11_QA_DEFENCE.txt             the questions judges will ask, and answers
  12_POLICIES.txt               ordering, payment and cash rules (draft Terms)


WHERE WE START, AND WHY

  1. FRONTEND FIRST, ON MOCK DATA SHAPED LIKE THE REAL API.
     Why: the screens decide what the API must return. Mandla reviews the
     whole flow on the phone before a single table exists, so the backend
     is built once, to a reviewed shape. Each feature in its own folder,
     so a bug is found by folder (02).

  2. THE DATASET NEXT (small for the mock, hundreds for the backend).
     Why: realistic suppliers and products are what make the demo, the
     recommendation engine and the import all believable; the same files
     feed the mock, the loader and the ERP-import tests (03).

  3. BACKEND: CATALOGUE + INTEGRATION BEFORE ORDERS.
     Why: orders are only as trustworthy as the prices and stock behind
     them. The integration (keys, scopes, bulk import) is our strongest
     Q&A point -- "we integrate with the systems suppliers already run"
     -- so it's built properly, not faked (04, 05).

  4. ORDERS, THEN EMAILS AND DOCUMENTS, THEN PAYFAST, THEN CASH.
     Why: an order must exist (server-priced, stock held) before it can
     be paid; PayFast is well understood and slots in once orders exist
     (07); the cash handshake is the showcase and builds on everything.


NON-NEGOTIABLES (from our earlier decisions)

  - Suppliers are DATA from integration, not app users (no supplier app).
  - The server re-prices every order; the phone's prices are never trusted.
  - We never hold money: payment goes through PayFast; cash is confirmed
    by both sides.
  - One order = one supplier (also what PayFast Split Payments needs).
  - Security by design everywhere: IDOR, rate limits, strict schemas,
    audit, no secrets in logs, TruConnect as a reference only.
