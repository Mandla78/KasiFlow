// Akayza pitch deck v3 -- 10 slides (the organisers' limit), a sales story. Team PR, GKHack26.
// Order follows the organisers' pitch tip: problem with evidence -> what we offer and how it
// works -> what it costs and what we need now -> why we stand out -> demo. The required
// sections (architecture, competitive analysis, data privacy) are all here.
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
  const title = (s, str, w = W - 1.2) => t(s, str, { x: 0.6, y: 0.8, w, h: 0.95, fontFace: TITLE, fontSize: 32, bold: true });
  const card = (s, x, y, w, h, fill = C.panel) => s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: fill }, line: { color: fill }, rectRadius: 0.12 });
  const disc = async (s, Comp, x, y, d = 0.75, color = C.em) => {
    s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: C.panel2 }, line: { color, width: 1.5 } });
    s.addImage({ data: await icon(Comp, color), x: x + d * 0.24, y: y + d * 0.24, w: d * 0.52, h: d * 0.52 });
  };
  const foot = (s, n, src, w = 10.8) => {
    s.addImage({ data: LOGO, x: W - 1.05, y: 6.88, w: 0.42, h: 0.42 });
    t(s, String(n), { x: W - 1.65, y: 6.95, w: 0.5, h: 0.3, fontSize: 10, color: C.faint, align: "right" });
    if (src) t(s, src, { x: 0.6, y: 6.93, w, h: 0.4, fontSize: 9.5, color: C.faint });
  };
  const wordmark = (s, x, y, size) =>
    s.addText([{ text: "akay", options: { color: C.white } }, { text: "za", options: { color: C.em } }],
      { x, y, w: 7, h: size / 55, fontFace: "Arial", bold: true, fontSize: size, margin: 0, isTextBox: true, valign: "top" });
  const bullets = (s, items, o) =>
    s.addText(items.map((q, j) => ({ text: q, options: { bullet: true, breakLine: j < items.length - 1 } })),
      { fontFace: BODY, color: C.white, paraSpaceAfter: 9, margin: 0, valign: "top", isTextBox: true, ...o });

  // ================================================================ 1. TITLE
  {
    const s = pres.addSlide(); base(s);
    s.addImage({ data: LOGO, x: 0.75, y: 1.1, w: 1.6, h: 1.6 });
    wordmark(s, 0.72, 2.9, 72);
    t(s, "Keep it in the kasi.", { x: 0.8, y: 4.3, w: 8, h: 0.7, fontFace: TITLE, fontSize: 30, italic: true, color: C.amL });
    t(s, "Making South Africa's informal and small businesses visible, and ready for tomorrow.", { x: 0.8, y: 5.05, w: 7.4, h: 0.8, fontSize: 18, color: C.muted });
    t(s, "Prepared by Team PR: Mandla and Risuna  ·  GKHack26  ·  27 September 2026", { x: 0.8, y: 6.35, w: 9, h: 0.4, fontSize: 13, color: C.faint });
    s.addShape(pres.shapes.OVAL, { x: 9.2, y: 0.9, w: 3.6, h: 3.6, fill: { color: C.bg }, line: { color: C.panel2, width: 2 } });
    s.addShape(pres.shapes.OVAL, { x: 10.1, y: 2.5, w: 2.9, h: 2.9, fill: { color: C.bg, transparency: 100 }, line: { color: C.em, width: 1.5, transparency: 40 } });
    s.addShape(pres.shapes.OVAL, { x: 9.0, y: 3.5, w: 2.5, h: 2.5, fill: { color: C.bg, transparency: 100 }, line: { color: C.am, width: 1.5, transparency: 40 } });
    s.addNotes(
      "SAY (5 s): 'Good morning. We're Team PR, and this is Akayza. Keep it in the kasi.' Then straight to the problem.\n\n" +
      "3-MINUTE ROUND: slides 1, 2, 3, 4 (short), 5, 6, 7, then 10 (demo). Skip 8 and 9 unless asked; they're in the deck for the judges.\n" +
      "TOP 12 (5 min, mostly demo): 2, 3, then the live demo, then 6 and 7. Keep 8 and 9 for Q&A.");
  }

  // ================================================================ 2. PROBLEM (evidence, chart, picture)
  {
    const s = pres.addSlide(); base(s);
    // Real spaza shops on the right: the trade nobody records. News photos, credited on the slide.
    const pics = ["problem_counter.png", "problem_shop.webp", "problem_shelves.webp"];
    for (let i = 0; i < 3; i++) {
      const buf = await sharp(__dirname + "/" + pics[i]).resize(946, 496, { fit: "cover", position: i === 0 ? "centre" : "centre" }).jpeg({ quality: 90 }).toBuffer();
      s.addImage({ data: "image/jpeg;base64," + buf.toString("base64"), x: 8.6, y: i * 2.52, w: 4.733, h: 2.48 });
    }
    kicker(s, "The problem");
    t(s, "R900 billion a year, hidden in plain sight", { x: 0.6, y: 0.8, w: 7.6, h: 1.25, fontFace: TITLE, fontSize: 32, bold: true });
    t(s, "About 12% of South Africa's GDP, and 1 in 5 jobs.", { x: 0.6, y: 2.05, w: 7.6, h: 0.4, fontSize: 18, color: C.amL });
    const stats = [["< 9%", "can get a bank loan", C.amL], ["80%", "are unregistered", C.em], ["57%", "run on savings and family", C.emL]];
    for (let i = 0; i < 3; i++) {
      const x = 0.6 + i * 2.6;
      card(s, x, 2.65, 2.4, 1.55);
      t(s, stats[i][0], { x: x + 0.25, y: 2.75, w: 2.0, h: 0.8, fontFace: TITLE, fontSize: 38, bold: true, color: stats[i][2] });
      t(s, stats[i][1], { x: x + 0.25, y: 3.55, w: 2.0, h: 0.65, fontSize: 14, color: C.muted });
    }
    card(s, 0.6, 4.4, 7.6, 2.35);
    s.addChart(pres.charts.BAR, [{ name: "Spaza Shop Support Fund", labels: ["Put on the table", "Reached shops"], values: [500, 179.6] }], {
      x: 0.75, y: 4.48, w: 4.6, h: 2.2, barDir: "bar",
      showTitle: true, title: "Spaza Shop Support Fund (R million)", titleColor: C.white, titleFontFace: BODY, titleFontSize: 12,
      chartColors: [C.faint, C.am], showValue: true, dataLabelPosition: "outEnd", dataLabelColor: C.white, dataLabelFontSize: 12, dataLabelFontBold: true,
      catAxisLabelColor: C.white, catAxisLabelFontSize: 12, valAxisHidden: true, valAxisMaxVal: 650, dataLabelFormatCode: "#,##0.0", valGridLine: { style: "none" }, catGridLine: { style: "none" },
      showLegend: false, barGapWidthPct: 45,
    });
    t(s, "354 applications failed verification. With no record, even help can't reach them.", { x: 5.45, y: 4.6, w: 2.55, h: 2.0, fontSize: 14, italic: true, color: C.amL, valign: "middle" });
    foot(s, 2, "Standard Bank, Oct 2025; DSBD, May 2026. Photos: Business Explainer; SABC News.", 7.7);
    s.addNotes(
      "SAY (20 s): 'R900 billion moves through South Africa's township economy every year. That's about 12% of our GDP and one in five jobs: shops, builders, food sellers, salons. And it's hidden in plain sight. Fewer than 9% of these businesses can get a bank loan. 80% are unregistered. When government put R500 million on the table for spaza shops, only R179.6 million reached them, because 354 applications couldn't be verified. With no record, even help can't reach them.'\n\n" +
      "IF ASKED where R900 bn comes from: Standard Bank's Township Informal Economy Report, October 2025, research by Foshizi, 250+ businesses in five provinces. Say 'about R900 billion', never 800. 12.3% of GDP and ~19.5% of employment: same report.\nMORE EVIDENCE if pushed: DSBD (May 2026): ~82,000 spaza shops registered, 44,696 verified, ~15,000 licensed. NIQ (Mar 2026): traditional trade ~R170.1 bn in sales, growing faster than the big chains.\n" +
      "The fund figures are specifically about spaza shops, so we name them there. WhatsApp is how they talk; it isn't the problem. The problem is that nothing turns everyday trading into a record.");
  }

  // ================================================================ 3. SOLUTION OFFERING
  {
    const s = pres.addSlide(); base(s);
    kicker(s, "What we offer");
    t(s, "One free app that makes the business visible, and ready for tomorrow", { x: 0.6, y: 0.8, w: 12.1, h: 1.1, fontFace: TITLE, fontSize: 30, bold: true });
    t(s, "It works the way they already operate, with cash and digital payments. Every digital stock order becomes a record the owner holds, and over time a strong trading history, alongside the business tools they use every day.",
      { x: 0.6, y: 1.95, w: 12.1, h: 0.8, fontSize: 15.5, color: C.muted });
    const outs = [
      ["TODAY", "Less stress", "Business tools in one place: a credit book, an order book, jobs in stages and My record.", Fi.FiSun, C.em],
      ["THIS WEEK", "Buy better, pay safely", "Order from your own suppliers, matched to what you really buy. Pay digitally or cash, get a proper invoice.", Fi.FiShoppingBag, C.amL],
      ["TOMORROW", "Ready to grow", "A sealed trading history you own and choose to share: the first step to finance and registration.", Fi.FiTrendingUp, C.emL],
    ];
    for (let i = 0; i < 3; i++) {
      const x = 0.6 + i * 4.1;
      card(s, x, 2.85, 3.8, 2.3);
      t(s, outs[i][0], { x: x + 0.3, y: 3.02, w: 2.5, h: 0.35, fontSize: 12.5, bold: true, color: outs[i][4], charSpacing: 3 });
      await disc(s, outs[i][3], x + 3.0, 2.97, 0.52, outs[i][4]);
      t(s, outs[i][1], { x: x + 0.3, y: 3.5, w: 3.3, h: 0.45, fontFace: TITLE, fontSize: 18, bold: true });
      t(s, outs[i][2], { x: x + 0.3, y: 4.0, w: 3.25, h: 1.1, fontSize: 13, color: C.muted });
    }
    const who = [
      ["USERS", "Small businesses", "Use it free, always.", C.em],
      ["CUSTOMERS", "Suppliers", "Pay a monthly fee for more orders from the businesses they already serve, paid up front, with no cash lost on the road.", C.amL],
      ["TOMORROW", "Banks and lenders", "Partnerships: a verified trading history they can trust, shared only with the owner's consent.", C.emL],
    ];
    const ws = [3.0, 5.0, 3.8], xs = [0.6, 3.75, 8.9];
    for (let i = 0; i < 3; i++) {
      card(s, xs[i], 5.3, ws[i], 1.5, C.panel2);
      t(s, who[i][0], { x: xs[i] + 0.22, y: 5.4, w: ws[i] - 0.4, h: 0.28, fontSize: 10.5, bold: true, color: C.muted, charSpacing: 2 });
      t(s, who[i][1], { x: xs[i] + 0.22, y: 5.66, w: ws[i] - 0.4, h: 0.35, fontSize: 15, bold: true, color: who[i][3] });
      t(s, who[i][2], { x: xs[i] + 0.22, y: 6.04, w: ws[i] - 0.4, h: 0.72, fontSize: 12 });
    }
    foot(s, 3, "Honest limit: only digital payments count as proof, because the payment provider confirms the money moved. Cash and the business tools are the owner's own record.", 11.2);
    s.addNotes(
      "SAY (25 s): 'That's where Akayza comes in. One free app that makes the business visible, and ready for tomorrow. It works the way they already operate, cash or digital. Every digital stock order becomes a record the owner holds, and over time a strong trading history. Today, the business tools take the stress away. This week, they buy better from their own suppliers and pay safely. Tomorrow, that history is their first step to finance. Businesses never pay. Suppliers are our customers: they pay a monthly fee because we bring them more orders, paid up front. And next, banks and lenders, as partners, only with the owner's consent.'\n\n" +
      "HONEST LIMIT (say it before a judge does): 'We only call digital payments proof, because the payment provider confirms the money moved. Cash and what an owner writes in the tools is their own record. We never add them together.'\n" +
      "We don't lend or offer credit ourselves; banks and lenders are future partners.");
  }

  // ================================================================ 4. USER JOURNEY
  {
    const s = pres.addSlide(); base(s);
    kicker(s, "User journey");
    title(s, "Thandi's week, with Akayza");
    t(s, "Thandi runs a small shop. Her customers pay her in cash, with no proof it moved. Where money can be proven is with her suppliers, so that's where Akayza starts.", { x: 0.6, y: 1.65, w: 12.1, h: 0.7, fontSize: 16, italic: true, color: C.muted });
    const days = [
      ["Monday", "Restocks in 2 minutes", "Her usual supplier, their prices, delivered. No calls, no running out.", Fi.FiTruck, C.em],
      ["Wednesday", "Records a repayment", "A customer settles his credit. She records it in her credit book, one of her business tools.", Fi.FiBookOpen, C.amL],
      ["Friday", "Pays without cash risk", "Pays the supplier in the app. The provider confirms it; the invoice arrives.", Fi.FiCreditCard, C.emL],
      ["Month end", "Sees her business", "Who owes her, what she orders most and how often, and the suppliers that fit how she buys.", Fi.FiBarChart2, C.am],
    ];
    for (let i = 0; i < 4; i++) {
      const x = 0.6 + i * 3.08;
      card(s, x, 2.55, 2.85, 3.8);
      await disc(s, days[i][3], x + 0.3, 2.82, 0.78, days[i][4]);
      t(s, days[i][0].toUpperCase(), { x: x + 0.3, y: 3.8, w: 2.4, h: 0.35, fontSize: 13, bold: true, color: days[i][4], charSpacing: 2 });
      t(s, days[i][1], { x: x + 0.3, y: 4.18, w: 2.35, h: 0.75, fontSize: 17, bold: true });
      t(s, days[i][2], { x: x + 0.3, y: 4.98, w: 2.35, h: 1.3, fontSize: 13.5, color: C.muted });
      if (i < 3) s.addShape(pres.shapes.LINE, { x: x + 2.88, y: 4.45, w: 0.18, h: 0, line: { color: C.faint, width: 1.5, endArrowType: "triangle" } });
    }
    t(s, "Same week for Sipho the builder: materials for the site from his suppliers, jobs tracked in stages.", { x: 0.6, y: 6.45, w: 12, h: 0.4, fontSize: 14, italic: true, color: C.em });
    foot(s, 4);
    s.addNotes(
      "SAY (20 s), tell it as a story: 'Meet Thandi. Her customers pay her in cash, and there's no proof that money moved. But with her suppliers there can be, so that's where we start. Monday she restocks from her usual supplier in two minutes. Wednesday a customer pays back his credit, and she records it in her credit book. Friday she pays her supplier in the app: no cash on the road, the payment is confirmed and the invoice arrives. And at month end she sees her business: who owes her, what she orders most, and the suppliers that fit how she buys.' Then: 'Any informal business has the same week, like Sipho the builder.'\n\n" +
      "We recommend suppliers, never products: the month-end view is her own numbers. Thandi and Sipho are illustrations, not real customers.");
  }

  // ================================================================ 5. MARKET + BUSINESS MODEL (+ why SA first, go-to-market)
  {
    const s = pres.addSlide(); base(s);
    kicker(s, "Market and business model");
    title(s, "Suppliers pay. Businesses use it free.");
    const rows = [
      ["R900 bn", "a year through the township economy: every informal and small business.", C.muted],
      ["R180 bn", "through spaza shops alone, already buying from suppliers every week.", C.amL],
      ["56%", "already prefer EFT. Ready for digital: why South Africa first.", C.emL],
    ];
    for (let i = 0; i < 3; i++) {
      const y = 1.95 + i * 1.12;
      t(s, rows[i][0], { x: 0.6, y, w: 2.1, h: 0.6, fontFace: TITLE, fontSize: 26, bold: true, color: rows[i][2] });
      t(s, rows[i][1], { x: 2.75, y: y + 0.03, w: 3.2, h: 1.0, fontSize: 14.5 });
    }
    card(s, 0.6, 5.4, 5.4, 1.3, C.panel2);
    t(s, [{ text: "Go-to-market  ", options: { bold: true, color: C.amL } }, { text: "Two ways in. Sign a supplier, and it brings the businesses it delivers to. Businesses invite the suppliers they already order from. 2 suppliers in the pilot, 15 in year 1, 200 by year 3.", options: { color: C.white } }],
      { x: 0.85, y: 5.47, w: 5.0, h: 1.18, fontSize: 12.5, valign: "middle" });
    const prices = [["R299", "Starter"], ["R1,499", "Pro"], ["R4,999", "Stock-system link"], ["~1%", "digital orders only"]];
    for (let i = 0; i < 4; i++) {
      const x = 6.4 + i * 1.6;
      card(s, x, 1.95, 1.48, 0.95);
      t(s, prices[i][0], { x, y: 2.02, w: 1.48, h: 0.45, fontFace: TITLE, fontSize: 19, bold: true, align: "center", color: i === 3 ? C.amL : C.emL });
      t(s, prices[i][1], { x: x + 0.05, y: 2.47, w: 1.38, h: 0.35, fontSize: 10.5, align: "center", color: C.muted });
    }
    card(s, 6.4, 3.05, 6.3, 3.65);
    s.addChart(pres.charts.BAR, [
      { name: "Supplier subscriptions", labels: ["Year 1", "Year 2", "Year 3"], values: [16, 83, 310] },
      { name: "~1% on digital orders", labels: ["Year 1", "Year 2", "Year 3"], values: [40, 200, 800] },
    ], {
      x: 6.5, y: 3.12, w: 6.1, h: 3.0, barDir: "col", barGrouping: "stacked",
      showTitle: true, title: "Revenue, a month at year end (R thousand, estimate)", titleColor: C.white, titleFontFace: BODY, titleFontSize: 12,
      chartColors: [C.em, C.am], showValue: false,
      catAxisLabelColor: C.white, catAxisLabelFontSize: 12, valAxisHidden: true, valGridLine: { style: "none" }, catGridLine: { style: "none" },
      showLegend: true, legendPos: "b", legendColor: C.white, legendFontSize: 11, barGapWidthPct: 55,
    });
    t(s, "R56k → R283k → R1.1m a month", { x: 6.5, y: 6.2, w: 6.1, h: 0.35, fontSize: 12.5, bold: true, align: "center" });
    foot(s, 5, "Standard Bank 2025 (economy, spaza segment, EFT). Revenue: our estimates; commission assumes ~R4,000 of digital orders per business a month.");
    s.addNotes(
      "SAY (25 s): 'Our users are small and informal businesses; they use it free. Our customers are suppliers. The township economy is R900 billion a year; spaza shops alone move R180 billion. And 56% already prefer EFT: that's why South Africa first. Suppliers pay us, businesses never do: R299 or R1,499 a month, and about 1% only on digital orders, never on cash. We don't chase businesses one by one: we sign a supplier, and it brings the businesses it already delivers to. And businesses invite the suppliers they already order from. End of year one, about R56,000 a month; year three, about R1.1 million.'\n\n" +
      "WHY SA FIRST (if asked): we live it; big and dense (one supplier route serves hundreds of businesses); ready for digital; clear rules (POPIA, CIPC, VAT). Then the rest of Africa.\n" +
      "HOW the revenue works: subscriptions = supplier mix × price; commission = active businesses × ~R4,000 digital orders a month × 1%. Year 1: 5 Starter + 10 Pro suppliers, 1,000 businesses. Estimates, and we say so.");
  }

  // ================================================================ 6. COSTS AND THE ASK
  {
    const s = pres.addSlide(); base(s);
    kicker(s, "What it costs, and what we need now");
    t(s, "R300,000", { x: 0.6, y: 0.85, w: 5.6, h: 1.1, fontFace: TITLE, fontSize: 60, bold: true, color: C.amL });
    t(s, "now, for a 6-month pilot", { x: 0.6, y: 1.95, w: 5.6, h: 0.45, fontSize: 20, bold: true });
    const funds = [["Stipends for pilot businesses", "R96k"], ["Field agent", "R60k"], ["Data bundles", "R60k"], ["POPIA review + security test", "R30k"], ["Devices + contingency", "R30k"], ["Running costs (6 months)", "R24k"]];
    card(s, 0.6, 2.6, 5.4, 3.0);
    for (let i = 0; i < funds.length; i++) {
      const y = 2.78 + i * 0.45;
      t(s, funds[i][0], { x: 0.9, y, w: 3.8, h: 0.4, fontSize: 14.5, color: C.muted });
      t(s, funds[i][1], { x: 4.6, y, w: 1.15, h: 0.4, fontSize: 14.5, bold: true, align: "right" });
    }
    t(s, "It buys: 2 suppliers live, 50-100 businesses every week, proof in real shops and sites (TRL 6).", { x: 0.6, y: 5.8, w: 5.4, h: 0.85, fontSize: 14, italic: true, color: C.emL });
    card(s, 6.4, 0.85, 6.3, 4.75);
    s.addChart(pres.charts.BAR, [
      { name: "Running costs", labels: ["Year 1", "Year 2", "Year 3"], values: [75, 270, 650] },
      { name: "Revenue", labels: ["Year 1", "Year 2", "Year 3"], values: [56, 283, 1100] },
    ], {
      x: 6.5, y: 0.95, w: 6.1, h: 4.55, barDir: "col", barGrouping: "clustered",
      showTitle: true, title: "Long term: a month at year end (R thousand, estimate)", titleColor: C.white, titleFontFace: BODY, titleFontSize: 12,
      chartColors: [C.red, C.em], showValue: true, dataLabelPosition: "outEnd", dataLabelColor: C.white, dataLabelFontSize: 12, dataLabelFontBold: true,
      catAxisLabelColor: C.white, catAxisLabelFontSize: 12, valAxisHidden: true, valGridLine: { style: "none" }, catGridLine: { style: "none" },
      showLegend: true, legendPos: "b", legendColor: C.white, legendFontSize: 11, barGapWidthPct: 60,
    });
    const steps = [["Start", "R300k pilot", C.amL], ["Grow", "~R1.5m after the pilot", C.emL], ["Break even", "Year 2", C.em]];
    for (let i = 0; i < 3; i++) {
      const x = 6.4 + i * 2.13;
      card(s, x, 5.8, 2.0, 0.9, C.panel2);
      t(s, steps[i][0].toUpperCase(), { x: x + 0.15, y: 5.88, w: 1.75, h: 0.3, fontSize: 10.5, bold: true, color: C.muted, charSpacing: 2 });
      t(s, steps[i][1], { x: x + 0.15, y: 6.2, w: 1.8, h: 0.4, fontSize: 13.5, bold: true, color: steps[i][2] });
    }
    foot(s, 6, "Estimates. Long-term costs: team, field agents, sales, hosting and messaging, security and POPIA.");
    s.addNotes(
      "SAY (25 s), slowly, it's the most important number: 'What do we need right now? R300,000 for a six-month pilot: two suppliers live and fifty to a hundred businesses using it every week. Most of it goes to the people on the ground. Running the system costs about R460 a month. After the pilot we raise about R1.5 million to grow; suppliers' fees overtake our costs in year two, and by year three we make about R1.1 million a month against R650,000 in costs.'\n\n" +
      "IF ASKED for the long-term breakdown (a month at year end, R thousand, estimates): team 40 / 150 / 350 (2, 5, 10 people); field agents 16 / 50 / 120; sales and marketing 10 / 40 / 100; hosting, SMS, email, maps 5 / 15 / 40; security, POPIA, audits 4 / 15 / 40. Totals 75 / 270 / 650.\n" +
      "Why R1.5m: year 1 runs at a loss while suppliers sign up, plus hiring the year-2 team before their revenue arrives, plus six months of safety.\n" +
      "Costs stay low because we hold no stock, no cash and no vans: suppliers deliver, the payment provider holds the money.");
  }

  // ================================================================ 7. COMPETITIVE ANALYSIS
  {
    const s = pres.addSlide(); base(s);
    kicker(s, "Competitive analysis");
    title(s, "They serve a slice. We serve the whole business.");
    const rows = [
      ["", "Runs the business", "Your own suppliers", "Any kind of business", "Verified payment"],
      ["WhatsApp, calls + a notebook (today)", "no", "scattered: calls, voice notes", "yes", "no"],
      ["A wholesaler's own app (e.g. Shoprite Cash & Carry)", "no", "one wholesaler", "shops", "yes"],
      ["Payments / POS (iKhokha, Yoco)", "sales only", "no", "yes", "cards"],
      ["Bulk buying (Spazapp)", "no", "their range", "shops", "yes"],
      ["Akayza", "business tools", "all your suppliers, one place", "yes", "digital, verified"],
    ];
    const last = rows.length - 1;
    s.addTable(rows.map((r, i) => r.map((c, j) => ({
      text: c,
      options: {
        fontFace: BODY, fontSize: 12.5, bold: i === 0 || j === 0 || i === last,
        color: i === last ? C.bg : i === 0 ? C.emL : j === 0 ? C.white : c === "no" ? C.faint : C.white,
        fill: { color: i === last ? C.em : i % 2 ? C.panel : C.bg }, align: j === 0 ? "left" : "center", valign: "middle",
      },
    }))), { x: 0.6, y: 1.9, w: 12.1, colW: [4.0, 2.0, 2.1, 2.0, 2.0], rowH: 0.6, border: { type: "solid", color: C.panel2, pt: 1 } });
    const edge = [["Gets smarter with use", "What a business orders and records today shapes the suppliers it's matched with tomorrow: closer, a better fit, stocking what it buys."], ["A record that holds up", "Digital payments verified by the provider, and a sealed history of stock orders that nobody can quietly change."]];
    for (let i = 0; i < 2; i++) {
      const x = 0.6 + i * 6.15;
      card(s, x, 5.95, 5.95, 0.9, C.panel2);
      t(s, [{ text: edge[i][0] + "  ", options: { bold: true, color: C.amL } }, { text: edge[i][1], options: { color: C.white } }],
        { x: x + 0.25, y: 5.98, w: 5.5, h: 0.84, fontSize: 12.5, valign: "middle" });
    }
    foot(s, 7);
    s.addNotes(
      "SAY (20 s): 'Everyone serves a slice. A wholesaler's own app, like Shoprite Cash & Carry's, sells its own range. Payment apps take card payments. We serve the whole business, with the suppliers it already uses, for any kind of business. It gets smarter with use, and it builds a record that holds up.'\n\n" +
      "Our biggest competitor is the habit: calls, voice notes and WhatsApp messages to different suppliers, nothing in one place, nothing to track. Then a notebook. Don't attack anyone; show the gap. We complement payment apps; we don't replace them. We're not a marketplace: we recommend suppliers, never products.");
  }

  // ================================================================ 8. TECHNOLOGICAL ARCHITECTURE
  {
    const s = pres.addSlide(); base(s);
    kicker(s, "Technological architecture");
    title(s, "Built, tested, and ready to pilot");
    const box = async (x, y, w, h, Comp, head, body, color) => {
      card(s, x, y, w, h);
      await disc(s, Comp, x + 0.25, y + 0.25, 0.66, color);
      t(s, head, { x: x + 1.05, y: y + 0.28, w: w - 1.25, h: 0.4, fontSize: 17, bold: true, color });
      t(s, body, { x: x + 1.05, y: y + 0.7, w: w - 1.25, h: h - 0.8, fontSize: 13, color: C.muted });
    };
    await box(0.6, 1.9, 3.6, 1.85, Fi.FiSmartphone, "Mobile app", "React Native + Expo (TypeScript). Android first; secure storage for sign-in.", C.em);
    await box(4.85, 1.9, 3.6, 1.85, Fi.FiServer, "API", "Python + Flask. Strict input checks, rate limits; the server prices every order.", C.amL);
    await box(9.1, 1.9, 3.6, 1.85, Fi.FiDatabase, "Database", "PostgreSQL, one schema per area, versioned migrations, append-only audit.", C.emL);
    s.addShape(pres.shapes.LINE, { x: 4.25, y: 2.82, w: 0.55, h: 0, line: { color: C.em, width: 2, beginArrowType: "triangle", endArrowType: "triangle" } });
    s.addShape(pres.shapes.LINE, { x: 8.5, y: 2.82, w: 0.55, h: 0, line: { color: C.em, width: 2, beginArrowType: "triangle", endArrowType: "triangle" } });
    const svc = [[Fi.FiCreditCard, "PayFast", "payments, confirmed by 4 checks"], [Fi.FiImage, "Cloudinary", "signed photo uploads"], [Fi.FiMap, "Mapbox", "addresses and distance"], [Fi.FiCpu, "Supplier engine", "rule-based, with reasons"]];
    for (let i = 0; i < 4; i++) {
      const x = 0.6 + i * 3.08;
      card(s, x, 3.95, 2.85, 1.3, C.panel2);
      await disc(s, svc[i][0], x + 0.2, 4.12, 0.56, C.em);
      t(s, svc[i][1], { x: x + 0.9, y: 4.15, w: 1.9, h: 0.4, fontSize: 14.5, bold: true });
      t(s, svc[i][2], { x: x + 0.9, y: 4.55, w: 1.9, h: 0.6, fontSize: 12, color: C.muted });
    }
    const nums = [["1,281", "system tests"], ["204", "app tests"], ["TRL 4", "today; pilot → TRL 6"], ["ML-DSA-65", "post-quantum sealed records"]];
    for (let i = 0; i < 4; i++) {
      const x = 0.6 + i * 3.08;
      t(s, nums[i][0], { x, y: 5.5, w: 2.85, h: 0.6, fontFace: TITLE, fontSize: 26, bold: true, color: i === 3 ? C.amL : C.emL });
      t(s, nums[i][1], { x, y: 6.1, w: 2.85, h: 0.4, fontSize: 13, color: C.muted });
    }
    foot(s, 8);
    s.addNotes(
      "SAY (only if there's time, 15 s): 'It's built: a phone app, an API and a database, with payments, photos and maps behind the API. Over 1,400 automated tests run before every change. And the owner can seal their record with ML-DSA-65, the NIST post-quantum standard, so a record signed today still proves itself when quantum computers arrive.'\n\n" +
      "DETAIL for Q&A: each feature is its own module; an automated architecture test stops one reaching into another's data. Seals: Ed25519 + ML-DSA-65 over a Merkle tree of every record; a check shows any record changed or deleted, even straight in the database; we keep no copy; public keys published. TRL 4 = works end to end in our environment with payments in the provider's sandbox.");
  }

  // ================================================================ 9. DATA PRIVACY POLICIES
  {
    const s = pres.addSlide(); base(s);
    kicker(s, "Data privacy");
    title(s, "POPIA by design: their data stays theirs");
    const items = [
      [Fi.FiFilter, "Collect only what's needed", "Only what a feature needs or what can be officially checked. Consent recorded at sign-up."],
      [Fi.FiLock, "Only the owner sees it", "Every request is scoped to the signed-in owner. Anyone else's record answers 'not found'."],
      [Fi.FiCreditCard, "No card data, no money held", "Cards go to the payment provider's own page. We never hold money."],
      [Fi.FiEyeOff, "Nothing personal in logs", "No names, phones or codes in logs or audits. The engine sees totals only."],
      [Fi.FiShare2, "Shared only by consent", "Suppliers see only their own orders. Banks and funds only if the owner says yes."],
      [Fi.FiClock, "Kept only as long as needed", "Unconfirmed sign-ups deleted after 7 days; records kept 5 years (tax law), then deleted."],
    ];
    for (let i = 0; i < 6; i++) {
      const x = 0.6 + (i % 3) * 4.1, y = 1.9 + Math.floor(i / 3) * 2.1;
      card(s, x, y, 3.8, 1.9);
      await disc(s, items[i][0], x + 0.3, y + 0.28, 0.66, i === 2 ? C.amL : C.em);
      t(s, items[i][1], { x: x + 1.12, y: y + 0.3, w: 2.55, h: 0.62, fontSize: 15, bold: true, valign: "middle" });
      t(s, items[i][2], { x: x + 0.3, y: y + 1.05, w: 3.25, h: 0.8, fontSize: 12.5, color: C.muted });
    }
    card(s, 0.6, 6.15, 12.1, 0.62, C.panel2);
    t(s, [{ text: "Honest proof  ", options: { bold: true, color: C.amL } }, { text: "Only a payment verified by the provider is proof. Cash is at most 'confirmed by both'; tool records are the owner's own. Never added together.", options: { color: C.white } }],
      { x: 0.85, y: 6.2, w: 11.6, h: 0.52, fontSize: 13, valign: "middle" });
    foot(s, 9);
    s.addNotes(
      "SAY (only if asked, 15 s): 'Privacy is built in, not added on. We collect only what we need or can verify. Only the owner sees their data. We never touch card numbers or hold money. Nothing personal goes into logs. Nothing is shared without consent. And we're honest about proof: only a provider-verified payment counts as proof.'\n\n" +
      "Q&A: security is invisible to the owner (email, password, a code only on a new phone). Breach plan: revoke sessions, rotate keys, tell users and the Information Regulator (POPIA s22). Data export and account closure are built on the server; the buttons come to the app next.");
  }

  // ================================================================ 10. DEMO + THANK YOU
  {
    const s = pres.addSlide(); base(s);
    kicker(s, "See it working");
    card(s, 0.6, 1.0, 6.6, 4.6, C.panel2);
    await disc(s, Fi.FiPlay, 3.2, 2.0, 1.4, C.amL);
    t(s, "90-second demo, on a real phone, against our real system", { x: 0.8, y: 3.75, w: 6.2, h: 0.45, fontSize: 15, bold: true, align: "center" });
    t(s, "Video: [paste link here]", { x: 0.8, y: 4.3, w: 6.2, h: 0.4, fontSize: 14, color: C.amL, align: "center" });
    t(s, "Home at a glance  ·  suppliers matched  ·  paid and confirmed  ·  a sealed record", { x: 0.8, y: 4.9, w: 6.2, h: 0.5, fontSize: 12, color: C.muted, align: "center" });
    s.addImage({ data: LOGO, x: 7.75, y: 1.0, w: 1.1, h: 1.1 });
    t(s, "Thank you", { x: 7.7, y: 2.3, w: 5.2, h: 1.0, fontFace: TITLE, fontSize: 50, bold: true });
    t(s, "Keep it in the kasi.", { x: 7.75, y: 3.35, w: 5.2, h: 0.6, fontFace: TITLE, fontSize: 24, italic: true, color: C.amL });
    t(s, "R300,000  ·  6-month pilot", { x: 7.75, y: 4.2, w: 5.2, h: 0.45, fontSize: 18, bold: true, color: C.emL });
    t(s, "Making informal and small businesses visible.", { x: 7.75, y: 4.7, w: 5.2, h: 0.45, fontSize: 15, color: C.muted });
    t(s, "Team PR  ·  Mandla (lead)  ·  Risuna", { x: 7.75, y: 5.9, w: 5.2, h: 0.4, fontSize: 14, color: C.white });
    foot(s, 10);
    s.addNotes(
      "DEMO (50 s): play the video, or do it live. Let it speak; don't narrate every tap. Before going on: phone charged, backend + ngrok running.\n" +
      "Replace '[paste link here]' with the real link, and link the play button too (Insert > Link).\n\n" +
      "CLOSE (10 s), look at the panel, not the screen: 'R900 billion is moving, and nobody can see it. Akayza makes it visible, and suppliers pay for it. It's built, it works, and R300,000 puts it in real businesses. Are you buying?' Then stop talking.");
  }

  await pres.writeFile({ fileName: OUT });
  console.log("wrote", OUT);
})();
