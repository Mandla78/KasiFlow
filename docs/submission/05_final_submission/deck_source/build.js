// Akayza pitch deck -- Team PR, GKHack26 (Sun 27 Sep 2026)
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const Fi = require("react-icons/fi");

const OUT = process.argv[2] || "Akayza_Pitch_TeamPR.pptx";

// Palette: deep kasi-night navy, cyan signal, marigold (the app's own accent) for money.
const C = {
  bg: "0D1B2A", panel: "132A40", panel2: "183452", cyan: "22C3E6", marigold: "F2A93B",
  jade: "34D399", white: "F4F7FB", muted: "9FB3C8", faint: "5E7891", coral: "F87171",
};
const TITLE = "Georgia", BODY = "Calibri";

async function icon(Comp, color, px = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Comp, { color: "#" + color, size: px }));
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

(async () => {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
  pres.title = "Akayza - Team PR";
  pres.author = "Team PR";

  const W = 13.333;
  const base = (s) => { s.background = { color: C.bg }; };
  const title = (s, t, sub) => {
    s.addText(t, { x: 0.6, y: 0.45, w: W - 1.2, h: 0.9, fontFace: TITLE, fontSize: 36, bold: true, color: C.white, margin: 0, isTextBox: true });
    if (sub) s.addText(sub, { x: 0.6, y: 1.3, w: W - 1.2, h: 0.5, fontFace: BODY, fontSize: 16, italic: true, color: C.cyan, margin: 0, isTextBox: true });
  };
  const foot = (s, n, src) => {
    if (src) s.addText(src, { x: 0.6, y: 6.95, w: 10.5, h: 0.35, fontFace: BODY, fontSize: 9.5, color: C.faint, margin: 0, isTextBox: true });
    s.addText(`Akayza · Team PR  ${n}`, { x: W - 3.1, y: 6.95, w: 2.5, h: 0.35, fontFace: BODY, fontSize: 9.5, color: C.faint, align: "right", margin: 0, isTextBox: true });
  };
  // Motif: an icon in a cyan-ringed circle.
  const disc = async (s, Comp, x, y, d = 0.7, color = C.cyan) => {
    s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: C.panel2 }, line: { color, width: 1.5 } });
    s.addImage({ data: await icon(Comp, color), x: x + d * 0.24, y: y + d * 0.24, w: d * 0.52, h: d * 0.52 });
  };
  const card = (s, x, y, w, h, fill = C.panel) =>
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: fill }, line: { color: fill }, rectRadius: 0.12 });
  const text = (s, t, o) => s.addText(t, { fontFace: BODY, color: C.white, margin: 0, isTextBox: true, valign: "top", ...o });

  // ------------------------------------------------------------ 1. Title
  {
    const s = pres.addSlide(); base(s);
    s.addText("Akayza", { x: 0.8, y: 1.55, w: 8, h: 1.4, fontFace: TITLE, fontSize: 80, bold: true, color: C.white, margin: 0, isTextBox: true });
    s.addText("Keep it in the kasi.", { x: 0.8, y: 2.95, w: 8, h: 0.8, fontFace: TITLE, fontSize: 32, italic: true, color: C.cyan, margin: 0, isTextBox: true });
    text(s, "One free app for South Africa's informal businesses: run the business, and order stock from the suppliers you already trust.",
      { x: 0.8, y: 3.95, w: 7.2, h: 1.0, fontSize: 18, color: C.muted });
    text(s, "Prepared by Team PR  ·  GKHack26  ·  27 September 2026", { x: 0.8, y: 5.6, w: 8, h: 0.4, fontSize: 14, color: C.faint });
    await disc(s, Fi.FiShoppingBag, 9.6, 1.7, 1.5);
    await disc(s, Fi.FiTool, 11.2, 2.9, 1.3, C.marigold);
    await disc(s, Fi.FiTruck, 9.7, 3.9, 1.2, C.jade);
    s.addNotes("OPEN (10 s). 'Good morning. We are Team PR, and this is Akayza. Keep it in the kasi.' Pause. Then straight to the problem.");
  }

  // ------------------------------------------------------------ 2. The problem, in one line
  {
    const s = pres.addSlide(); base(s);
    title(s, "Run on cash, WhatsApp and a notebook");
    text(s, "Spaza shops, builders, food sellers: real businesses, with no record anyone can trust.", { x: 0.6, y: 1.35, w: 12, h: 0.5, fontSize: 18, italic: true, color: C.cyan });
    const pains = [
      [Fi.FiDollarSign, "No record of cash", "The driver takes cash for the stock. When it doesn't add up, it's her word against his."],
      [Fi.FiBook, "Credit in memory", "Customers buy on the book. Who owes what is in a notebook, or in her head."],
      [Fi.FiMessageCircle, "Orders by WhatsApp", "Stock is ordered by voice note. No prices, no invoice, no proof it was paid."],
    ];
    for (let i = 0; i < 3; i++) {
      const x = 0.6 + i * 4.1;
      card(s, x, 2.35, 3.8, 3.6);
      await disc(s, pains[i][0], x + 0.35, 2.65, 0.85, i === 0 ? C.marigold : C.cyan);
      text(s, pains[i][1], { x: x + 0.35, y: 3.65, w: 3.2, h: 0.5, fontSize: 19, bold: true });
      text(s, pains[i][2], { x: x + 0.35, y: 4.3, w: 3.1, h: 1.5, fontSize: 15, color: C.muted });
    }
    text(s, "So the owner can't prove the business is real: not to a supplier, not to a bank, not to a support fund.",
      { x: 0.6, y: 6.2, w: 12, h: 0.5, fontSize: 16, bold: true, color: C.marigold });
    foot(s, 2);
    s.addNotes("PROBLEM (30 s). Say it like a person, not a report. 'Think of a spaza owner. She restocks every week, pays the driver cash, and keeps who-owes-me in a notebook. A builder next door gets paid by his client in stages, in cash. None of it leaves a record both sides agree on. So when the cash doesn't add up, it's word against word. And when she applies for help, she can't prove her shop is real.' These are informal businesses: spaza shops, builders and trades, food sellers.");
  }

  // ------------------------------------------------------------ 3. The numbers
  {
    const s = pres.addSlide(); base(s);
    title(s, "R900 billion that can't prove itself");
    const stats = [["R900 bn", "township economy a year"], ["R150 bn", "spent in cash at ~150,000 spaza shops"], ["354", "Spaza Support Fund applications failed verification"]];
    for (let i = 0; i < 3; i++) {
      const y = 1.6 + i * 1.65;
      text(s, stats[i][0], { x: 0.6, y, w: 4.6, h: 0.95, fontFace: TITLE, fontSize: 46, bold: true, color: i === 2 ? C.marigold : C.cyan });
      text(s, stats[i][1], { x: 0.6, y: y + 0.9, w: 4.8, h: 0.5, fontSize: 15, color: C.muted });
    }
    card(s, 5.8, 1.55, 6.95, 5.1);
    s.addChart(pres.charts.BAR, [{ name: "Township businesses", labels: ["Unregistered", "Self-funded (savings, family)", "Prefer EFT or bank transfer", "Can get a bank loan"], values: [80, 57, 56, 9] }], {
      x: 6.0, y: 1.7, w: 6.6, h: 4.85, barDir: "bar",
      showTitle: true, title: "Township businesses (%)", titleColor: C.white, titleFontFace: BODY, titleFontSize: 15,
      chartColors: [C.cyan], showValue: true, dataLabelPosition: "outEnd", dataLabelColor: C.white, dataLabelFontSize: 13, dataLabelFormatCode: '0"%"',
      catAxisLabelColor: C.white, catAxisLabelFontSize: 12, catAxisOrientation: "maxMin", valAxisHidden: true, valAxisMaxVal: 100,
      valGridLine: { style: "none" }, catGridLine: { style: "none" }, showLegend: false, barGapWidthPct: 60,
    });
    foot(s, 3, "Standard Bank, Township Informal Economy Report 2025 (Foshizi; 250+ businesses, 5 provinces); ~R150 bn cash at spaza shops (reported with the launch); DSBD & dtic, Spaza Shop Support Fund update, May 2026.");
    s.addNotes("NUMBERS (25 s). Only say three: 'Standard Bank's 2025 township report puts this economy at about R900 BILLION a year (not 800). About 80% of these businesses are unregistered, fewer than 9% can get a bank loan. And when government opened a R500 million Spaza Support Fund, 354 applications failed verification.' IF ASKED where the R900 bn comes from: Standard Bank's first Township Informal Economy Report, October 2025, research by Foshizi, over 250 businesses in Gauteng, KZN, Western Cape, Limpopo and North West. The key point: 56% already prefer EFT: they're ready for digital, they just need a tool built for them.");
  }

  // ------------------------------------------------------------ 4. Why South Africa first
  {
    const s = pres.addSlide(); base(s);
    title(s, "Why South Africa first", "Then the continent.");
    const why = [
      [Fi.FiMapPin, "We live this market", "We come from these communities. We know how a spaza restocks and how a builder gets paid."],
      [Fi.FiTrendingUp, "Big and dense", "About 150,000 spaza shops, 1.2 million construction workers (38% informal). One supplier serves hundreds of shops."],
      [Fi.FiCreditCard, "Ready for digital", "56% prefer EFT. Local rails (PayFast, instant EFT) and cheap Android phones are already here."],
      [Fi.FiShield, "Clear rules", "POPIA for privacy, CIPC for registration, VAT invoices: we built to them from day one."],
    ];
    for (let i = 0; i < 4; i++) {
      const x = 0.6 + (i % 2) * 6.15, y = 2.1 + Math.floor(i / 2) * 2.3;
      card(s, x, y, 5.85, 2.0);
      await disc(s, why[i][0], x + 0.3, y + 0.3, 0.8);
      text(s, why[i][1], { x: x + 1.35, y: y + 0.3, w: 4.2, h: 0.45, fontSize: 19, bold: true });
      text(s, why[i][2], { x: x + 1.35, y: y + 0.8, w: 4.25, h: 1.1, fontSize: 14, color: C.muted });
    }
    foot(s, 4, "ILO 2024 (construction informality); Standard Bank 2025.");
    s.addNotes("WHY SA (20 s, answer this even if they don't ask). 'We start here because we know this market from the inside, it's large and dense, it's ready for digital payments, and the rules are clear. Once the model works here, the same problem exists across Africa: Nigeria and Kenya have B2B apps for shops, but none that also run the business.'");
  }

  // ------------------------------------------------------------ 5. The solution
  {
    const s = pres.addSlide(); base(s);
    title(s, "One free app: run it, restock it");
    const pillars = [
      [Fi.FiBriefcase, "Run the business", C.cyan, ["Credit book: who owes me, when they pay", "Order book for the counter (works offline)", "Jobs for builders: stages, photos, client sign-off"]],
      [Fi.FiShoppingCart, "Order your stock", C.marigold, ["Suppliers recommended, with the reason why", "Their catalogue, their prices, stock checked", "Delivery to the shop or site, or collect"]],
      [Fi.FiCheckCircle, "Pay and prove it", C.jade, ["Pay digitally (PayFast) or cash on delivery", "Payment confirmed by the provider", "Invoice and receipt with a QR check"]],
    ];
    for (let i = 0; i < 3; i++) {
      const x = 0.6 + i * 4.1;
      card(s, x, 1.75, 3.8, 4.55);
      await disc(s, pillars[i][0], x + 0.35, 2.05, 0.85, pillars[i][2]);
      text(s, pillars[i][1], { x: x + 0.35, y: 3.05, w: 3.2, h: 0.5, fontSize: 20, bold: true, color: pillars[i][2] });
      s.addText(pillars[i][3].map((t, j) => ({ text: t, options: { bullet: true, breakLine: j < 2 } })),
        { x: x + 0.35, y: 3.65, w: 3.25, h: 2.5, fontFace: BODY, fontSize: 15, color: C.white, paraSpaceAfter: 8, margin: 0, valign: "top", isTextBox: true });
    }
    text(s, "Not a marketplace: we recommend suppliers, never products.", { x: 0.6, y: 6.45, w: 12, h: 0.4, fontSize: 15, italic: true, color: C.muted });
    foot(s, 5);
    s.addNotes("SOLUTION (30 s). 'Akayza is one free app. It helps an informal business run day to day: a credit book, an order book, jobs for builders. And it lets them order stock from the suppliers they already trust, pay digitally or cash, and get a proper invoice. We are not a marketplace: we recommend suppliers, never products.'");
  }

  // ------------------------------------------------------------ 6. How it works (journey)
  {
    const s = pres.addSlide(); base(s);
    title(s, "A day with Akayza", "A spaza owner, from sign-up to a paid, invoiced order.");
    const steps = [
      [Fi.FiUserPlus, "Sign up", "Email, then 4 short steps: the business, where it is, what it buys"],
      [Fi.FiStar, "See suppliers", "Ranked for her, with reasons: 'delivers to you', 'sells what you buy'"],
      [Fi.FiShoppingCart, "Order", "Their catalogue and prices. The server prices every order"],
      [Fi.FiCreditCard, "Pay", "PayFast, or cash on delivery (capped for safety)"],
      [Fi.FiFileText, "Get proof", "Invoice + receipt, QR to a public check page"],
      [Fi.FiBookOpen, "Run the shop", "Credit book, order book; what she sells shapes her next recommendations"],
    ];
    for (let i = 0; i < 6; i++) {
      const x = 0.55 + i * 2.1;
      await disc(s, steps[i][0], x + 0.55, 2.35, 0.9, i === 3 ? C.marigold : C.cyan);
      if (i < 5) s.addShape(pres.shapes.LINE, { x: x + 1.5, y: 2.8, w: 1.15, h: 0, line: { color: C.faint, width: 1.5, dashType: "dash", endArrowType: "triangle" } });
      text(s, `${i + 1}. ${steps[i][1]}`, { x, y: 3.45, w: 2.0, h: 0.8, fontSize: 16, bold: true, align: "center" });
      text(s, steps[i][2], { x: x + 0.05, y: 4.3, w: 1.9, h: 1.5, fontSize: 12.5, color: C.muted, align: "center" });
    }
    card(s, 0.6, 5.85, 12.1, 0.85, C.panel2);
    text(s, "A builder does the same with jobs: stages, a camera-only photo, and the client signs each stage off by link.",
      { x: 0.9, y: 6.05, w: 11.6, h: 0.5, fontSize: 15, color: C.white, valign: "middle" });
    foot(s, 6);
    s.addNotes("JOURNEY (20 s, or skip to the video in the 3-minute version). Walk it left to right in one breath each. The builder line at the bottom: 'a builder does the same with jobs, and the client signs each stage off from his own phone'.");
  }

  // ------------------------------------------------------------ 7. The engine
  {
    const s = pres.addSlide(); base(s);
    title(s, "The engine: tools that find suppliers", "Private demand signals lift the right suppliers, with a reason anyone can read.");
    const flow = [
      [Fi.FiTool, "Everyday tools", "Open job stages, counter sales, what you buy"],
      [Fi.FiActivity, "Private signals", "Aggregates only: 'plumbing 40%'. Never names, amounts or clients"],
      [Fi.FiList, "Every supplier ranked", "Distance, delivery, what they sell, how you pay: nobody hidden"],
    ];
    for (let i = 0; i < 3; i++) {
      const x = 0.6 + i * 4.1;
      card(s, x, 2.05, 3.6, 2.35);
      await disc(s, flow[i][0], x + 0.3, 2.3, 0.8, [C.cyan, C.marigold, C.jade][i]);
      text(s, flow[i][1], { x: x + 1.25, y: 2.4, w: 2.25, h: 0.6, fontSize: 18, bold: true });
      text(s, flow[i][2], { x: x + 0.3, y: 3.25, w: 3.1, h: 1.1, fontSize: 14, color: C.muted });
      if (i < 2) s.addShape(pres.shapes.LINE, { x: x + 3.65, y: 3.2, w: 0.4, h: 0, line: { color: C.cyan, width: 2, endArrowType: "triangle" } });
    }
    card(s, 0.6, 4.75, 12.1, 1.7, C.panel2);
    text(s, "What a builder sees", { x: 0.95, y: 4.95, w: 5, h: 0.4, fontSize: 14, color: C.muted });
    text(s, "Midrand Build & Plumb  ·  Your open jobs need plumbing", { x: 0.95, y: 5.3, w: 11.4, h: 0.5, fontSize: 20, bold: true, color: C.white });
    text(s, "Rule-based and explainable, no AI black box. A supplier can see why it ranks where it does.", { x: 0.95, y: 5.9, w: 11.4, h: 0.4, fontSize: 14, italic: true, color: C.cyan });
    foot(s, 7);
    s.addNotes("ENGINE (25 s). This is what makes us different. 'The tools aren't just record-keeping. What a builder's open jobs need, or what a shop sold this week, becomes a private signal. It lifts the suppliers that sell exactly that, and tells the owner why: your open jobs need plumbing. Every supplier is still ranked, nobody is hidden, and no personal data ever leaves the business.'");
  }

  // ------------------------------------------------------------ 8. Demo video
  {
    const s = pres.addSlide(); base(s);
    title(s, "See it working", "90 seconds, filmed on a real phone against our real backend.");
    card(s, 0.6, 1.9, 7.6, 4.3, C.panel2);
    await disc(s, Fi.FiPlay, 3.65, 3.3, 1.5, C.marigold);
    text(s, "Demo video", { x: 0.6, y: 4.95, w: 7.6, h: 0.5, fontSize: 18, bold: true, align: "center" });
    text(s, "Link: add the unlisted YouTube / Google Drive link here", { x: 0.6, y: 5.45, w: 7.6, h: 0.45, fontSize: 13, color: C.muted, align: "center" });
    const shows = ["Sign-up in 4 steps", "Suppliers ranked with reasons", "Order, pay with PayFast (sandbox)", "Invoice with a QR check page", "A builder's stage signed off by the client"];
    text(s, "In the video", { x: 8.6, y: 1.95, w: 4.2, h: 0.45, fontSize: 18, bold: true, color: C.cyan });
    s.addText(shows.map((t, j) => ({ text: t, options: { bullet: true, breakLine: j < shows.length - 1 } })),
      { x: 8.6, y: 2.5, w: 4.2, h: 3.6, fontFace: BODY, fontSize: 16, color: C.white, paraSpaceAfter: 10, margin: 0, valign: "top", isTextBox: true });
    foot(s, 8);
    s.addNotes("DEMO (50 s). Play the video, or demo live on the phone. Before you go on stage: phone charged, backend + ngrok running, health check green. Replace the link text on this slide with the real link (Insert > Link on the play button too).");
  }

  // ------------------------------------------------------------ 9. Users and customers
  {
    const s = pres.addSlide(); base(s);
    title(s, "Who uses it, who pays for it");
    card(s, 0.6, 1.6, 5.95, 4.9);
    await disc(s, Fi.FiUsers, 0.95, 1.9, 0.9);
    text(s, "USERS  ·  free, always", { x: 2.05, y: 2.05, w: 4.3, h: 0.5, fontSize: 20, bold: true, color: C.cyan });
    s.addText(["Spaza shops and small shops", "Builders and 11 trades (plumbers, electricians, tilers...)", "Food sellers and other informal businesses", "Android phone, mostly cash, 2 to 5 regular suppliers", "All nine provinces"].map((t, j, a) => ({ text: t, options: { bullet: true, breakLine: j < a.length - 1 } })),
      { x: 0.95, y: 3.05, w: 5.3, h: 3.2, fontFace: BODY, fontSize: 16, color: C.white, paraSpaceAfter: 9, margin: 0, valign: "top", isTextBox: true });
    card(s, 6.75, 1.6, 5.95, 4.9);
    await disc(s, Fi.FiTruck, 7.1, 1.9, 0.9, C.marigold);
    text(s, "CUSTOMERS  ·  they pay", { x: 8.2, y: 2.05, w: 4.3, h: 0.5, fontSize: 20, bold: true, color: C.marigold });
    s.addText(["Wholesalers and cash-and-carries", "Hardware and building suppliers", "Why they pay: more orders from the shops they already serve, no cash disputes with drivers, and a view of what their customers will need"].map((t, j, a) => ({ text: t, options: { bullet: true, breakLine: j < a.length - 1 } })),
      { x: 7.1, y: 3.05, w: 5.3, h: 3.2, fontFace: BODY, fontSize: 16, color: C.white, paraSpaceAfter: 9, margin: 0, valign: "top", isTextBox: true });
    foot(s, 9);
    s.addNotes("USERS vs CUSTOMERS (20 s). 'The businesses use it free. Suppliers pay us, because we bring them more orders from the shops and builders they already serve, and we end the cash disputes with their drivers.' Most small businesses already have suppliers they trust: we make that relationship work better.");
  }

  // ------------------------------------------------------------ 10. Business model + revenue chart
  {
    const s = pres.addSlide(); base(s);
    title(s, "How we make money");
    const prices = [["Starter", "R299", "/month", "Catalogue, orders, invoices"], ["Pro", "R1,499", "/month", "Demand insights, priority support"], ["ERP link", "R4,999", "/month + R15k setup", "Direct stock-system connection (later)"], ["Digital orders", "~1%", "per order", "Only on PayFast orders. Cash stays free"]];
    for (let i = 0; i < 4; i++) {
      const y = 1.5 + i * 1.3;
      card(s, 0.6, y, 5.3, 1.12);
      text(s, prices[i][0], { x: 0.85, y: y + 0.14, w: 2.2, h: 0.4, fontSize: 15, bold: true, color: C.muted });
      text(s, prices[i][3], { x: 0.85, y: y + 0.55, w: 2.6, h: 0.5, fontSize: 12.5, color: C.muted });
      text(s, prices[i][1], { x: 3.1, y: y + 0.1, w: 2.6, h: 0.6, fontFace: TITLE, fontSize: 28, bold: true, color: i === 3 ? C.marigold : C.cyan, align: "right" });
      text(s, prices[i][2], { x: 3.1, y: y + 0.68, w: 2.6, h: 0.35, fontSize: 11.5, color: C.faint, align: "right" });
    }
    card(s, 6.2, 1.5, 6.5, 5.02);
    s.addChart(pres.charts.BAR, [
      { name: "Supplier subscriptions", labels: ["Year 1", "Year 2", "Year 3"], values: [16, 83, 310] },
      { name: "1% on digital orders", labels: ["Year 1", "Year 2", "Year 3"], values: [40, 200, 800] },
    ], {
      x: 6.35, y: 1.6, w: 6.2, h: 4.25, barDir: "col", barGrouping: "stacked",
      showTitle: true, title: "Monthly revenue at year end (R thousand, estimate)", titleColor: C.white, titleFontFace: BODY, titleFontSize: 13,
      chartColors: [C.cyan, C.marigold], showValue: false,
      catAxisLabelColor: C.white, catAxisLabelFontSize: 13, valAxisHidden: true, valGridLine: { style: "none" }, catGridLine: { style: "none" },
      showLegend: true, legendPos: "b", legendColor: C.white, legendFontSize: 12, barGapWidthPct: 55,
    });
    text(s, "Y1 ≈ R56k  ·  Y2 ≈ R283k  ·  Y3 ≈ R1.1m a month", { x: 6.4, y: 5.85, w: 6.1, h: 0.35, fontSize: 13.5, bold: true, color: C.white, align: "center" });
    text(s, "Y1: 15 suppliers, 1,000 businesses  ·  Y2: 60 / 5,000  ·  Y3: 200 / 20,000", { x: 6.4, y: 6.2, w: 6.1, h: 0.3, fontSize: 11.5, color: C.muted, align: "center" });
    foot(s, 10, "Estimates. Commission assumes ~R4,000 of digital orders per business per month.");
    s.addNotes("MONEY (25 s). 'Businesses never pay for the core tools. Suppliers pay R299 or R1,499 a month, and we take about 1% only on digital orders, never on cash. By the end of year one, 15 suppliers and 1,000 businesses give about R56,000 a month; year three about R1.1 million a month.' IF ASKED how you got the numbers: subscriptions = supplier mix x price; commission = active businesses x ~R4,000 digital orders a month x 1%. They're estimates, and we say so.");
  }

  // ------------------------------------------------------------ 11. Competition
  {
    const s = pres.addSlide(); base(s);
    title(s, "Who else is here, and why we're different");
    const rows = [
      ["", "Runs the business", "Orders from YOUR suppliers", "Builders too", "Verified payment + invoice"],
      ["WhatsApp + notebook (today)", "no", "by voice note", "no", "no"],
      ["A wholesaler's own app (e.g. Shoprite Cash & Carry)", "no", "one wholesaler", "no", "yes"],
      ["Payments / POS (iKhokha, Yoco)", "sales only", "no", "no", "card payments"],
      ["Bulk buying (Spazapp)", "no", "their range", "no", "yes"],
      ["Akayza", "yes", "any supplier you use", "yes", "yes"],
    ];
    const tbl = rows.map((r, i) => r.map((c, j) => ({
      text: c,
      options: {
        fontFace: BODY, fontSize: i === 0 ? 13 : 13.5, bold: i === 0 || j === 0 || i === rows.length - 1,
        color: i === rows.length - 1 ? C.bg : i === 0 ? C.cyan : j === 0 ? C.white : c === "no" ? C.faint : C.white,
        fill: { color: i === rows.length - 1 ? C.cyan : i % 2 ? C.panel : C.bg },
        align: j === 0 ? "left" : "center", valign: "middle",
      },
    })));
    s.addTable(tbl, { x: 0.6, y: 1.6, w: 12.1, colW: [3.9, 2.05, 2.25, 1.65, 2.25], rowH: 0.72, border: { type: "solid", color: C.panel2, pt: 1 } });
    text(s, "Our biggest competitor is the habit of WhatsApp and a notebook. We win by being easier than both, for the suppliers they already use.",
      { x: 0.6, y: 6.1, w: 12.1, h: 0.6, fontSize: 15, italic: true, color: C.marigold });
    foot(s, 11);
    s.addNotes("COMPETITION (20 s). The panel asked about e-commerce: 'Shoprite Cash & Carry has a buying app for spaza shops. It's one wholesaler selling its own range. We work with whichever suppliers a business already uses, we cover builders too, and we run the business, not just the order. Payments apps like iKhokha and Yoco take card payments; we complement them.' Don't attack competitors; show the gap.");
  }

  // ------------------------------------------------------------ 12. Go-to-market
  {
    const s = pres.addSlide(); base(s);
    title(s, "We reach users through their suppliers");
    const phases = [
      ["0-6 months", "Pilot", C.cyan, ["2 suppliers (a wholesaler + a hardware store)", "The 50-100 shops and builders they already serve", "A field agent at the counter and on the delivery route"]],
      ["6-18 months", "Grow", C.marigold, ["15 paying suppliers, 1,000 active businesses", "Each supplier onboards its own customers", "Owners invite their suppliers; builders bring partners"]],
      ["18-36 months", "Scale", C.jade, ["All nine provinces, ERP connections", "Spaza and builder associations, trade events", "Then the same model in other African markets"]],
    ];
    for (let i = 0; i < 3; i++) {
      const x = 0.6 + i * 4.1;
      card(s, x, 1.65, 3.8, 4.6);
      text(s, phases[i][0], { x: x + 0.35, y: 1.9, w: 3.1, h: 0.4, fontSize: 14, color: C.muted });
      text(s, phases[i][1], { x: x + 0.35, y: 2.3, w: 3.1, h: 0.7, fontFace: TITLE, fontSize: 30, bold: true, color: phases[i][2] });
      s.addText(phases[i][3].map((t, j) => ({ text: t, options: { bullet: true, breakLine: j < 2 } })),
        { x: x + 0.35, y: 3.2, w: 3.2, h: 2.9, fontFace: BODY, fontSize: 15, color: C.white, paraSpaceAfter: 9, margin: 0, valign: "top", isTextBox: true });
      if (i < 2) s.addShape(pres.shapes.LINE, { x: x + 3.82, y: 3.9, w: 0.26, h: 0, line: { color: C.faint, width: 1.5, endArrowType: "triangle" } });
    }
    text(s, "One supplier brings hundreds of businesses. That's why suppliers are both our customer and our channel.", { x: 0.6, y: 6.4, w: 12.1, h: 0.45, fontSize: 15, italic: true, color: C.cyan });
    foot(s, 12);
    s.addNotes("GO-TO-MARKET (20 s). 'We don't buy ads to reach 150,000 spaza shops one by one. We sign a supplier, and the supplier brings the shops and builders it already delivers to. The pilot is two suppliers and their customers, with a field agent at the counter.'");
  }

  // ------------------------------------------------------------ 13. Costs + the ask
  {
    const s = pres.addSlide(); base(s);
    title(s, "What it costs, and what we need now");
    text(s, "R300,000", { x: 0.6, y: 1.55, w: 5.6, h: 1.2, fontFace: TITLE, fontSize: 60, bold: true, color: C.marigold });
    text(s, "for a 6-month pilot with 2 suppliers and the 50-100 businesses they serve", { x: 0.6, y: 2.75, w: 5.4, h: 0.8, fontSize: 16, color: C.white });
    const costs = [["Running costs, pilot", "~R460 / month"], ["Running costs, growth", "~R4,700 / month"], ["Google Play (once)", "R415"], ["Break-even", "2 Starter suppliers"]];
    for (let i = 0; i < 4; i++) {
      const y = 3.75 + i * 0.68;
      card(s, 0.6, y, 5.4, 0.56);
      text(s, costs[i][0], { x: 0.85, y: y + 0.1, w: 3.0, h: 0.38, fontSize: 14, color: C.muted, valign: "middle" });
      text(s, costs[i][1], { x: 3.5, y: y + 0.1, w: 2.3, h: 0.38, fontSize: 14, bold: true, align: "right", valign: "middle" });
    }
    card(s, 6.3, 1.55, 6.4, 5.0);
    s.addChart(pres.charts.DOUGHNUT, [{ name: "Use of funds", labels: ["Stipends for pilot businesses", "Field agent", "Data bundles", "Running costs", "POPIA review + security test", "Devices + contingency"], values: [96, 60, 60, 24, 30, 30] }], {
      x: 6.45, y: 1.65, w: 6.1, h: 4.8, holeSize: 55,
      showTitle: true, title: "Use of the R300,000 (R thousand)", titleColor: C.white, titleFontFace: BODY, titleFontSize: 14,
      chartColors: [C.cyan, C.marigold, C.jade, "7C9CBF", C.coral, "C4B5FD"], showValue: true, showPercent: false, dataLabelColor: C.bg, dataLabelFontSize: 12, dataLabelFontBold: true,
      showLegend: true, legendPos: "r", legendColor: C.white, legendFontSize: 11.5,
    });
    foot(s, 13);
    s.addNotes("THE ASK (20 s). The organisers asked for the sum of costs, so say the number clearly: 'Running Akayza costs about R460 a month in the pilot. Two suppliers on our Starter plan cover that. We're asking for R300,000 for a six-month pilot: stipends and data for the pilot businesses, a field agent, a POPIA review and an external security test.'");
  }

  // ------------------------------------------------------------ 14. Built, tested, TRL
  {
    const s = pres.addSlide(); base(s);
    title(s, "It's built, and it's tested", "Technology Readiness Level 4: validated end to end in our own environment.");
    const nums = [["1,239", "automated backend tests"], ["197", "app tests"], ["11", "sample suppliers, 1,672 products"], ["0", "card numbers ever touch our servers"]];
    for (let i = 0; i < 4; i++) {
      const x = 0.6 + i * 3.08;
      card(s, x, 2.0, 2.85, 1.9);
      text(s, nums[i][0], { x: x + 0.2, y: 2.15, w: 2.45, h: 0.9, fontFace: TITLE, fontSize: 42, bold: true, color: i === 3 ? C.jade : C.cyan, align: "center" });
      text(s, nums[i][1], { x: x + 0.2, y: 3.05, w: 2.45, h: 0.75, fontSize: 13.5, color: C.muted, align: "center" });
    }
    const trl = [["TRL 4 (today)", "Every flow works end to end: sign-up, suppliers, orders, PayFast sandbox, invoices, the tools", C.cyan], ["TRL 5-6 (pilot)", "Real suppliers and businesses, live payments, in their own shops and sites", C.marigold], ["TRL 7+ (year 1)", "Nine provinces, supplier stock systems connected", C.jade]];
    for (let i = 0; i < 3; i++) {
      const y = 4.25 + i * 0.8;
      s.addShape(pres.shapes.OVAL, { x: 0.65, y: y + 0.12, w: 0.36, h: 0.36, fill: { color: trl[i][2] }, line: { color: trl[i][2] } });
      text(s, trl[i][0], { x: 1.2, y: y + 0.08, w: 2.6, h: 0.45, fontSize: 16, bold: true, color: trl[i][2] });
      text(s, trl[i][1], { x: 3.8, y: y + 0.08, w: 8.9, h: 0.5, fontSize: 15 });
    }
    foot(s, 14);
    s.addNotes("TRL (15 s). 'This isn't a mock-up. Over a thousand automated tests run before every change. Payments work end to end in PayFast's sandbox. We're TRL 4 today; the pilot takes us to 5 and 6.' If a mentor rated us higher or lower in the war room, change this slide to match.");
  }

  // ------------------------------------------------------------ 15. Architecture
  {
    const s = pres.addSlide(); base(s);
    title(s, "How it's built");
    const box = async (x, y, w, h, Comp, head, body, color = C.cyan) => {
      card(s, x, y, w, h);
      await disc(s, Comp, x + 0.25, y + 0.25, 0.7, color);
      text(s, head, { x: x + 1.1, y: y + 0.25, w: w - 1.3, h: 0.4, fontSize: 17, bold: true, color });
      text(s, body, { x: x + 1.1, y: y + 0.68, w: w - 1.3, h: h - 0.8, fontSize: 13, color: C.muted });
    };
    await box(0.6, 1.65, 3.6, 2.1, Fi.FiSmartphone, "Mobile app", "React Native + Expo (TypeScript). Android first. Secure storage for sign-in. Offline counter orders.");
    await box(4.85, 1.65, 3.6, 2.1, Fi.FiServer, "API", "Python + Flask. Strict input checks, rate limits, idempotent orders. Rule-based supplier engine.", C.marigold);
    await box(9.1, 1.65, 3.6, 2.1, Fi.FiDatabase, "Database", "PostgreSQL, separate schemas per area. Versioned migrations. Audit trail without personal data.", C.jade);
    s.addShape(pres.shapes.LINE, { x: 4.25, y: 2.7, w: 0.55, h: 0, line: { color: C.cyan, width: 2, beginArrowType: "triangle", endArrowType: "triangle" } });
    s.addShape(pres.shapes.LINE, { x: 8.5, y: 2.7, w: 0.55, h: 0, line: { color: C.cyan, width: 2, beginArrowType: "triangle", endArrowType: "triangle" } });
    text(s, "Connected services", { x: 0.6, y: 4.2, w: 6, h: 0.4, fontSize: 16, bold: true, color: C.muted });
    const svc = [[Fi.FiCreditCard, "PayFast", "payments, 4-check confirmation"], [Fi.FiImage, "Cloudinary", "signed direct photo uploads"], [Fi.FiMap, "Mapbox", "address search, via our server"], [Fi.FiMail, "Email", "codes, receipts, alerts"]];
    for (let i = 0; i < 4; i++) {
      const x = 0.6 + i * 3.08;
      card(s, x, 4.7, 2.85, 1.6, C.panel2);
      await disc(s, svc[i][0], x + 0.2, 4.9, 0.6);
      text(s, svc[i][1], { x: x + 0.95, y: 4.95, w: 1.8, h: 0.4, fontSize: 15, bold: true });
      text(s, svc[i][2], { x: x + 0.2, y: 5.6, w: 2.5, h: 0.6, fontSize: 12.5, color: C.muted });
    }
    foot(s, 15);
    s.addNotes("ARCHITECTURE (only if asked or in the 5-minute finale). App -> API -> database; PayFast, Cloudinary, Mapbox and email behind the API. Each feature is its own module, and an automated test stops one module reaching into another's data.");
  }

  // ------------------------------------------------------------ 16. Security + privacy
  {
    const s = pres.addSlide(); base(s);
    title(s, "Safe by design, honest about proof");
    const items = [
      [Fi.FiLock, "Your data is yours", "Every request is limited to the signed-in owner. Someone else's record answers 'not found'."],
      [Fi.FiSmartphone, "Simple for the owner", "Email and password; one code only on a new phone. The rest runs on our side."],
      [Fi.FiCreditCard, "Card data never touches us", "PayFast's hosted page. A payment counts only after 4 server checks."],
      [Fi.FiEyeOff, "Private by default (POPIA)", "Engine uses aggregates only. No names or addresses in logs. Data export and account closure built in."],
      [Fi.FiCheckSquare, "Honest proof", "Only provider-verified payments are proof. Cash is 'confirmed by both' at most. Tool records are the owner's own."],
      [Fi.FiAlertTriangle, "Tested like an attacker", "Hostile-input tests on every endpoint, rate limits, OWASP API Top 10 mapped, incident plan."],
    ];
    for (let i = 0; i < 6; i++) {
      const x = 0.6 + (i % 3) * 4.1, y = 1.6 + Math.floor(i / 3) * 2.55;
      card(s, x, y, 3.8, 2.3);
      await disc(s, items[i][0], x + 0.3, y + 0.3, 0.7, i === 4 ? C.marigold : C.cyan);
      text(s, items[i][1], { x: x + 1.15, y: y + 0.35, w: 2.5, h: 0.7, fontSize: 16, bold: true });
      text(s, items[i][2], { x: x + 0.3, y: y + 1.1, w: 3.25, h: 1.1, fontSize: 13, color: C.muted });
    }
    foot(s, 16);
    s.addNotes("SECURITY (15 s). Answer the war-room worry about complexity: 'Security is invisible for the owner: email and password, and a code only on a new phone. Everything else happens on our server.' Then: 'and we're honest about proof: only a payment confirmed by the provider counts as proof.'");
  }

  // ------------------------------------------------------------ 17. Impact + roadmap (quantum outline)
  {
    const s = pres.addSlide(); base(s);
    title(s, "Impact, and what's next");
    const impact = [["Fewer cash disputes", "between shops, drivers and suppliers"], ["A record the owner holds", "the first step to credit and support funds"], ["More orders for local suppliers", "the money keeps moving in the kasi"]];
    for (let i = 0; i < 3; i++) {
      const y = 1.75 + i * 1.65;
      await disc(s, [Fi.FiUsers, Fi.FiAward, Fi.FiRepeat][i], 0.6, y, 0.8, [C.cyan, C.marigold, C.jade][i]);
      text(s, impact[i][0], { x: 1.6, y: y + 0.02, w: 4.7, h: 0.45, fontSize: 18, bold: true });
      text(s, impact[i][1], { x: 1.6, y: y + 0.48, w: 4.7, h: 0.45, fontSize: 14, color: C.muted });
    }
    card(s, 6.7, 1.55, 6.0, 5.05);
    text(s, "Roadmap", { x: 7.0, y: 1.8, w: 5.4, h: 0.45, fontSize: 20, bold: true, color: C.cyan });
    const road = ["Google sign-in and phone push alerts", "Direct connection to supplier stock systems (ERP, API keys)", "Two-phone cash confirmation ('confirmed by both')", "Split payouts straight to suppliers", "Cloudflare protection on our own domain", "Post-quantum ready: sign records and documents with ML-DSA (NIST FIPS 204) so proof stays valid for decades"];
    s.addText(road.map((t, j) => ({ text: t, options: { bullet: true, breakLine: j < road.length - 1, color: j === road.length - 1 ? C.marigold : C.white } })),
      { x: 7.0, y: 2.4, w: 5.45, h: 4.0, fontFace: BODY, fontSize: 14.5, paraSpaceAfter: 9, margin: 0, valign: "top", isTextBox: true });
    foot(s, 17);
    s.addNotes("IMPACT + ROADMAP (15 s). One line each on impact. The last roadmap point is the quantum bonus outline: 'Records and invoices are meant to prove things for years, so the next step is post-quantum signatures, ML-DSA, the NIST standard, so today's proof still holds when quantum computers can break today's signatures.' That's the 2 bonus points for an outline; don't claim it's built.");
  }

  // ------------------------------------------------------------ 18. Team
  {
    const s = pres.addSlide(); base(s);
    title(s, "Team PR");
    const team = [["Mandla", "Team lead · product, backend, payments and the supplier engine", Fi.FiUser, C.cyan], ["Risuna", "Business tools · credit book, order book, jobs, builder network, notifications", Fi.FiUser, C.marigold]];
    for (let i = 0; i < 2; i++) {
      const x = 0.6 + i * 6.15;
      card(s, x, 1.7, 5.85, 3.3);
      await disc(s, team[i][2], x + 0.4, 2.05, 1.3, team[i][3]);
      text(s, team[i][0], { x: x + 2.0, y: 2.2, w: 3.6, h: 0.7, fontFace: TITLE, fontSize: 30, bold: true, color: team[i][3] });
      text(s, team[i][1], { x: x + 2.0, y: 2.95, w: 3.6, h: 1.8, fontSize: 15, color: C.white });
    }
    card(s, 0.6, 5.35, 12.1, 1.2, C.panel2);
    text(s, "Built in one weekend, end to end: a full-stack app, an API, a database and real payments, with over 1,400 automated tests.", { x: 0.95, y: 5.55, w: 11.4, h: 0.8, fontSize: 16, color: C.white, valign: "middle" });
    foot(s, 18);
    s.addNotes("TEAM (10 s). Edit the roles to how you want to be introduced; add the DataQuest 2026 win here if you want it on the slide.");
  }

  // ------------------------------------------------------------ 19. Thank you
  {
    const s = pres.addSlide(); base(s);
    s.addText("Thank you", { x: 0.8, y: 1.7, w: 11, h: 1.3, fontFace: TITLE, fontSize: 66, bold: true, color: C.white, margin: 0, isTextBox: true });
    s.addText("Keep it in the kasi.", { x: 0.8, y: 3.0, w: 11, h: 0.8, fontFace: TITLE, fontSize: 30, italic: true, color: C.cyan, margin: 0, isTextBox: true });
    text(s, "R300,000  ·  6-month pilot  ·  2 suppliers and the businesses they serve", { x: 0.8, y: 4.2, w: 11, h: 0.5, fontSize: 20, bold: true, color: C.marigold });
    text(s, "Akayza · prepared by Team PR · GKHack26", { x: 0.8, y: 5.6, w: 11, h: 0.4, fontSize: 14, color: C.faint });
    s.addNotes("CLOSE (10 s). Look at the panel: 'It's built, it works, and suppliers pay for it. We're asking for R300,000 to put it in real shops and on real sites. Are you buying?' Then stop talking.");
  }

  await pres.writeFile({ fileName: OUT });
  console.log("wrote", OUT);
})();
