===========================================================================
PLAN 00 -- READ ME FIRST
Akayza: what we're building this weekend, in short
===========================================================================

Updated 23 September 2026 (evening). Builds on docs/v1_rev4.

THESE FILES ARE HINTS, NOT A SPEC. They exist to remind us what we
decided and why. Real building will change the architecture as we
discover things. When that happens, we change the code AND update the
line here, and we don't defend a doc against what the code taught us.

The screens: docs/design/Akayza_Simplified_App_Screens.pdf (16 pages).
They're the look and the flow, not pixel-perfect targets.


---------------------------------------------------------------------------
THE SHAPE
---------------------------------------------------------------------------

    ONE ANDROID APP, FOR TRADERS. Spaza first; builder second.
    No supplier app, no supplier web portal.

    +----------+-----------+-------------+----------+
    |   Home   |  Account  |  Suppliers  |   More   |
    +----------+-----------+-------------+----------+
    Home       the numbers that matter today + "Your tools" sheet
               (PDF p1, p11)
    Account    the business tools; the trader CHOOSES which ones
               (Credit book, Order stock, Jobs, Daily tally...)
    Suppliers  3-5 suppliers -> tap one -> products in a 3x3 grid ->
               order (PLAN 08)
    More       profile, settings, help, log out

    SUPPLIERS ARE LOADED THROUGH THE BACKEND: name, logo, products,
    photos, which payment methods they accept. They integrate through
    our API; they don't sign up. (Pitch it that way, honestly: "loaded
    through our integration; a supplier portal is roadmap.")

    PAYMENT: each supplier accepts DIGITAL (PayFast), CASH, or BOTH.
    Most take digital. Where both are accepted, the trader chooses at
    checkout. PayFast is the path that earns the credit; cash is the
    showcase of how Akayza handles cash (order pass, driver, Cash
    Handshake) (PLAN 05, 09, 10).

    Orders are accepted through the backend (no supplier screen).


---------------------------------------------------------------------------
EXTERNAL SERVICES (current list; add more as the build needs them)
---------------------------------------------------------------------------

    HAVE      PayFast sandbox (supplier payments) · Cloudinary (photos;
              own key, akayza/ folder) · Mapbox (address search, pins,
              small maps) · ngrok (tunnel for PayFast's notification)
    ADD       Google Sign-In (Android + Web OAuth clients) · an email
              service on a free tier (codes, password reset) · Expo push
              notifications via Firebase (optional: the in-app list works
              without it)
    NO API    WhatsApp (wa.me links / share sheet) · Navigate and
              Directions (open Google Maps / Waze) · record + sign-off
              pages (our own backend) · SMS (removed)


---------------------------------------------------------------------------
PRINCIPLES THAT DON'T CHANGE
---------------------------------------------------------------------------

    - SPAZA FIRST: the spaza and the suppliers it already restocks from.
      Builders and resellers are included; Akayza is not a general
      marketplace.
    - The trader owns their record. Nothing is shared unless they share
      it; they can stop sharing.
    - The server trusts no client claim; every route pins a role.
    - We claim what we can prove: "confirmed by both" means two parties
      stated the same amount, not that we watched the cash.
    - REMEMBER: 22 product categories (was 16 in our earlier work),
      PLAN 04 s4.


---------------------------------------------------------------------------
THE FILES
---------------------------------------------------------------------------

    00  READ ME FIRST                 this file
    01  APP SCREENS AND TABS          the tabs, and each PDF page
    02  AUTH AND ACCOUNTS             traders, seeded drivers, links
    03  SIGN-UP                       trader sign-up; driver sign-in
    04  BUSINESS TYPES + CATEGORIES   types, tools, 22 categories
    05  PAYMENTS                      PayFast, cash, who accepts what
    06  ADDRESSES AND MAPS            delivery address + Navigate
    07  MEDIA AND IMAGES              Cloudinary, product + stage photos
    08  SUPPLIERS AND ORDERING        seeded suppliers, grid, cart
    09  ORDER PASS + CASH HANDSHAKE   the cash path's proof
    10  DRIVER (CASH SHOWCASE)        the driver's one screen

    Demo data: rebuilt during the build (seed scripts through the real
    sealing code). Supplier file format: PLAN 08.


---------------------------------------------------------------------------
BUILD ORDER
---------------------------------------------------------------------------

  CONFIRMED (24 Sep): kick-off Fri 25 Sep 16:00, HARD submission Sun
  09:00 (slides + <90 s video). About 41 h. See docs/hackathon/.
  Extra hours go to polish and rehearsal, not new scope.

  THE SPINE (first, however ugly):
    trader signs up -> Suppliers -> a supplier -> grid -> order ->
    PAY WITH PAYFAST (sandbox) -> backend marks it paid -> the order
    shows PAID DIGITALLY on the trader's record

  THEN, IN ORDER
    1. Home + Credit book (PDF p1-p3)
    2. Cash path: order pass, driver screen, Cash Handshake, mismatch
       screen (p6-p10)
    3. My record + share + revoke (p5)
    4. Builder: Jobs, stage photo, sign-off link, house records
       (p11-p15)

  NEVER CUT
    - trader sign-up; Home; Credit book
    - Suppliers -> grid -> order -> PayFast sandbox payment
    - the cash path shown end to end, with a mismatch
    - My record + share + the tamper demo
    - a backup video

  CUT LIST (drop from the top)
    1. Bluetooth (QR only)
    2. house records import (p15 "Imported" section)
    3. builder flow -> slides of p11-p15
    4. Mapbox search -> typed address + landmark
    5. extra photos per product -> one photo, or the category icon


---------------------------------------------------------------------------
GONE SINCE THE LAST VERSION (and why)
---------------------------------------------------------------------------

    Supplier web portal, supplier sign-up, supplier staff invites,
    CSV import screen, supplier inventory pages      -> time; suppliers
                                                        come in through
                                                        the backend
    Live driver tracking (moving dot)                -> not in the
                                                        screens; roadmap
    Supplier "Discover traders"                      -> no supplier UI
