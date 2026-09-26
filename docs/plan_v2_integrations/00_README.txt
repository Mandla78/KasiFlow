===========================================================================
PLAN V2 -- INTEGRATIONS: Home, Account and My record on REAL data
Mandla + Claude (cloud session). Saturday 26 September 2026.
===========================================================================

WHY
  Home and Account still show "sample" numbers (what you owe suppliers,
  cash in today, stock bought, orders this month, My record) and a
  sample delivery card. Judges will tap them. Everything on those two
  screens must come from our own data, be private to the trader, and
  lead somewhere real when tapped.

THE PLANS (do them in this order; each is one small PR)
  01_HOME_NEW_JOB_TO_JOBS.txt      "New job" lives in the Jobs tool only
  02_HOME_BALANCE_CARD.txt         hide/show balances, every number real
                                   and tappable, "You owe suppliers" =
                                   cash orders only, the Today list from
                                   real orders; server summary + limits
  03_ACCOUNT_AND_MY_RECORD.txt     Account = your tools only; the money
                                   records (stock bought, credit given,
                                   paid back) move to a real My record
                                   screen, kept apart by what backs them

HOW WE WORK (same as docs/HANDOFF.txt section 4)
  - Branch per plan from the latest main (the cloud session pushes to its
    own branch; Mandla merges).
  - Claude builds, runs the full backend suite + tsc + jest, reports the
    counts; Mandla tests on the phone and sends feedback.
  - Nothing merges into main until Mandla says so.

RULES THAT BITE HERE (CLAUDE.md)
  - Honest proof: a provider-verified payment, cash "confirmed by both"
    and cash not confirmed are NEVER added into one total. Tool records
    (credit book, order book, jobs) are the trader's own records.
  - Every new endpoint: @auth_required, scoped to current_user() (not
    yours = 404), rate limited, strict schema, hostile-input tests.
  - No sample numbers presented as real. If a number can't be real yet,
    it isn't shown.
