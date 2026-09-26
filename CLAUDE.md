# CLAUDE.md

Akayza: a mobile app for small businesses and informal traders (spaza shops, builders and other informal businesses) to run their business and order from their suppliers. It's a GKHack26 entry by team PR: Mandla (lead, reviewer) and Risuna.

**Start with [docs/HANDOFF.txt](docs/HANDOFF.txt).** It covers the current state, the schedule, what's next, sandbox setup and the workflow.

## Rules that always apply

- **Secrets.** Never commit, print or log secrets: `.env` values, OTP codes, reset or sign-off links, tokens, passwords or card data. This applies even in development and tests. Real `.env` files stay on the machine that owns them. The cloud sandbox uses its own made-up test values.
- **Databases.** Use only your own sandbox PostgreSQL. Never connect to Mandla's databases or any production database. Never run `DROP DATABASE`, `DROP SCHEMA`, `dropdb`, `git reset --hard`, `rm -rf` or `push --force` on shared branches.
- **Merging.** Merge into `main` only when Mandla says so, with no conflicts, and after the full backend suite and the app's `tsc` and `jest` pass. Work happens on `mandla/<topic>` branches, and Mandla reviews the PRs.
- **Security by design.**
  - Scope every query to the signed-in user; answer "not yours" with 404 (IDOR).
  - Use strict schemas that refuse unknown fields.
  - The server prices everything.
  - Put rate limits on routes and audit events, with no personal data in the audit.
  - Add hostile-input tests for every new endpoint.
- **No attacker hints in the UI.** Collect only data that can be officially verified.
- **Honest proof.** Only a digital payment verified by the provider is proof. Tool records (credit book, order book, jobs) are the trader's own records, and cash is at most "confirmed by both". Never add the three together.
- **Positioning.** Always name both spaza shops and builders, and never list street vendors. The app is not a marketplace: it recommends suppliers, never products. Suppliers are the paying customers.
- **Submissions.** Nothing sent to organisers or posted on Sonke says "Akayza" before the final submission, and the "Where" is nationwide.
- **Reuse.** TruConnect is a reference only; never copy its files. Declare reused libraries in `REUSE.md`.
- **Architecture.**
  - Domains live in `backend/src/domains/<area>/<feature>`.
  - `shared/` never imports a domain.
  - No feature reads another feature's repositories.
  - Identity is sealed behind `account_service`.
  - `tests/architecture/test_domain_boundaries.py` enforces these rules.
- **Style.** Match the surrounding code: plain comments that explain *why*, and user-facing text written the way a trader speaks.
