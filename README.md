<p align="center">
  <img src="frontend/mobile/assets/images/icon.png" alt="Akayza" width="96" />
</p>

<h1 align="center">Akayza</h1>

<p align="center"><em>Keep it in the kasi.</em></p>

<p align="center">
  One free app that runs an informal business, connects it to the suppliers it already buys from,<br/>
  and builds a record the owner holds: the first step to finance tomorrow.
</p>

<p align="center">
  <a href="docs/submission/05_final_submission/Akayza_Demo_TeamPR.mp4"><b>▶ Watch the 81-second demo</b></a> ·
  <a href="docs/SETUP.md">Run it yourself</a> ·
  <a href="#security-and-privacy">Security and privacy</a>
</p>

<p align="center"><sub>Team PR · GKHack26 (Geekulcha Annual Hackathon 2026) · South Africa</sub></p>

---

## The problem

About **R900 billion** a year moves through South Africa's township economy, roughly 12% of GDP. It feeds families and creates one in five jobs. And it's almost invisible.

- **Fewer than 9%** of these businesses can get a bank loan; **57%** run on savings and family.
- **About 80%** are unregistered, so every order is cash and every dispute is word against word.
- Of the **R500 million** Spaza Shop Support Fund, **R179.6 million** had reached shops by May 2026: 354 applications failed verification.

The owners trade every day, but nothing they do becomes a record anyone can trust. Business tools were built for the formal few: a registered company, a bookkeeper, card machines. Informal businesses run on cash, credit on trust, a phone, and the same few suppliers for years.

<sub>Sources: Standard Bank, Township Informal Economy Report (Oct 2025); DSBD, Spaza Shop Support Fund update (May 2026).</sub>

## What Akayza does

Akayza works the way informal businesses already work, for **spaza shops, builders and other small and informal businesses**.

| Today | This week | Tomorrow |
|---|---|---|
| **Run it with less stress.** A credit book, an order book for counter sales, and jobs in stages for builders. | **Buy better, pay safely.** Order from your own suppliers, matched to what you really buy. Pay digitally or cash, and get a proper invoice. | **Be ready to grow.** A sealed trading history you own and choose to share: the first step to finance and registration. |

**Who pays:** businesses use Akayza **free, always**. **Suppliers** are the paying customers: a monthly subscription, plus a small commission on digital orders. Akayza is **not a marketplace**: it recommends suppliers, never products, and it never holds stock or money.

**Honest proof:** only a digital payment verified by the payment provider counts as proof. Cash and what an owner writes in the tools is their own record, and the two are never added together.

## What's built

Everything below works end to end against our real backend, with payments in PayFast's sandbox.

**For the business owner**
- Sign-up in under a minute, with a location pin and the tools the business needs
- **Credit book:** who owes you, repayments, and a history, with customers' names kept private
- **Order book:** counter orders and today's takings, which keep working **offline**
- **Jobs (builders):** stages, camera-only photos fingerprinted on the server, and the client signs each stage off from a one-time link
- **Suppliers:** a rule-based engine ranks suppliers that deliver to you, by distance, what you buy and how you pay, and always shows the reason
- **Ordering and payment:** a cart, delivery or collection, saved delivery addresses, and a PayFast payment confirmed by four server-side checks
- **Invoices and receipts** as PDFs, with a QR code to a public check page
- **My record:** the month's money, kept apart by what backs it
- **Sealed records:** the owner can seal the whole record with **Ed25519 + ML-DSA-65 (NIST FIPS 204, post-quantum)**; a later check shows anything changed or deleted
- In-app notifications, and the balances hidden by default

**For suppliers**
- A catalogue feed checked row by row (11 sample suppliers, 1,672 products), orders with a human reference, and connections to the businesses they serve

## How it works

```
 Mobile app (React Native + Expo)      ── HTTPS ──▶  API (Python + Flask)  ──▶  PostgreSQL 16
 Android first, secure storage,                       one module per area:       one schema per area,
 offline queue for orders and credit                  identity · business tools   versioned migrations,
                                                      suppliers · commerce ·      append-only audit trail
                                                      proof · platform
                                                            │
                                   PayFast (payments) · Cloudinary (photos) · Mapbox (addresses) · email
```

- **The server prices everything.** The phone only says which products and how many.
- **Each area is its own module.** An automated architecture test fails the build if one area reads another's data, and identity is sealed behind one account service.
- **A retried order lands once** (idempotency keys), and the last item in stock can't be sold twice.

## Security and privacy

- **Only the owner sees their data.** Every query is scoped to the signed-in user, and anyone else's record answers "not found".
- **Sign-in:** bcrypt passwords, a one-time email code on a new phone, rotating refresh tokens (reuse ends the session), lockout, and no way to find out which emails have accounts.
- **Payments:** card numbers never touch our servers. An order is paid only after PayFast's notification passes four checks: signature, sender, amount and a validate-back call.
- **Strict input:** every request schema refuses unknown fields; every route has a rate limit; hostile-input tests cover every endpoint.
- **POPIA by design:** we collect only what a feature needs or what can be officially checked, record consent, keep no personal data in logs or audits, and never sell data. Suppliers never see an owner's customers.
- **Honest limits:** we say what's built and what isn't. The full write-up, including the OWASP API Top 10 mapping and the incident plan, is in [`docs/submission/03_ssdlc/`](docs/submission/03_ssdlc/).

## Tested

**1,281 backend tests** and **214 app tests** run on every change, including access-control (IDOR), hostile-input, rate-limit and architecture-boundary tests. CI also runs a dependency audit and a secret scan.

```powershell
cd backend;  python -m pytest -q tests
cd frontend/mobile;  npx tsc --noEmit;  npx jest
```

## Status

**TRL 4:** every flow works end to end in our own environment, with payments in PayFast's sandbox. Next, a 6-month pilot with 2 suppliers and 50-100 businesses.

**Next:** Google sign-in in the app, phone push alerts, two-phone cash confirmation, direct links to suppliers' stock systems, and sharing a record with a lender, by consent.

## Run it yourself

The full guide (database, backend, mobile app, troubleshooting) is in **[docs/SETUP.md](docs/SETUP.md)**.

```
backend/           Flask + PostgreSQL API (domains → features, migrations, tests)
frontend/mobile/   Expo / React Native app
docs/              setup, design, plans and hackathon submission
```

## Team PR

- **Mandla** ([@Mandla78](https://github.com/Mandla78)): team lead; product, backend, payments and the supplier engine
- **Risuna** ([@RinsunaMahani](https://github.com/RinsunaMahani)): business tools (credit book, order book, jobs), notifications, sealed records

## Credits and licence

Reused code, libraries, photos and music are credited in **[REUSE.md](REUSE.md)**. Demo music: "Carefree" by Kevin MacLeod (incompetech.com), licensed under CC BY 4.0.

© 2026 Team PR. **All rights reserved**: the source is public to read, but not licensed for reuse. See [LICENSE](LICENSE).
