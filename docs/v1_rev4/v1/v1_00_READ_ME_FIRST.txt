===========================================================================
V1_00 -- READ ME FIRST
AKAYZA · GKHack26 working plan, version 1 (revision 4)
===========================================================================

Mandla Baloyi & Risuna Mahani
Kasi and Street Economy track · "Build for Use: Igniting Capabilities
for Markets" · 25-27 September 2026 · VIRTUAL

Revision 3, Tuesday 22 September 2026. This replaces revisions 1
(spaza witness, "Fakazi") and 2 (builders only). Neither name nor
framing survives. What survives is the engineering: the hash chain,
the connectionless Bluetooth design and the demo setup.

Revision 4, Tuesday 22 September 2026: Risuna's review of revision 3.
Same product, same shape, same tools. It closes protocol gaps before
Thursday's freeze, makes the reputation computable, and tightens what
we claim. Every change is listed under WHAT CHANGED IN REVISION 4.
Nothing outside that list moved.

---------------------------------------------------------------------------
AKAYZA IN ONE LINE
---------------------------------------------------------------------------

    Akayza is the business app for every kind of kasi hustle -- the
    spaza, the builder, the student selling fragrances -- connected to
    the suppliers they already buy from, with every cash handover
    confirmed by both phones.

---------------------------------------------------------------------------
THE SHAPE, AGREED 22 SEPTEMBER
---------------------------------------------------------------------------

  1. THE USERS ARE INFORMAL BUSINESSES, OF EVERY TYPE.
     Spaza and tuck shops, street and food vendors, builders and
     tradespeople (plumbers, electricians, tilers), resellers and
     side hustles (a student selling fragrances), salons. The informal
     economy is not one business, and Akayza is built for that: you
     pick your type, and the app arranges its tools around how that
     type actually works (V1_03, section 2).

  2. THEIR SUPPLIERS ARE ON THE APP TOO, AND THEY ARE THE CUSTOMERS.
     Spaza wholesalers and cash-and-carries, hardware and building
     supply stores, distributors. Informal businesses use Akayza free,
     always. Suppliers pay, because Akayza puts their existing
     customers' orders, payments and reorders in one place (V1_11,
     slide 6).

  3. THE TOOLS: Order Book, Loan Book, ordering stock from suppliers,
     the Market (the feed), and a Proof record the business owns and
     can share.

  4. BLUETOOTH IS ONE STRONG FEATURE, NOT THE PRODUCT.
     CASH HANDSHAKE: when cash changes hands between two Akayza users
     (a spaza paying its wholesaler on delivery, a homeowner paying a
     builder's deposit), both phones confirm the amount on the spot,
     offline, over Bluetooth. A mismatch becomes a dispute while both
     people are still standing there. It isn't bank-grade proof. It is
     far better than nothing, which is what cash leaves today.

  5. AKAYZA IS ITS OWN PRODUCT.
     New name, new repository, new code written this weekend. It reuses
     a small set of infrastructure LIBRARIES from our earlier work
     (listed in V1_07 and declared on slide one). No product code, no
     screens, no algorithms and no branding cross over. See V1_13 R6
     on why this matters more now than before.

---------------------------------------------------------------------------
WHAT CHANGED IN REVISION 4
---------------------------------------------------------------------------

Each item names the file and section. Search for "rev 4" or the
section to find it.

  V1_01 s7    The handshake claim no longer says "together" or "same
              place". Radio packets can be relayed and a QR code can
              travel as a screenshot, so we claim both parties signed
              the same amount within 60 s of each other.
  V1_04 s4    Server statuses spelled out: PENDING, CONFIRMED_BY_BOTH,
              DISPUTE, SELF_RECORDED. One attestation per commitment.
  V1_04 s5    The payer attestation gains a TRANSPORT byte (radio / QR).
              Canonicalisation made exact: raw bytes for prev_hash and
              salt inside hash inputs, ensure_ascii=False in Python,
              and a vector with a non-ASCII string and a genesis event.
  V1_04 s7    Fixed a contradiction: the payer ADVERTISES the ACK, so a
              phone that can't advertise needs QR in EITHER role.
  V1_04 s8    Random bytes: noble's own RNG may not work on Hermes.
  V1_05 s1    Phantom sales counts counter purchases and skips builders.
              New row: relayed radio / QR screenshots.
  V1_05 s4    The public tunnel reaches the checker page ONLY.
  V1_06 s1-2  Badge is "Confirmed by both", not "in person". Every
              reputation dimension now has a formula.
  V1_06 s5    Nomsa seeded at 599, not ~680, so the live handshake
              visibly tips her into TRUSTED. The seed asserts it.
  V1_07       checker.py as its own process; never hash from a jsonb
              column; contract gains the view log and transport.
  V1_09 s4,8,9  Tunnel points at checker.py; checklist and QR fallback
              line updated.
  V1_10 s2-3  The H12 spine gate accepts the QR handshake. A split
              rebalance is PROPOSED, not applied (V1_13 Q2).
  V1_11 s2    Demo beat 2:35 names the stage change and reason line.
  V1_12       Wednesday spike gains two checks; Thursday's vector gains
              three requirements; the checker decision is made.
  V1_13       R4 updated; R12 added; Q2 proposal; Q4 and Q5 decided;
              Q9 and Q10 added.
  V1_14       Adds the Proof Layer spec to our own documents.

---------------------------------------------------------------------------
THE FILES
---------------------------------------------------------------------------

    V1_00  READ ME FIRST                  this file
    V1_01  THE IDEA                       pitch, why it wins, themes
    V1_02  PROBLEM, USERS AND CUSTOMERS   evidence, types, suppliers
    V1_03  HOW IT WORKS                   tools per business type, flows
    V1_04  CASH HANDSHAKE (BLUETOOTH)     protocol, disputes, limits
    V1_05  SECURITY AND THREATS           threat model, OWASP, POPIA
    V1_06  PROOF AND REPUTATION           the record, the score, sharing
    V1_07  ARCHITECTURE AND STACK         repo, domains, libraries
    V1_08  EXPO DEV SETUP                 new app, dev build, phones
    V1_09  PHONE-PC LINK AND VIRTUAL DEMO adb, scrcpy, OBS, the call
    V1_10  42-HOUR PLAN                   hour by hour, split, cut list
    V1_11  DEMO SCRIPT AND PITCH          6 slides, 5-minute script, Q&A
    V1_12  TASKS BEFORE FRIDAY            Tue-Fri checklist
    V1_13  RISKS AND OPEN QUESTIONS       incl. keeping Akayza separate
    V1_14  SOURCES                        every number, with its source

Short on time? Read 00, 03, 10, 12, then 09 before Friday.

---------------------------------------------------------------------------
DECISIONS STILL OPEN (by Thursday night)
---------------------------------------------------------------------------

    [ ] The two business types the DEMO follows (proposal: spaza + builder,
        V1_11)
    [ ] The Bluetooth library, decided by Wednesday's spike (V1_12)
    [ ] The event contract + hash canonicalisation (V1_04), frozen
    [ ] The split (V1_10, section 2; rebalance proposal in V1_13 Q2)
    [ ] QR handshake weight and the pending timeout (V1_13 Q9, Q10)
    [ ] Whether AI coding assistants are allowed at the event; if so, how
        we use them (V1_13, O7)
    [ ] The IP position document, re-read and updated for Akayza
        (V1_13, R6)
    [ ] Trademark / CIPC / Play Store check on "Akayza" (V1_12)

---------------------------------------------------------------------------
RULES FOR ANYTHING A JUDGE WILL SEE
---------------------------------------------------------------------------

    - The entry is Akayza. The name of our earlier product appears
      nowhere: not in slides, screens, repository names, commit
      messages or the pitch.
    - The feed is called the MARKET. The word "community" is not used as
      a feature name.
    - We never say or imply that prizes are why we are here.
    - Reuse of our own libraries is declared first, on slide one.
    - Every number on a slide is in V1_14's VERIFIED list.
