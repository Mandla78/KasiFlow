// Akayza pitch deck v2 -- a sales story, not a manual. Team PR, GKHack26.
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const fs = require("fs");
const Fi = require("react-icons/fi");

const OUT = process.argv[2] || "Akayza_Pitch_TeamPR.pptx";
const LOGO = "image/png;base64," + fs.readFileSync(__dirname + "/logo_mark.png").toString("base64");

// Brand: navy ground, emerald (goods flowing out), amber (cash coming back).
const C = {
  bg: "0F172A", panel: "17223A", panel2: "1E2B45", em: "10B981", emL: "34D399", am: "F59E0B", amL: "FBBF24",
  white: "F8FAFC", muted: "A3B3C9", faint: "64748B", red: "F87171",
};
const TITLE = "Georgia", BODY = "Calibri";

async function icon(Comp, color, px = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Comp, { color: "#" + color, size: px }));
  return "image/png;base64," + (await sharp(Buffer.from(svg)).png().toBuffer()).toString("base64");
}

(async () => {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
  pres.title = "Akayza - prepared by Team PR";
  pres.author = "Team PR";
  const W = 13.333;

  const base = (s) => { s.background = { color: C.bg }; };
  const t = (s, str, o) => s.addText(str, { fontFace: BODY, color: C.white, margin: 0, isTextBox: true, valign: "top", ...o });
  const kicker = (s, str) => t(s, str.toUpperCase(), { x: 0.6, y: 0.42, w: 9, h: 0.35, fontSize: 13, bold: true, color: C.em, charSpacing: 3 });
  const title = (s, str, y = 0.8) => t(s, str, { x: 0.6, y, w: W - 1.2, h: 0.95, fontFace: TITLE, fontSize: 34, bold: true });
  const card = (s, x, y, w, h, fill = C.panel) => s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: fill }, line: { color: fill }, rectRadius: 0.12 });
  const disc = async (s, Comp, x, y, d = 0.75, color = C.em) => {
    s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: C.panel2 }, line: { color, width: 1.5 } });
    s.addImage({ data: await icon(Comp, color), x: x + d * 0.24, y: y + d * 0.24, w: d * 0.52, h: d * 0.52 });
  };
  const foot = (s, n, src) => {
    s.addImage({ data: LOGO, x: W - 1.05, y: 6.88, w: 0.42, h: 0.42 });
    t(s, String(n), { x: W - 1.65, y: 6.95, w: 0.5, h: 0.3, fontSize: 10, color: C.faint, align: "right" });
    if (src) t(s, src, { x: 0.6, y: 6.93, w: 10.8, h: 0.4, fontSize: 9.5, color: C.faint });
  };
  const wordmark = (s, x, y, size) =>
    s.addText([{ text: "akay", options: { color: C.white } }, { text: "za", options: { color: C.em } }],
      { x, y, w: 7, h: size / 55, fontFace: "Arial", bold: true, fontSize: size, margin: 0, isTextBox: true, valign: "top" });

  // ================================================================ 1. TITLE
  {
    const s = pres.addSlide(); base(s);
    s.addImage({ data: LOGO, x: 0.75, y: 1.2, w: 1.7, h: 1.7 });
    wordmark(s, 0.72, 3.05, 72);
    t(s, "Keep it in the kasi.", { x: 0.8, y: 4.45, w: 8, h: 0.7, fontFace: TITLE, fontSize: 30, italic: true, color: C.amL });
    t(s, "Making South Africa's informal businesses visible, and ready for what's next.", { x: 0.8, y: 5.2, w: 7.4, h: 0.8, fontSize: 18, color: C.muted });
    t(s, "Prepared by Team PR  ·  GKHack26  ·  27 September 2026", { x: 0.8, y: 6.35, w: 8, h: 0.4, fontSize: 13, color: C.faint });
    // A quiet motif on the right: the three flows of the logo as rings.
    s.addShape(pres.shapes.OVAL, { x: 9.2, y: 0.9, w: 3.6, h: 3.6, fill: { color: C.bg }, line: { color: C.panel2, width: 2 } });
    s.addShape(pres.shapes.OVAL, { x: 10.1, y: 2.5, w: 2.9, h: 2.9, fill: { color: C.bg, transparency: 100 }, line: { color: C.em, width: 1.5, transparency: 40 } });
    s.addShape(pres.shapes.OVAL, { x: 9.0, y: 3.5, w: 2.5, h: 2.5, fill: { color: C.bg, transparency: 100 }, line: { color: C.am, width: 1.5, transparency: 40 } });
    s.addNotes(
      "SAY (10 s): 'Good morning. We're Team PR, and this is Akayza. Keep it in the kasi.'\n" +
      "Then go straight to the next slide. No introductions of ourselves yet: the problem earns the attention, the team comes before the ask.");
  }

  // ================================================================ 2. HOOK
  {
    const s = pres.addSlide(); base(s);
    kicker(s, "The problem");
    t(s, "R900 billion", { x: 0.6, y: 1.25, w: 12, h: 1.6, fontFace: TITLE, fontSize: 96, bold: true, color: C.amL });
    t(s, "moves through South Africa's township economy every year.", { x: 0.6, y: 2.9, w: 12, h: 0.6, fontSize: 26, color: C.white });
    t(s, "And almost none of it can be seen.", { x: 0.6, y: 3.75, w: 12, h: 0.7, fontFace: TITLE, fontSize: 34, italic: true, bold: true, color: C.white });
    const bits = [["Not by banks", Fi.FiBriefcase], ["Not by suppliers", Fi.FiTruck], ["Not by support funds", Fi.FiShield], ["Not even by the owner", Fi.FiEyeOff]];
    for (let i = 0; i < 4; i++) {
      const x = 0.6 + i * 3.08;
      await disc(s, bits[i][1], x, 4.95, 0.7, i === 3 ? C.am : C.em);
      t(s, bits[i][0], { x: x + 0.85, y: 5.12, w: 2.2, h: 0.4, fontSize: 16, bold: true, color: C.muted });
    }
    foot(s, 2, "Standard Bank, Township Informal Economy Report, October 2025 (research by Foshizi; 250+ businesses in 5 provinces).");
    s.addNotes(
      "SAY (20 s): 'R900 billion. That's how much moves through South Africa's township economy every year: shops, builders, food sellers, salons, mechanics. It feeds communities and creates jobs. And almost none of it can be seen. Not by banks, not by suppliers, not by support funds, not even by the owner, who runs it on cash and memory.'\n\n" +
      "IF ASKED where R900 bn comes from: Standard Bank's first Township Informal Economy Report, launched October 2025, research by Foshizi, over 250 businesses across Gauteng, KwaZulu-Natal, Western Cape, Limpopo and North West. Say 'about R900 billion', never 800.");
  }

  // ================================================================ 3. LOCKED OUT
  {
    const s = pres.addSlide(); base(s);
    kicker(s, "The problem");
    title(s, "Invisible means locked out");
    const cols = [
      [Fi.FiLock, "No finance", "< 9%", "of township businesses can get a bank loan. 57% run on savings and family.", C.am],
      [Fi.FiXCircle, "No support", "354", "applications to the R500m Spaza Shop Support Fund failed verification. Only R179.6m reached shops.", C.red],
      [Fi.FiTrendingDown, "No leverage", "80%", "are unregistered. With no history, there are no supplier terms and no plan: every order is cash, every dispute is word against word.", C.em],
    ];
    for (let i = 0; i < 3; i++) {
      const x = 0.6 + i * 4.1;
      card(s, x, 2.0, 3.8, 4.55);
      await disc(s, cols[i][0], x + 0.35, 2.3, 0.8, cols[i][4]);
      t(s, cols[i][1], { x: x + 1.35, y: 2.48, w: 2.3, h: 0.5, fontSize: 21, bold: true });
      t(s, cols[i][2], { x: x + 0.35, y: 3.35, w: 3.2, h: 1.0, fontFace: TITLE, fontSize: 50, bold: true, color: cols[i][4] });
      t(s, cols[i][3], { x: x + 0.35, y: 4.45, w: 3.15, h: 1.9, fontSize: 15, color: C.muted });
    }
    foot(s, 3, "Standard Bank, Township Informal Economy Report 2025; DSBD & dtic, Spaza Shop Support Fund update, May 2026.");
    s.addNotes(
      "SAY (25 s): 'Being invisible has a price. Fewer than 9% of these businesses can get a bank loan. When government put R500 million on the table for spaza shops, 354 applications failed verification and only R179.6 million reached shops. And 80% are unregistered, so there are no supplier terms, no credit, and every cash dispute is one person's word against another's.'\n\n" +
      "NOTE: the Spaza fund figures are specifically about spaza shops (DSBD, May 2026): say 'spaza shops' only for that number.");
  }

  // ================================================================ 4. WHY IT STAYS INVISIBLE
  {
    const s = pres.addSlide(); base(s);
    kicker(s, "Why nobody has fixed it");
    title(s, "Business tools were built for the formal few");
    card(s, 0.6, 2.0, 5.9, 4.5);
    t(s, "What the tools assume", { x: 0.95, y: 2.25, w: 5.2, h: 0.45, fontSize: 19, bold: true, color: C.muted });
    const assume = ["A registered company and a bookkeeper", "Card machines and bank statements", "Time at a desk to capture everything", "One supplier's shop, or a marketplace"];
    const real = ["Cash, credit on trust, and memory", "A phone that's also the business", "Busy all day at the counter or on site", "The same few suppliers, for years"];
    for (let i = 0; i < 4; i++) {
      await disc(s, Fi.FiX, 0.95, 2.95 + i * 0.85, 0.5, C.faint);
      t(s, assume[i], { x: 1.6, y: 3.02 + i * 0.85, w: 4.7, h: 0.45, fontSize: 16, color: C.muted });
    }
    card(s, 6.8, 2.0, 5.9, 4.5, C.panel2);
    t(s, "How they really work", { x: 7.15, y: 2.25, w: 5.3, h: 0.45, fontSize: 19, bold: true, color: C.emL });
    for (let i = 0; i < 4; i++) {
      await disc(s, Fi.FiCheck, 7.15, 2.95 + i * 0.85, 0.5, C.em);
      t(s, real[i], { x: 7.8, y: 3.02 + i * 0.85, w: 4.7, h: 0.45, fontSize: 16 });
    }
    foot(s, 4);
    s.addNotes(
      "SAY (20 s): 'Why hasn't anyone fixed this? Because the tools were built for formal businesses: they assume a registered company, a bookkeeper, card machines. Informal businesses run on cash, trust and a phone, busy all day, buying from the same few suppliers for years. Nothing fits how they work, so nothing gets captured.'\n\n" +
      "WhatsApp is how they talk to each other; it isn't the problem. The problem is that nothing turns their everyday trading into a record.");
  }

  // ================================================================ 5. ENTER AKAYZA
  {
    const s = pres.addSlide(); base(s);
    s.addImage({ data: LOGO, x: 0.6, y: 0.5, w: 0.9, h: 0.9 });
    kicker(s, "");
    t(s, "Akayza makes informal businesses visible, and ready for tomorrow.", { x: 1.75, y: 0.55, w: 10.9, h: 1.0, fontFace: TITLE, fontSize: 30, bold: true });
    t(s, "One free app that runs the business and connects it to the suppliers it already trusts. Every sale, order and payment becomes a record the owner holds.",
      { x: 0.6, y: 1.75, w: 12.1, h: 0.8, fontSize: 18, color: C.muted });
    const outs = [
      ["TODAY", "Run it with less stress", "Know who owes you, what sold and what's coming, without a notebook.", Fi.FiSun, C.em],
      ["THIS WEEK", "Buy better, pay safely", "Order from your own suppliers, pay digitally or cash, get a proper invoice.", Fi.FiShoppingBag, C.amL],
      ["TOMORROW", "Be ready to grow", "A trading history you own: the first step to credit, support funds and formal registration.", Fi.FiTrendingUp, C.emL],
    ];
    for (let i = 0; i < 3; i++) {
      const x = 0.6 + i * 4.1;
      card(s, x, 2.85, 3.8, 3.7);
      t(s, outs[i][0], { x: x + 0.35, y: 3.1, w: 3.1, h: 0.35, fontSize: 13, bold: true, color: outs[i][4], charSpacing: 3 });
      await disc(s, outs[i][3], x + 2.75, 3.05, 0.75, outs[i][4]);
      t(s, outs[i][1], { x: x + 0.35, y: 3.95, w: 3.2, h: 0.9, fontFace: TITLE, fontSize: 22, bold: true });
      t(s, outs[i][2], { x: x + 0.35, y: 4.85, w: 3.15, h: 1.5, fontSize: 15, color: C.muted });
    }
    foot(s, 5);
    s.addNotes(
      "SAY (30 s): 'That's where Akayza comes in. It makes informal businesses visible, and ready for tomorrow. One free app that runs the business and connects it to the suppliers it already trusts. Today, the owner runs it with less stress. This week, she buys better and pays safely. And tomorrow, she has a trading history she owns: the first step to credit, support funds and registration.'\n\n" +
      "Honest wording if pushed: payments made in the app are confirmed by the payment provider; the rest is the owner's own record. We never call tool records 'proof'.");
  }

  // ================================================================ 6. A WEEK WITH AKAYZA (user journey story)
  {
    const s = pres.addSlide(); base(s);
    kicker(s, "User journey");
    title(s, "Thandi's week, with Akayza");
    t(s, "Thandi runs a small business. She's busy, she trusts her customers, and she's never had a record of it.", { x: 0.6, y: 1.65, w: 12.1, h: 0.5, fontSize: 17, italic: true, color: C.muted });
    const days = [
      ["Monday", "Restocks in 2 minutes", "Her usual supplier, their prices, delivered. No calls, no running out.", Fi.FiTruck, C.em],
      ["Wednesday", "Gets paid back", "A customer settles his credit. It's written off her book on the spot.", Fi.FiBookOpen, C.amL],
      ["Friday", "Pays without cash risk", "Pays the supplier in the app. The payment is confirmed, the invoice arrives.", Fi.FiCreditCard, C.emL],
      ["Month end", "Sees her business", "What she sold, what she's owed, what she bought: her own record.", Fi.FiBarChart2, C.am],
    ];
    for (let i = 0; i < 4; i++) {
      const x = 0.6 + i * 3.08;
      card(s, x, 2.5, 2.85, 3.95);
      await disc(s, days[i][3], x + 0.3, 2.8, 0.8, days[i][4]);
      t(s, days[i][0].toUpperCase(), { x: x + 0.3, y: 3.8, w: 2.4, h: 0.35, fontSize: 13, bold: true, color: days[i][4], charSpacing: 2 });
      t(s, days[i][1], { x: x + 0.3, y: 4.2, w: 2.35, h: 0.8, fontSize: 18, bold: true });
      t(s, days[i][2], { x: x + 0.3, y: 5.05, w: 2.35, h: 1.3, fontSize: 13.5, color: C.muted });
      if (i < 3) s.addShape(pres.shapes.LINE, { x: x + 2.88, y: 4.45, w: 0.18, h: 0, line: { color: C.faint, width: 1.5, endArrowType: "triangle" } });
    }
    t(s, "The same week works for a builder, a food seller, a mechanic, a salon.", { x: 0.6, y: 6.5, w: 12, h: 0.35, fontSize: 14, italic: true, color: C.em });
    foot(s, 6);
    s.addNotes(
      "SAY (25 s), tell it as a story: 'Meet Thandi. Monday she restocks from her usual supplier in two minutes. Wednesday a customer pays back his credit, and it's off her book on the spot. Friday she pays her supplier in the app: no cash on the road, the payment is confirmed and the invoice arrives. And at month end, for the first time, she can see her business.' Then: 'The same week works for a builder, a food seller, a mechanic.'\n\n" +
      "Thandi is an illustration, not a real customer. If asked: 'she's the kind of owner we built for; the pilot puts real names to her.'");
  }

  // ================================================================ 7. WHO WINS
  {
    const s = pres.addSlide(); base(s);
    kicker(s, "Who wins");
    title(s, "Everyone gains. Suppliers pay.");
    const cols = [
      [Fi.FiUsers, "Businesses", "Use it free, always", ["Less stress, less lost money", "Better buying from their own suppliers", "A record they own, for tomorrow"], C.em],
      [Fi.FiTruck, "Suppliers", "Our paying customers", ["More orders from shops they already serve", "No cash lost between driver and depot", "See what their customers will need"], C.amL],
      [Fi.FiBriefcase, "Partners", "Next: banks, funds, government", ["Businesses they can finally see", "Shared only with the owner's consent", "Faster, fairer verification"], C.emL],
    ];
    for (let i = 0; i < 3; i++) {
      const x = 0.6 + i * 4.1;
      card(s, x, 1.95, 3.8, 4.6, i === 1 ? C.panel2 : C.panel);
      await disc(s, cols[i][0], x + 0.35, 2.25, 0.85, cols[i][4]);
      t(s, cols[i][1], { x: x + 1.4, y: 2.3, w: 2.3, h: 0.45, fontSize: 21, bold: true, color: cols[i][4] });
      t(s, cols[i][2], { x: x + 1.4, y: 2.77, w: 2.3, h: 0.4, fontSize: 13.5, color: C.muted });
      s.addText(cols[i][3].map((q, j) => ({ text: q, options: { bullet: true, breakLine: j < 2 } })),
        { x: x + 0.35, y: 3.6, w: 3.2, h: 2.8, fontFace: BODY, fontSize: 16, color: C.white, paraSpaceAfter: 12, margin: 0, valign: "top", isTextBox: true });
    }
    foot(s, 7);
    s.addNotes(
      "SAY (20 s): 'Everyone in the chain gains. Businesses use it free. Suppliers pay us, because we bring them more orders from the shops and builders they already serve and end the cash lost between the driver and the depot. And next, banks, funds and government get businesses they can finally see, only with the owner's consent.'\n\n" +
      "Partners are the roadmap, not revenue today. Our revenue is suppliers.");
  }

  // ================================================================ 8. THE OPPORTUNITY
  {
    const s = pres.addSlide(); base(s);
    kicker(s, "The opportunity");
    title(s, "Start where the money already moves");
    const rings = [[0.6, 1.95, 4.6, C.panel, C.faint], [1.3, 2.9, 3.2, C.panel2, C.am], [1.95, 3.8, 1.9, C.em, C.em]];
    for (const [x, y, d, fill, line] of rings) s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: line, width: 1.5 } });
    t(s, "R900 bn", { x: 0.6, y: 2.2, w: 4.6, h: 0.5, fontFace: TITLE, fontSize: 22, bold: true, align: "center", color: C.muted });
    t(s, "R180 bn", { x: 1.3, y: 3.15, w: 3.2, h: 0.5, fontFace: TITLE, fontSize: 20, bold: true, align: "center", color: C.amL });
    t(s, "20,000", { x: 1.95, y: 4.5, w: 1.9, h: 0.5, fontFace: TITLE, fontSize: 20, bold: true, align: "center", color: C.bg });
    const rows = [
      ["R900 bn", "The township economy a year: every informal and small business we can serve.", C.muted],
      ["R180 bn", "Moves through spaza shops alone every year: one segment, already buying from suppliers every week.", C.amL],
      ["20,000", "Businesses and 200 paying suppliers by year 3: about R13 million a year in revenue.", C.emL],
    ];
    for (let i = 0; i < 3; i++) {
      const y = 2.05 + i * 1.5;
      t(s, rows[i][0], { x: 5.9, y, w: 2.2, h: 0.6, fontFace: TITLE, fontSize: 28, bold: true, color: rows[i][2] });
      t(s, rows[i][1], { x: 8.15, y: y + 0.05, w: 4.55, h: 1.2, fontSize: 16, color: C.white });
    }
    foot(s, 8, "Standard Bank 2025 (economy size; spaza segment ~R180 bn a year). Year-3 figures are our estimates.");
    s.addNotes(
      "SAY (20 s): 'The whole township economy is R900 billion. Spaza shops alone move about R180 billion a year: one segment, already buying every week. Our goal is 20,000 businesses and 200 paying suppliers by year three, about R13 million a year.'\n\n" +
      "R180 bn is specifically spaza shops (that's what the evidence measures), so we name them here. Everywhere else: informal and small businesses.");
  }

  // ================================================================ 9. WHY SOUTH AFRICA FIRST
  {
    const s = pres.addSlide(); base(s);
    kicker(s, "Why South Africa first");
    title(s, "We know this market from the inside");
    const why = [
      [Fi.FiHome, "We live it", "We grew up in these communities. We know how a business restocks, gives credit and gets paid."],
      [Fi.FiMap, "Big and dense", "R900 bn, in every province. One supplier serves hundreds of businesses on the same route."],
      [Fi.FiSmartphone, "Ready for digital", "56% already prefer EFT. Local payment rails and cheap Android phones are everywhere."],
      [Fi.FiCheckSquare, "Clear rules", "POPIA, CIPC, VAT invoicing: we built to them from day one. Then: the rest of Africa."],
    ];
    for (let i = 0; i < 4; i++) {
      const x = 0.6 + (i % 2) * 6.15, y = 2.0 + Math.floor(i / 2) * 2.3;
      card(s, x, y, 5.85, 2.05);
      await disc(s, why[i][0], x + 0.3, y + 0.32, 0.8, i === 3 ? C.amL : C.em);
      t(s, why[i][1], { x: x + 1.35, y: y + 0.32, w: 4.2, h: 0.45, fontSize: 20, bold: true });
      t(s, why[i][2], { x: x + 1.35, y: y + 0.85, w: 4.25, h: 1.1, fontSize: 15, color: C.muted });
    }
    foot(s, 9, "Standard Bank 2025 (56% prefer EFT or bank transfer).");
    s.addNotes(
      "SAY (20 s): 'Why South Africa first, not Africa? Because we know this market from the inside. It's big and dense, it's already moving to digital payments (56% prefer EFT), and the rules are clear. Win here, then take the same model across the continent.'");
  }

  // ================================================================ 10. SEE IT
  {
    const s = pres.addSlide(); base(s);
    kicker(s, "Don't take our word for it");
    title(s, "See it working");
    card(s, 0.6, 1.95, 8.0, 4.55, C.panel2);
    await disc(s, Fi.FiPlay, 3.85, 3.2, 1.5, C.amL);
    t(s, "90-second demo, on a real phone, against our real system", { x: 0.6, y: 4.95, w: 8.0, h: 0.45, fontSize: 16, bold: true, align: "center" });
    t(s, "Video link: [paste here]", { x: 0.6, y: 5.45, w: 8.0, h: 0.4, fontSize: 13, color: C.muted, align: "center" });
    t(s, "Watch for", { x: 9.0, y: 2.0, w: 3.7, h: 0.45, fontSize: 18, bold: true, color: C.em });
    const shows = ["Sign-up in under a minute", "Suppliers matched to the business, with the reason why", "An order paid and confirmed", "A proper invoice with a QR check", "A client signing off a builder's work"];
    s.addText(shows.map((q, j) => ({ text: q, options: { bullet: true, breakLine: j < shows.length - 1 } })),
      { x: 9.0, y: 2.55, w: 3.7, h: 3.9, fontFace: BODY, fontSize: 15.5, color: C.white, paraSpaceAfter: 11, margin: 0, valign: "top", isTextBox: true });
    foot(s, 10);
    s.addNotes(
      "DEMO (50 s): play the video, or do it live. Let it speak; don't narrate every tap.\n" +
      "Before going on: phone charged, backend + ngrok running, the health link green. Replace '[paste here]' with the real link and add it to the play button (Insert > Link).");
  }

  // ================================================================ 11. MONEY
  {
    const s = pres.addSlide(); base(s);
    kicker(s, "Business model");
    title(s, "Suppliers pay. Businesses never do.");
    const prices = [["Starter", "R299", "/month"], ["Pro", "R1,499", "/month"], ["ERP link", "R4,999", "/month + setup"], ["Digital orders", "~1%", "cash stays free"]];
    for (let i = 0; i < 4; i++) {
      const y = 1.95 + i * 1.15;
      card(s, 0.6, y, 5.1, 0.98);
      t(s, prices[i][0], { x: 0.9, y: y + 0.28, w: 2.3, h: 0.45, fontSize: 18, bold: true, color: C.muted });
      t(s, prices[i][1], { x: 2.7, y: y + 0.1, w: 1.9, h: 0.75, fontFace: TITLE, fontSize: 30, bold: true, color: i === 3 ? C.amL : C.emL, align: "right" });
      t(s, prices[i][2], { x: 4.65, y: y + 0.35, w: 1.0, h: 0.4, fontSize: 11, color: C.faint });
    }
    card(s, 6.0, 1.95, 6.7, 4.6);
    s.addChart(pres.charts.BAR, [
      { name: "Supplier subscriptions", labels: ["Year 1", "Year 2", "Year 3"], values: [16, 83, 310] },
      { name: "~1% on digital orders", labels: ["Year 1", "Year 2", "Year 3"], values: [40, 200, 800] },
    ], {
      x: 6.15, y: 2.05, w: 6.4, h: 3.75, barDir: "col", barGrouping: "stacked",
      showTitle: true, title: "Monthly revenue at year end (R thousand, estimate)", titleColor: C.white, titleFontFace: BODY, titleFontSize: 13,
      chartColors: [C.em, C.am], showValue: false,
      catAxisLabelColor: C.white, catAxisLabelFontSize: 13, valAxisHidden: true, valGridLine: { style: "none" }, catGridLine: { style: "none" },
      showLegend: true, legendPos: "b", legendColor: C.white, legendFontSize: 12, barGapWidthPct: 55,
    });
    t(s, "Y1 ≈ R56k  ·  Y2 ≈ R283k  ·  Y3 ≈ R1.1m a month", { x: 6.2, y: 5.85, w: 6.3, h: 0.35, fontSize: 14, bold: true, align: "center" });
    t(s, "15 → 60 → 200 suppliers  ·  1,000 → 5,000 → 20,000 businesses", { x: 6.2, y: 6.18, w: 6.3, h: 0.3, fontSize: 11.5, color: C.muted, align: "center" });
    foot(s, 11, "Estimates. Commission assumes ~R4,000 of digital orders per business per month.");
    s.addNotes(
      "SAY (25 s): 'Suppliers pay, businesses never do. R299 or R1,499 a month for suppliers, and about 1% only on digital orders, never on cash. End of year one: about R56,000 a month. Year three: about R1.1 million a month.'\n\n" +
      "IF ASKED how: subscriptions = supplier mix × price; commission = active businesses × ~R4,000 digital orders a month × 1%. Year 1: 5 Starter + 10 Pro suppliers, 1,000 businesses. They're estimates, and we say so.");
  }

  // ================================================================ 12. WHY WE WIN
  {
    const s = pres.addSlide(); base(s);
    kicker(s, "Competition");
    title(s, "They serve a slice. We serve it all.");
    const rows = [
      ["", "Runs the business", "Your own suppliers", "Any kind of business", "Verified payment"],
      ["WhatsApp + notebook (today)", "no", "by voice note", "yes", "no"],
      ["A wholesaler's own app (e.g. Shoprite Cash & Carry)", "no", "one wholesaler", "shops", "yes"],
      ["Payments / POS (iKhokha, Yoco)", "sales only", "no", "yes", "cards"],
      ["Bulk buying (Spazapp)", "no", "their range", "shops", "yes"],
      ["Akayza", "yes", "any supplier", "yes", "yes"],
    ];
    const last = rows.length - 1;
    s.addTable(rows.map((r, i) => r.map((c, j) => ({
      text: c,
      options: {
        fontFace: BODY, fontSize: 13.5, bold: i === 0 || j === 0 || i === last,
        color: i === last ? C.bg : i === 0 ? C.emL : j === 0 ? C.white : c === "no" ? C.faint : C.white,
        fill: { color: i === last ? C.em : i % 2 ? C.panel : C.bg }, align: j === 0 ? "left" : "center", valign: "middle",
      },
    }))), { x: 0.6, y: 1.9, w: 12.1, colW: [4.0, 2.0, 2.1, 2.0, 2.0], rowH: 0.68, border: { type: "solid", color: C.panel2, pt: 1 } });
    t(s, "And it gets smarter with use: what a business does today shapes the suppliers it's matched with tomorrow.", { x: 0.6, y: 6.2, w: 12.1, h: 0.5, fontSize: 15, italic: true, color: C.amL });
    foot(s, 12);
    s.addNotes(
      "SAY (20 s): 'Everyone serves a slice. A wholesaler's own app, like Shoprite Cash & Carry's, sells its own range. Payment apps take card payments. We serve the whole business, with the suppliers it already uses, for any kind of business. And it gets smarter with use.'\n\n" +
      "Our biggest competitor is the habit of WhatsApp and a notebook. Don't attack anyone; show the gap. We complement payment apps; we don't replace them.");
  }

  // ================================================================ 13. GO-TO-MARKET
  {
    const s = pres.addSlide(); base(s);
    kicker(s, "Go-to-market");
    title(s, "One supplier brings hundreds of businesses");
    const phases = [
      ["0-6 months", "Pilot", C.em, ["2 suppliers", "The 50-100 businesses they already serve", "A field agent at the counter and on the route"]],
      ["6-18 months", "Grow", C.amL, ["15 paying suppliers", "1,000 active businesses", "Owners invite the suppliers they use"]],
      ["18-36 months", "Scale", C.emL, ["200 suppliers, all 9 provinces", "Business associations, trade events", "Then other African markets"]],
    ];
    for (let i = 0; i < 3; i++) {
      const x = 0.6 + i * 4.1;
      card(s, x, 1.95, 3.8, 4.35);
      t(s, phases[i][0], { x: x + 0.35, y: 2.2, w: 3.1, h: 0.4, fontSize: 14, color: C.muted });
      t(s, phases[i][1], { x: x + 0.35, y: 2.6, w: 3.1, h: 0.75, fontFace: TITLE, fontSize: 32, bold: true, color: phases[i][2] });
      s.addText(phases[i][3].map((q, j) => ({ text: q, options: { bullet: true, breakLine: j < 2 } })),
        { x: x + 0.35, y: 3.55, w: 3.2, h: 2.6, fontFace: BODY, fontSize: 16, color: C.white, paraSpaceAfter: 11, margin: 0, valign: "top", isTextBox: true });
      if (i < 2) s.addShape(pres.shapes.LINE, { x: x + 3.82, y: 4.1, w: 0.26, h: 0, line: { color: C.faint, width: 1.5, endArrowType: "triangle" } });
    }
    t(s, "Suppliers are both our customer and our channel: no expensive ads, one relationship at a time.", { x: 0.6, y: 6.45, w: 12.1, h: 0.4, fontSize: 15, italic: true, color: C.em });
    foot(s, 13);
    s.addNotes(
      "SAY (20 s): 'We don't chase businesses one by one. We sign a supplier, and the supplier brings the businesses it already delivers to. Two suppliers in the pilot, fifteen in the first year, two hundred by year three.'");
  }

  // ================================================================ 14. IT'S REAL
  {
    const s = pres.addSlide(); base(s);
    kicker(s, "Traction");
    title(s, "Not an idea. It's built, and it works.");
    const nums = [["1,281", "automated system tests pass"], ["204", "app tests pass"], ["1,672", "products from 11 sample suppliers"], ["0", "card numbers ever touch our servers"]];
    for (let i = 0; i < 4; i++) {
      const x = 0.6 + i * 3.08;
      card(s, x, 1.95, 2.85, 2.0);
      t(s, nums[i][0], { x: x + 0.15, y: 2.15, w: 2.55, h: 0.95, fontFace: TITLE, fontSize: 44, bold: true, align: "center", color: i === 3 ? C.amL : C.emL });
      t(s, nums[i][1], { x: x + 0.2, y: 3.1, w: 2.45, h: 0.75, fontSize: 14, align: "center", color: C.muted });
    }
    const trl = [["TRL 4  ·  today", "Every flow works end to end in our own environment, with real payments in the provider's sandbox.", C.em], ["TRL 5-6  ·  pilot", "Real suppliers and businesses, live payments, in their own shops and sites.", C.amL], ["TRL 7+  ·  year 1", "All nine provinces; suppliers' stock systems connected.", C.emL]];
    for (let i = 0; i < 3; i++) {
      const y = 4.35 + i * 0.75;
      s.addShape(pres.shapes.OVAL, { x: 0.65, y: y + 0.1, w: 0.36, h: 0.36, fill: { color: trl[i][2] }, line: { color: trl[i][2] } });
      t(s, trl[i][0], { x: 1.2, y: y + 0.06, w: 2.9, h: 0.45, fontSize: 16, bold: true, color: trl[i][2] });
      t(s, trl[i][1], { x: 4.1, y: y + 0.06, w: 8.6, h: 0.5, fontSize: 15 });
    }
    foot(s, 14);
    s.addNotes(
      "SAY (15 s): 'This isn't a mock-up. It's built: over a thousand automated tests pass before every change, payments run end to end in the provider's sandbox, and card numbers never touch our servers. We're at TRL 4 today; the pilot takes us to 6.'\n\nIf a mentor rated the TRL differently, change it to match.");
  }

  // ================================================================ 15. THE ASK
  {
    const s = pres.addSlide(); base(s);
    kicker(s, "The ask");
    t(s, "R300,000", { x: 0.6, y: 1.05, w: 6, h: 1.4, fontFace: TITLE, fontSize: 72, bold: true, color: C.amL });
    t(s, "for a 6-month pilot", { x: 0.6, y: 2.5, w: 6, h: 0.5, fontSize: 22, bold: true });
    const gets = [["2 suppliers", "signed and live"], ["50-100 businesses", "using it every week"], ["TRL 6", "proven in real shops and sites"], ["Break-even", "at 2 suppliers on Starter (~R460/month to run)"]];
    for (let i = 0; i < 4; i++) {
      const y = 3.25 + i * 0.82;
      await disc(s, Fi.FiCheck, 0.6, y, 0.55, C.em);
      t(s, gets[i][0], { x: 1.35, y: y + 0.08, w: 2.3, h: 0.4, fontSize: 17, bold: true });
      t(s, gets[i][1], { x: 3.6, y: y + 0.1, w: 3.0, h: 0.4, fontSize: 14, color: C.muted });
    }
    card(s, 6.9, 1.2, 5.8, 5.35);
    s.addChart(pres.charts.DOUGHNUT, [{ name: "Use of funds", labels: ["Stipends for pilot businesses", "Field agent", "Data bundles", "Running costs", "POPIA review + security test", "Devices + contingency"], values: [96, 60, 60, 24, 30, 30] }], {
      x: 7.0, y: 1.3, w: 5.6, h: 5.15, holeSize: 55,
      showTitle: true, title: "Where the R300,000 goes (R thousand)", titleColor: C.white, titleFontFace: BODY, titleFontSize: 14,
      chartColors: [C.em, C.am, C.emL, "7C93B5", C.red, "C4B5FD"], showValue: true, showPercent: false, dataLabelColor: C.bg, dataLabelFontSize: 12, dataLabelFontBold: true,
      showLegend: true, legendPos: "b", legendColor: C.white, legendFontSize: 11.5,
    });
    foot(s, 15);
    s.addNotes(
      "SAY (25 s), slowly, it's the most important number: 'We're asking for R300,000 for a six-month pilot. It buys two suppliers live, fifty to a hundred businesses using it every week, and proof in real shops and sites. Running it costs about R460 a month, so two suppliers on our Starter plan already cover it.'\n\n" +
      "Use of funds: stipends R96k, field agent R60k, data R60k, running costs R24k, POPIA review + external security test R30k, devices + contingency R30k.");
  }

  // ================================================================ 15b. COSTS: START AND GROW
  {
    const s = pres.addSlide(); base(s);
    kicker(s, "What it costs");
    title(s, "Small to start. Profitable by year 3.");
    const steps = [
      ["Start", "R300k", "One-off: the 6-month pilot (the ask)", C.amL],
      ["Grow", "~R1.5m", "Raised after the pilot, to hire ahead of revenue", C.emL],
      ["Break even", "Year 2", "Suppliers' fees cover all costs", C.em],
    ];
    for (let i = 0; i < 3; i++) {
      const y = 2.0 + i * 1.5;
      card(s, 0.6, y, 5.3, 1.3);
      t(s, steps[i][0].toUpperCase(), { x: 0.85, y: y + 0.12, w: 2.2, h: 0.35, fontSize: 12, bold: true, color: C.muted, charSpacing: 2 });
      t(s, steps[i][1], { x: 0.85, y: y + 0.45, w: 2.2, h: 0.65, fontFace: TITLE, fontSize: 30, bold: true, color: steps[i][3] });
      t(s, steps[i][2], { x: 3.0, y: y + 0.2, w: 2.75, h: 0.95, fontSize: 13.5, valign: "middle" });
    }
    card(s, 6.3, 1.9, 6.4, 4.4);
    s.addChart(pres.charts.BAR, [
      { name: "Running costs", labels: ["Year 1", "Year 2", "Year 3"], values: [75, 270, 650] },
      { name: "Revenue", labels: ["Year 1", "Year 2", "Year 3"], values: [56, 283, 1100] },
    ], {
      x: 6.4, y: 2.0, w: 6.2, h: 4.2, barDir: "col", barGrouping: "clustered",
      showTitle: true, title: "A month at year end (R thousand, estimate)", titleColor: C.white, titleFontFace: BODY, titleFontSize: 13,
      chartColors: [C.red, C.em], showValue: true, dataLabelPosition: "outEnd", dataLabelColor: C.white, dataLabelFontSize: 12, dataLabelFontBold: true,
      catAxisLabelColor: C.white, catAxisLabelFontSize: 13, valAxisHidden: true, valGridLine: { style: "none" }, catGridLine: { style: "none" },
      showLegend: true, legendPos: "b", legendColor: C.white, legendFontSize: 12, barGapWidthPct: 60,
    });
    t(s, "Most of the cost is people: the team and field agents.", { x: 6.3, y: 6.4, w: 6.4, h: 0.4, fontSize: 12.5, italic: true, color: C.amL });
    foot(s, 16, "Estimates. Costs: team, field agents, sales, hosting and messaging, security and POPIA.");
    s.addNotes(
      "SAY (20 s): 'To start, R300,000 for the pilot. After the pilot we raise about R1.5 million to hire ahead of revenue. Costs grow with us, but suppliers' fees grow faster: we break even in year two, and by year three we make about R1.1 million a month against R650,000 in costs.'\n\n" +
      "IF ASKED for the breakdown (a month at year end, R thousand, estimates): team 40 / 150 / 350 (2, 5, 10 people); field agents 16 / 50 / 120 (2, 6, 15); sales and marketing 10 / 40 / 100; hosting, SMS, email, maps 5 / 15 / 40; security, POPIA, audits 4 / 15 / 40. Totals 75 / 270 / 650.\n" +
      "Why R1.5m: year 1 runs at a loss of about R20-40k a month while suppliers sign up, plus hiring the year-2 team before their revenue arrives, plus six months of safety.\n" +
      "Running costs stay low because we don't hold stock, cash or delivery vans: suppliers deliver, the payment provider holds the money.");
  }

  // ================================================================ 16. TEAM
  {
    const s = pres.addSlide(); base(s);
    kicker(s, "Team PR");
    title(s, "Builders who know the kasi");
    const team = [["Mandla", "Team lead", "Product, backend, payments and the supplier engine", C.em], ["Risuna", "Business tools", "Credit book, order book, jobs, builder network, notifications", C.amL]];
    for (let i = 0; i < 2; i++) {
      const x = 0.6 + i * 6.15;
      card(s, x, 1.95, 5.85, 3.2);
      await disc(s, Fi.FiUser, x + 0.4, 2.3, 1.35, team[i][3]);
      t(s, team[i][0], { x: x + 2.05, y: 2.35, w: 3.6, h: 0.7, fontFace: TITLE, fontSize: 32, bold: true, color: team[i][3] });
      t(s, team[i][1], { x: x + 2.05, y: 3.05, w: 3.6, h: 0.4, fontSize: 16, bold: true });
      t(s, team[i][2], { x: x + 2.05, y: 3.5, w: 3.6, h: 1.4, fontSize: 15, color: C.muted });
    }
    card(s, 0.6, 5.45, 12.1, 1.1, C.panel2);
    t(s, "Built this weekend, end to end: the app, the system behind it and real payments, with over 1,400 automated tests.", { x: 0.95, y: 5.72, w: 11.4, h: 0.6, fontSize: 16, valign: "middle" });
    foot(s, 17);
    s.addNotes("TEAM (10 s): who we are in one line each. Edit the roles to how you want to be introduced; add the DataQuest 2026 win here if you want it.");
  }

  // ================================================================ 17. THANK YOU
  {
    const s = pres.addSlide(); base(s);
    s.addImage({ data: LOGO, x: 0.75, y: 1.05, w: 1.4, h: 1.4 });
    t(s, "Thank you", { x: 0.75, y: 2.65, w: 11, h: 1.3, fontFace: TITLE, fontSize: 66, bold: true });
    t(s, "Keep it in the kasi.", { x: 0.8, y: 3.95, w: 11, h: 0.7, fontFace: TITLE, fontSize: 28, italic: true, color: C.amL });
    t(s, "R300,000  ·  6-month pilot  ·  making informal businesses visible", { x: 0.8, y: 4.95, w: 11.5, h: 0.5, fontSize: 20, bold: true, color: C.emL });
    t(s, "Akayza  ·  prepared by Team PR  ·  GKHack26", { x: 0.8, y: 6.2, w: 11, h: 0.4, fontSize: 13, color: C.faint });
    s.addNotes(
      "CLOSE (10 s), look at the panel, not the screen: 'R900 billion is moving, and nobody can see it. Akayza makes it visible, and suppliers pay for it. It's built, it works, and R300,000 puts it in real businesses. Are you buying?' Then stop talking.");
  }

  // ================================================================ APPENDIX
  const appendix = (s, n, head) => { kicker(s, "Appendix"); title(s, head); foot(s, n); };

  { // A1 architecture
    const s = pres.addSlide(); base(s); appendix(s, 19, "How it's built");
    const box = async (x, y, w, h, Comp, head, body, color) => {
      card(s, x, y, w, h);
      await disc(s, Comp, x + 0.25, y + 0.28, 0.7, color);
      t(s, head, { x: x + 1.1, y: y + 0.28, w: w - 1.3, h: 0.4, fontSize: 18, bold: true, color });
      t(s, body, { x: x + 1.1, y: y + 0.75, w: w - 1.3, h: h - 0.85, fontSize: 13.5, color: C.muted });
    };
    await box(0.6, 1.95, 3.6, 2.1, Fi.FiSmartphone, "Mobile app", "React Native + Expo (TypeScript). Android first. Secure sign-in storage; works offline at the counter.", C.em);
    await box(4.85, 1.95, 3.6, 2.1, Fi.FiServer, "API", "Python + Flask. Strict input checks, rate limits, orders that can't double. Rule-based supplier engine.", C.amL);
    await box(9.1, 1.95, 3.6, 2.1, Fi.FiDatabase, "Database", "PostgreSQL, one area per schema, versioned migrations, audit trail with no personal data.", C.emL);
    s.addShape(pres.shapes.LINE, { x: 4.25, y: 3.0, w: 0.55, h: 0, line: { color: C.em, width: 2, beginArrowType: "triangle", endArrowType: "triangle" } });
    s.addShape(pres.shapes.LINE, { x: 8.5, y: 3.0, w: 0.55, h: 0, line: { color: C.em, width: 2, beginArrowType: "triangle", endArrowType: "triangle" } });
    const svc = [[Fi.FiCreditCard, "PayFast", "payments, confirmed by 4 checks"], [Fi.FiImage, "Cloudinary", "signed photo uploads"], [Fi.FiMap, "Mapbox", "address search"], [Fi.FiMail, "Email", "codes, receipts, alerts"]];
    for (let i = 0; i < 4; i++) {
      const x = 0.6 + i * 3.08;
      card(s, x, 4.55, 2.85, 1.7, C.panel2);
      await disc(s, svc[i][0], x + 0.22, 4.78, 0.62, C.em);
      t(s, svc[i][1], { x: x + 1.0, y: 4.88, w: 1.8, h: 0.4, fontSize: 15, bold: true });
      t(s, svc[i][2], { x: x + 0.22, y: 5.55, w: 2.45, h: 0.6, fontSize: 13, color: C.muted });
    }
    s.addNotes("Only if asked. App -> API -> database; payments, photos, maps and email behind the API. Each feature is its own module, and an automated test stops one reaching into another's data.");
  }
  { // A2 security + privacy
    const s = pres.addSlide(); base(s); appendix(s, 20, "Security and data privacy");
    const items = [
      [Fi.FiLock, "Your data is yours", "Every request is limited to the owner. Anyone else's record answers 'not found'."],
      [Fi.FiSmartphone, "Simple, still safe", "Email and password; one code only on a new phone. The rest runs on our side."],
      [Fi.FiCreditCard, "No card data", "The payment provider's own page. A payment counts only after 4 checks."],
      [Fi.FiEyeOff, "POPIA by design", "Aggregates only in the engine; no names or addresses in logs; data export and account closure."],
      [Fi.FiCheckSquare, "Honest proof", "Only provider-confirmed payments are proof. The rest is the owner's own record."],
      [Fi.FiAlertTriangle, "Tested like an attacker", "Hostile-input tests on every endpoint, rate limits, OWASP API Top 10, incident plan."],
    ];
    for (let i = 0; i < 6; i++) {
      const x = 0.6 + (i % 3) * 4.1, y = 1.95 + Math.floor(i / 3) * 2.35;
      card(s, x, y, 3.8, 2.15);
      await disc(s, items[i][0], x + 0.3, y + 0.3, 0.7, i === 4 ? C.amL : C.em);
      t(s, items[i][1], { x: x + 1.15, y: y + 0.4, w: 2.5, h: 0.5, fontSize: 16, bold: true });
      t(s, items[i][2], { x: x + 0.3, y: y + 1.1, w: 3.25, h: 0.95, fontSize: 13, color: C.muted });
    }
    s.addNotes("Answer to 'won't security make it hard to use?': 'Security is invisible to the owner: email, password, and a code only on a new phone. Everything else happens on our server.'");
  }
  { // A3 roadmap + post-quantum
    const s = pres.addSlide(); base(s); appendix(s, 21, "What's next");
    const road = [
      ["Next 3 months", ["Google sign-in, phone push alerts", "Two-phone cash confirmation", "Cloudflare protection on our own domain"], C.em],
      ["Next 12 months", ["Direct links to suppliers' stock systems", "Split payouts straight to suppliers", "Share your record with a lender, by consent"], C.amL],
      ["Quantum-safe", ["Built: the owner seals their record with ML-DSA-65 (NIST FIPS 204) plus Ed25519", "A check shows any record changed or deleted", "Next: invoices and receipts too"], C.emL],
    ];
    for (let i = 0; i < 3; i++) {
      const x = 0.6 + i * 4.1;
      card(s, x, 1.95, 3.8, 4.4, i === 2 ? C.panel2 : C.panel);
      t(s, road[i][0], { x: x + 0.35, y: 2.2, w: 3.2, h: 0.5, fontFace: TITLE, fontSize: 22, bold: true, color: road[i][2] });
      s.addText(road[i][1].map((q, j) => ({ text: q, options: { bullet: true, breakLine: j < 2 } })),
        { x: x + 0.35, y: 2.95, w: 3.2, h: 3.2, fontFace: BODY, fontSize: 15.5, color: C.white, paraSpaceAfter: 11, margin: 0, valign: "top", isTextBox: true });
    }
    s.addNotes("Post-quantum (built): 'Records are meant to prove things for years, and quantum computers will break today\'s signatures. So the owner can seal their whole record with two signatures: ML-DSA-65, the NIST post-quantum standard, and Ed25519. A check shows exactly which records changed or were deleted, even straight in the database. We keep no copy of the seal, and our public keys are published so anyone can check without us.' Built and tested; invoices and receipts are next.");
  }

  await pres.writeFile({ fileName: OUT });
  console.log("wrote", OUT);
})();
