// Akayza pitch deck v2 -- a sales story, not a manual. Team PR, GKHack26.
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const fs = require("fs");
const Fi = require("react-icons/fi");

const OUT = process.argv[2] || "Akayza_Pitch_TeamPR.pptx";
const img = (file, type = "png") => `image/${type};base64,` + fs.readFileSync(__dirname + "/" + file).toString("base64");
const LOGO = img("logo_mark.png");
// The demo video on Google Drive (anyone with the link). DEMO_URL=https://... node build.js overrides it.
const DEMO_URL = process.env.DEMO_URL || "https://drive.google.com/file/d/1yYQfVBEG-dnn-hxgRRtD5xDVw8vZV8Es/view?usp=drive_link";

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
  // Page numbers come from the slide's place in the deck, so slides can move freely.
  const foot = (s, src) => {
    s.addImage({ data: LOGO, x: W - 1.05, y: 6.88, w: 0.42, h: 0.42 });
    t(s, String(pres.slides.length), { x: W - 1.65, y: 6.95, w: 0.5, h: 0.3, fontSize: 10, color: C.faint, align: "right" });
    if (src) t(s, src, { x: 0.6, y: 6.93, w: 10.8, h: 0.4, fontSize: 9.5, color: C.faint });
  };
  const wordmark = (s, x, y, size) =>
    s.addText([{ text: "akay", options: { color: C.white } }, { text: "za", options: { color: C.em } }],
      { x, y, w: 7, h: size / 55, fontFace: "Arial", bold: true, fontSize: size, margin: 0, isTextBox: true, valign: "top" });
  // Two parts: the 3-minute pitch (slides 1-10), then the detail the organisers asked for.
  let section = "3-minute pitch";
  pres.addSection({ title: section });
  const newSlide = () => { const s = pres.addSlide({ sectionTitle: section }); base(s); return s; };
  // A phone screen from the demo recording, in a dark frame, with a step number.
  const phone = (s, file, x, y, h, n, color) => {
    const w = h * 600 / 1236; // screens are 600 x 1236 (a 1080 x 2224 phone, scaled)
    card(s, x, y, w + 0.16, h + 0.16, C.panel2);
    s.addImage({ data: img(file), x: x + 0.08, y: y + 0.08, w, h });
    if (n) {
      s.addShape(pres.shapes.OVAL, { x: x - 0.14, y: y - 0.14, w: 0.44, h: 0.44, fill: { color }, line: { color: C.bg, width: 2 } });
      t(s, String(n), { x: x - 0.14, y: y - 0.14, w: 0.44, h: 0.44, fontSize: 14, bold: true, color: C.bg, align: "center", valign: "middle" });
    }
    return w + 0.16;
  };

  // ================================================================ 1. TITLE
  {
    const s = newSlide();
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
      "On screen while we're introduced. Start the speech on the next slide.\n\n" +
      "THE 3-MINUTE PITCH follows the speech, slides 2-10: 0:00 the problem (2-3) · 0:28 the solution (4-5) · 0:55 the demo video, 50 s (6) · 1:45 cost and ask (7-8) · 2:06 why we stand out (9) · 2:27 the close (10), done by 2:50.\n" +
      "Slides 11 onwards are the detail for the assessors. Don't present them; open one only if a question calls for it.");
  }

  // ================================================================ 2. HOOK
  {
    const s = newSlide();
    kicker(s, "The problem");
    t(s, "Everyone wants a piece of the kasi economy", { x: 0.6, y: 0.85, w: 7.9, h: 1.3, fontFace: TITLE, fontSize: 34, bold: true });
    const wants = [[Fi.FiShoppingBag, "Big retailers are moving into townships"], [Fi.FiCreditCard, "Banks and payment apps are fighting for its customers"]];
    for (let i = 0; i < 2; i++) {
      const y = 2.5 + i * 0.85;
      await disc(s, wants[i][0], 0.6, y, 0.62, C.am);
      t(s, wants[i][1], { x: 1.4, y, w: 6.9, h: 0.62, fontSize: 17, valign: "middle" });
    }
    t(s, "Because it's worth about", { x: 0.6, y: 4.45, w: 7.5, h: 0.4, fontSize: 18, color: C.muted });
    t(s, "R900 billion a year", { x: 0.6, y: 4.85, w: 8.0, h: 1.0, fontFace: TITLE, fontSize: 50, bold: true, color: C.amL });
    // Real places, not stock art: a spaza shop with its supplier's truck, and a builder's site.
    const photos = [["photo_spaza.jpg", "A spaza shop, and its supplier's truck"], ["photo_builder.jpg", "A builder's site: bricks, cash and trust"]];
    for (let i = 0; i < 2; i++) {
      const y = 1.15 + i * 2.78;
      s.addImage({ data: img(photos[i][0], "jpeg"), x: 8.83, y, w: 3.9, h: 2.6 });
      s.addShape(pres.shapes.RECTANGLE, { x: 8.83, y: y + 2.2, w: 3.9, h: 0.4, fill: { color: C.bg, transparency: 25 }, line: { color: C.bg, transparency: 100 } });
      t(s, photos[i][1], { x: 8.98, y: y + 2.2, w: 3.65, h: 0.4, fontSize: 12.5, bold: true, valign: "middle" });
    }
    foot(s, "Standard Bank, Township Informal Economy Report, Oct 2025 (Foshizi; 250+ businesses, 5 provinces). Photos: HelenOnline (CC BY-SA 4.0) and Heinz-Josef Lücking (CC BY-SA 3.0 DE), Wikimedia Commons.");
    s.addNotes(
      "SAY (0:00-0:15): 'Everyone wants a piece of the kasi economy. Big retailers are moving into townships. Banks and payment apps are fighting for its customers. Because it's worth about R900 billion a year.'\n\n" +
      "R900 bn: Standard Bank's Township Informal Economy Report, October 2025 (research by Foshizi, 250+ businesses in 5 provinces). Say 'about R900 billion'. The retailer and bank lines are lived evidence: no number, so don't add one.\n\n" +
      "Photos: 'Nomonde Tuck Shop' by HelenOnline (CC BY-SA 4.0) and 'Aliwal North - Dukatole - Housebuilding Projekt' by Heinz-Josef Lücking (CC BY-SA 3.0 DE), Wikimedia Commons, resized, with our captions. Credits are also in REUSE.md.");
  }

  // ================================================================ 3. LOCKED OUT
  {
    const s = newSlide();
    kicker(s, "The problem");
    t(s, "The people who run it can't prove any of it", { x: 0.6, y: 0.8, w: 12.1, h: 0.95, fontFace: TITLE, fontSize: 32, bold: true });
    const cols = [
      [Fi.FiLock, "No finance", "It runs on cash and word of mouth. 57% use savings and family; fewer than 9% can get a bank loan.", C.am],
      [Fi.FiXCircle, "No support", "Of the R500m Spaza Shop Support Fund, R179.6m reached spaza shops. 354 applications failed verification.", C.red],
      [Fi.FiFileText, "No record", "About 80% are unregistered: every order is cash, every dispute is word against word.", C.em],
    ];
    for (let i = 0; i < 3; i++) {
      const x = 0.6 + i * 4.1;
      card(s, x, 1.9, 3.8, 4.25);
      await disc(s, cols[i][0], x + 0.3, 2.08, 0.66, cols[i][3]);
      t(s, cols[i][1], { x: x + 1.12, y: 2.2, w: 2.5, h: 0.45, fontSize: 20, bold: true });
      t(s, cols[i][2], { x: x + 0.3, y: 4.95, w: 3.2, h: 1.1, fontSize: 13, color: C.muted });
    }
    // The numbers sit in the bar labels, so "under 9%" stays "under 9%" instead of a rounded data label.
    const bars = (x, labels, values, color) => s.addChart(pres.charts.BAR, [{ name: "Share", labels, values }], {
      x: x + 0.15, y: 2.85, w: 3.5, h: 2.0, barDir: "bar", chartColors: [color], barGapWidthPct: 40,
      catAxisLabelColor: C.white, catAxisLabelFontSize: 12.5, catAxisLabelFontFace: BODY, catAxisLineShow: false,
      valAxisHidden: true, valAxisMinVal: 0, valGridLine: { style: "none" }, catGridLine: { style: "none" }, showLegend: false, showValue: false,
    });
    bars(0.6, ["Bank loan  <9%", "Savings, family  57%"], [9, 57], C.am);
    bars(4.7, ["Reached shops  R179.6m", "Fund  R500m"], [179.6, 500], C.red);
    s.addChart(pres.charts.DOUGHNUT, [{ name: "Businesses", labels: ["Unregistered", "Registered"], values: [80, 20] }], {
      x: 9.75, y: 2.85, w: 1.9, h: 1.9, holeSize: 68, chartColors: [C.em, C.faint], showLegend: false, showValue: false, showPercent: false, showLabel: false,
    });
    t(s, "80%", { x: 9.75, y: 3.45, w: 1.9, h: 0.45, fontFace: TITLE, fontSize: 24, bold: true, color: C.emL, align: "center" });
    t(s, "unregistered", { x: 9.75, y: 3.91, w: 1.9, h: 0.28, fontSize: 11, color: C.muted, align: "center" });
    t(s, "A spaza owner can't get stock on credit. A builder can't prove the houses he's built.", { x: 0.6, y: 6.28, w: 12.1, h: 0.45, fontFace: TITLE, fontSize: 18, italic: true, color: C.amL });
    foot(s, "Standard Bank, Township Informal Economy Report 2025; DSBD & dtic, Spaza Shop Support Fund update, May 2026.");
    s.addNotes(
      "SAY (0:15-0:28): 'But the people who run it can't prove any of it. It runs on cash and word of mouth. Fewer than one in ten can get a bank loan. A spaza owner can't get stock on credit, and a builder can't prove the houses he's built.'\n\n" +
      "IF ASKED: fewer than 9% can get a bank loan and 57% run on savings and family; about 80% are unregistered (Standard Bank 2025). Of the R500m Spaza Shop Support Fund, R179.6m had reached spaza shops by the end of May 2026, and 354 applications failed verification (DSBD, 29 May 2026). That number is about spaza shops only.");
  }

  // ================================================================ 4. SOLUTION
  {
    const s = newSlide();
    s.addImage({ data: LOGO, x: 0.6, y: 0.5, w: 0.9, h: 0.9 });
    t(s, "One free app for the whole kasi economy", { x: 1.75, y: 0.66, w: 10.9, h: 0.8, fontFace: TITLE, fontSize: 32, bold: true });
    const rows = [
      [Fi.FiTruck, "Matched with suppliers who deliver", "Spaza shops and food sellers order from the suppliers they use, and ones that fit them.", C.em, "screen_suppliers.png"],
      [Fi.FiCamera, "Every job logged with photos", "Builders photograph each stage, and the client signs it off from a link.", C.amL, "screen_job.png"],
      [Fi.FiCheckCircle, "Payments confirmed", "Paid in the app: confirmed by the payment provider. A job stage: confirmed by both sides.", C.emL, "screen_pay.png"],
    ];
    for (let i = 0; i < 3; i++) {
      const y = 1.9 + i * 1.5;
      await disc(s, rows[i][0], 0.6, y, 0.62, rows[i][3]);
      s.addText([
        { text: rows[i][1], options: { bold: true, fontSize: 17, color: rows[i][3], breakLine: true, paraSpaceAfter: 4 } },
        { text: rows[i][2], options: { fontSize: 13.5, color: C.muted } },
      ], { x: 1.4, y: y - 0.02, w: 3.95, h: 1.4, fontFace: BODY, margin: 0, valign: "top", isTextBox: true });
      phone(s, rows[i][4], 5.8 + i * 2.37, 1.85, 4.2, i + 1, rows[i][3]);
    }
    foot(s);
    s.addNotes(
      "SAY (0:28-0:40): 'Akayza is one free app for the whole kasi economy. Spaza shops and food sellers are matched with suppliers who deliver. Builders log every job with photos, and clients sign off each stage.'\n\n" +
      "Real screens from our app on a Samsung A56, with sample suppliers and made-up customers. Honest wording: a payment made in the app is confirmed by the payment provider; a job stage is confirmed by both sides. Never call the rest proof.");
  }

  // ================================================================ 5. AIRTIME ADVANCE
  {
    const s = newSlide();
    kicker(s, "Why it matters");
    title(s, "Airtime advance, for business");
    // Left: the idea everyone already knows.
    card(s, 0.6, 1.95, 4.3, 3.9, C.panel2);
    await disc(s, Fi.FiSmartphone, 0.95, 2.2, 0.75, C.amL);
    t(s, "YOU ALREADY KNOW IT", { x: 0.95, y: 3.1, w: 3.7, h: 0.35, fontSize: 12.5, bold: true, color: C.amL, charSpacing: 2 });
    t(s, "Your network lends you airtime because it's seen that you always pay.", { x: 0.95, y: 3.5, w: 3.7, h: 1.3, fontFace: TITLE, fontSize: 20, italic: true });
    t(s, "Akayza builds that kind of history for a business.", { x: 0.95, y: 4.9, w: 3.7, h: 0.8, fontSize: 16, bold: true, color: C.emL });
    // Right: what goes in, what it becomes, what it opens.
    const ins = [[Fi.FiCreditCard, "Paid orders", "Confirmed by the payment provider"], [Fi.FiCheckSquare, "Signed-off jobs", "Confirmed by the builder and the client"]];
    for (let i = 0; i < 2; i++) {
      const x = 5.25 + i * 3.88;
      card(s, x, 1.95, 3.6, 1.2);
      await disc(s, ins[i][0], x + 0.2, 2.24, 0.62, C.em);
      t(s, ins[i][1], { x: x + 0.98, y: 2.12, w: 2.5, h: 0.4, fontSize: 16, bold: true });
      t(s, ins[i][2], { x: x + 0.98, y: 2.5, w: 2.5, h: 0.55, fontSize: 12.5, color: C.muted });
      s.addShape(pres.shapes.LINE, { x: x + 1.8, y: 3.18, w: 0, h: 0.34, line: { color: C.faint, width: 1.5, endArrowType: "triangle" } });
    }
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 5.25, y: 3.55, w: 7.48, h: 1.1, fill: { color: C.em }, line: { color: C.em }, rectRadius: 0.12 });
    t(s, "A record the owner holds", { x: 5.55, y: 3.66, w: 6.9, h: 0.45, fontSize: 20, bold: true, color: C.bg });
    t(s, "Every paid order and signed-off job adds to it. It's shared only with the owner's consent.", { x: 5.55, y: 4.12, w: 6.9, h: 0.4, fontSize: 13, color: C.bg });
    s.addShape(pres.shapes.LINE, { x: 8.99, y: 4.68, w: 0, h: 0.34, line: { color: C.faint, width: 1.5, endArrowType: "triangle" } });
    t(s, "The first step to", { x: 5.25, y: 5.05, w: 1.7, h: 0.8, fontSize: 14, color: C.muted, valign: "middle" });
    const opens = [["Credit", C.amL], ["Better suppliers", C.em], ["New clients", C.emL]];
    for (let i = 0; i < 3; i++) {
      const x = 7.0 + i * 1.93;
      card(s, x, 5.05, 1.8, 0.8);
      t(s, opens[i][0], { x, y: 5.05, w: 1.8, h: 0.8, fontSize: 15, bold: true, color: opens[i][1], align: "center", valign: "middle" });
    }
    foot(s);
    s.addNotes(
      "SAY (0:40-0:55): 'You know airtime advance: your network lends you airtime because it's seen that you always pay. Akayza builds that kind of history for a business. Every paid order and signed-off job adds to a record the owner holds: the first step to credit, better suppliers and new clients.'\n\n" +
      "IF ASKED 'do you lend?': 'No. We build the record, and the owner decides who sees it. Lenders are next, only with the owner's consent.'");
  }

  // ================================================================ 6. DEMO
  {
    const s = newSlide();
    kicker(s, "Demo");
    title(s, "Meet Sipho and Thabo");
    card(s, 0.6, 1.95, 8.0, 4.55, C.panel2);
    await disc(s, Fi.FiPlay, 3.85, 3.2, 1.5, C.amL);
    t(s, "On a real phone, against our real system (the full video: 81 seconds)", { x: 0.6, y: 4.95, w: 8.0, h: 0.45, fontSize: 16, bold: true, align: "center" });
    if (DEMO_URL) t(s, [{ text: DEMO_URL, options: { hyperlink: { url: DEMO_URL, tooltip: "Watch the demo" } } }], { x: 0.6, y: 5.45, w: 8.0, h: 0.4, fontSize: 14, bold: true, color: C.emL, align: "center" });
    else t(s, "Video link: [paste here]", { x: 0.6, y: 5.45, w: 8.0, h: 0.4, fontSize: 13, color: C.muted, align: "center" });
    t(s, "Watch for", { x: 9.0, y: 2.0, w: 3.7, h: 0.45, fontSize: 18, bold: true, color: C.em });
    const shows = ["Sipho picks Food and drops a pin where he trades", "Suppliers who deliver to him", "Bread from a bakery that delivers, paid, confirmed by the provider", "Every kota he sells, in his order book", "Thabo's job: stage photos, signed off by the client"];
    s.addText(shows.map((q, j) => ({ text: q, options: { bullet: true, breakLine: j < shows.length - 1 } })),
      { x: 9.0, y: 2.55, w: 3.7, h: 3.9, fontFace: BODY, fontSize: 15.5, color: C.white, paraSpaceAfter: 11, margin: 0, valign: "top", isTextBox: true });
    foot(s);
    s.addNotes(
      "SAY over the video (0:55-1:45), one line per scene; let the screens breathe:\n" +
      "[Business type] 'Akayza works for any kasi business. Meet Sipho, who runs a kota shop by the taxi rank.'\n" +
      "[Location pin] 'He picks Food, and drops a pin where he trades.'\n" +
      "[Suppliers] 'Akayza shows him suppliers who deliver to him.'\n" +
      "[Order and pay] 'He orders bread from a bakery that delivers, and pays in the app. The payment provider confirms it, and his invoice arrives.'\n" +
      "[Order book] 'At the counter, every kota he sells goes in his order book.'\n" +
      "[My record] 'It all adds up in his record, with the confirmed payments marked.'\n" +
      "[Builder job] 'Now meet Thabo, a builder. Every job, stage by stage, is photographed, and the client signs off each stage from a link: confirmed by both. That's his track record.'\n\n" +
      "Before going on: phone charged, backend and the tunnel running (backend/scripts/demo_tunnel.ps1), the health link green. For the link: rebuild with DEMO_URL=<link> node build.js, or replace '[paste here]' by hand (Insert > Link).");
  }

  // ================================================================ 7. MONEY
  {
    const s = newSlide();
    kicker(s, "Business model");
    title(s, "Free for businesses. Suppliers pay.");
    const prices = [["Starter", "R299", "/month"], ["Pro", "R1,499", "/month"], ["ERP link", "R4,999", "/month + setup"], ["Digital orders", "~1%", "cash stays free"]];
    for (let i = 0; i < 4; i++) {
      const y = 1.95 + i * 1.0;
      card(s, 0.6, y, 5.1, 0.86);
      t(s, prices[i][0], { x: 0.9, y: y + 0.21, w: 2.3, h: 0.45, fontSize: 18, bold: true, color: C.muted });
      t(s, prices[i][1], { x: 2.7, y: y + 0.05, w: 1.9, h: 0.75, fontFace: TITLE, fontSize: 30, bold: true, color: i === 3 ? C.amL : C.emL, align: "right" });
      t(s, prices[i][2], { x: 4.65, y: y + 0.28, w: 1.0, h: 0.4, fontSize: 11, color: C.faint });
    }
    card(s, 6.0, 1.95, 6.7, 3.86);
    s.addChart(pres.charts.BAR, [
      { name: "Supplier subscriptions", labels: ["Year 1", "Year 2", "Year 3"], values: [16, 83, 310] },
      { name: "~1% on digital orders", labels: ["Year 1", "Year 2", "Year 3"], values: [40, 200, 800] },
    ], {
      x: 6.15, y: 2.05, w: 6.4, h: 3.0, barDir: "col", barGrouping: "stacked",
      showTitle: true, title: "Monthly revenue at year end (R thousand, estimate)", titleColor: C.white, titleFontFace: BODY, titleFontSize: 13,
      chartColors: [C.em, C.am], showValue: false,
      catAxisLabelColor: C.white, catAxisLabelFontSize: 13, valAxisHidden: true, valGridLine: { style: "none" }, catGridLine: { style: "none" },
      showLegend: true, legendPos: "b", legendColor: C.white, legendFontSize: 12, barGapWidthPct: 55,
    });
    t(s, "Y1 ≈ R56k  ·  Y2 ≈ R283k  ·  Y3 ≈ R1.1m a month", { x: 6.2, y: 5.08, w: 6.3, h: 0.35, fontSize: 14, bold: true, align: "center" });
    t(s, "15 → 60 → 200 suppliers  ·  1,000 → 5,000 → 20,000 businesses", { x: 6.2, y: 5.4, w: 6.3, h: 0.3, fontSize: 11.5, color: C.muted, align: "center" });
    card(s, 0.6, 6.05, 12.1, 0.68, C.panel2);
    await disc(s, Fi.FiUnlock, 0.78, 6.14, 0.5, C.amL);
    t(s, "Next: lenders pay to see a business's record, only with the owner's consent.", { x: 1.45, y: 6.05, w: 11.1, h: 0.68, fontSize: 15, italic: true, color: C.amL, valign: "middle" });
    foot(s, "Estimates. Commission assumes ~R4,000 of digital orders per business per month.");
    s.addNotes(
      "SAY (1:45-1:55): 'Businesses use Akayza for free. Suppliers pay: from R299 a month, plus about 1% on digital orders, never on cash. Next, lenders pay to see a business's record, only with the owner's consent.'\n\n" +
      "IF ASKED how: subscriptions = supplier mix × price; commission = active businesses × ~R4,000 digital orders a month × 1%. Year 1: 5 Starter + 10 Pro suppliers, 1,000 businesses. They're estimates, and we say so. Lenders are next, not revenue today.");
  }

  // ================================================================ 8. THE ASK
  {
    const s = newSlide();
    kicker(s, "The ask");
    t(s, "R300,000", { x: 0.6, y: 1.05, w: 6, h: 1.4, fontFace: TITLE, fontSize: 72, bold: true, color: C.amL });
    t(s, "for a 6-month pilot: the sum of its costs", { x: 0.6, y: 2.5, w: 6.1, h: 0.5, fontSize: 20, bold: true });
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
      showTitle: true, title: "What the pilot costs: R300,000 (R thousand)", titleColor: C.white, titleFontFace: BODY, titleFontSize: 14,
      chartColors: [C.em, C.am, C.emL, "7C93B5", C.red, "C4B5FD"], showValue: true, showPercent: false, dataLabelColor: C.bg, dataLabelFontSize: 12, dataLabelFontBold: true,
      showLegend: true, legendPos: "b", legendColor: C.white, legendFontSize: 11.5,
    });
    foot(s);
    s.addNotes(
      "SAY (1:55-2:06), slowly, it's the most important number: 'For a six-month pilot in Soshanguve, with 2 suppliers and 50 to 100 businesses, we need R300,000: field agents, stipends for pilot businesses, data, running costs and a POPIA review.'\n\n" +
      "Use of funds: stipends R96k, field agent R60k, data R60k, running costs R24k, POPIA review + external security test R30k, devices + contingency R30k. After the pilot it costs about R460 a month to run, so two suppliers on Starter already cover it.");
  }

  // ================================================================ 9. WHY WE WIN
  {
    const s = newSlide();
    kicker(s, "Why we stand out");
    title(s, "They sell to you. We build your record.");
    const rows = [
      ["", "Runs the business", "Your own suppliers", "Spaza shops and builders", "A record the owner holds"],
      ["WhatsApp + notebook (today)", "no", "by voice note", "yes", "a notebook"],
      ["A wholesaler's own app (e.g. Shoprite Cash & Carry)", "no", "one wholesaler", "shops", "one supplier's orders"],
      ["Payments / POS (iKhokha, Yoco)", "sales only", "no", "yes", "card sales"],
      ["Bulk buying (Spazapp)", "no", "their range", "shops", "their orders"],
      ["Akayza", "yes", "any supplier", "yes", "orders, jobs, payments"],
    ];
    const last = rows.length - 1;
    s.addTable(rows.map((r, i) => r.map((c, j) => ({
      text: c,
      options: {
        fontFace: BODY, fontSize: 13.5, bold: i === 0 || j === 0 || i === last,
        color: i === last ? C.bg : i === 0 ? C.emL : j === 0 ? C.white : c === "no" ? C.faint : C.white,
        fill: { color: i === last ? C.em : i % 2 ? C.panel : C.bg }, align: j === 0 ? "left" : "center", valign: "middle",
      },
    }))), { x: 0.6, y: 1.9, w: 12.1, colW: [4.0, 1.9, 1.9, 2.1, 2.2], rowH: 0.68, border: { type: "solid", color: C.panel2, pt: 1 } });
    t(s, "Payments are confirmed by the provider, job stages by both sides. And the record belongs to the owner: nothing goes to a lender without their consent.",
      { x: 0.6, y: 6.08, w: 12.1, h: 0.7, fontSize: 15, italic: true, color: C.amL });
    foot(s);
    s.addNotes(
      "SAY (2:06-2:27): 'Ordering apps give traders a place to buy. Payment apps take cards. Akayza gives the kasi economy something it's never had: a record people can trust. Payments are confirmed by the payment provider, and job stages by both sides, so it's more than a receipt. And the record belongs to the owner: nothing goes to a lender without their consent.'\n\n" +
      "Our biggest competitor is the habit of WhatsApp and a notebook. Don't attack anyone; show the gap. We complement payment apps; we don't replace them.");
  }

  // ================================================================ 10. CLOSE
  {
    const s = newSlide();
    s.addImage({ data: LOGO, x: 0.75, y: 0.7, w: 1.0, h: 1.0 });
    t(s, "In the 1950s, Richard Maponya started a milk round in Soweto, delivered by bicycle. His customers trusted him, and decades later he opened Maponya Mall.",
      { x: 0.8, y: 2.0, w: 11.5, h: 0.85, fontSize: 17, color: C.muted });
    t(s, "The next Maponya is out there right now.", { x: 0.8, y: 2.95, w: 12.0, h: 0.8, fontFace: TITLE, fontSize: 36, bold: true });
    t(s, "Selling kotas. Running a spaza. Laying bricks.", { x: 0.8, y: 3.8, w: 11.5, h: 0.55, fontFace: TITLE, fontSize: 24, italic: true, color: C.amL });
    t(s, "We don't hold the stock. We build the record.", { x: 0.8, y: 4.75, w: 11.5, h: 0.5, fontSize: 20, bold: true, color: C.emL });
    t(s, "Keep it in the kasi.", { x: 0.8, y: 5.35, w: 11.5, h: 0.75, fontFace: TITLE, fontSize: 32, italic: true });
    t(s, "Thank you  ·  R300,000 for a 6-month pilot  ·  Team PR, GKHack26", { x: 0.8, y: 6.5, w: 11.5, h: 0.4, fontSize: 13, color: C.faint });
    s.addNotes(
      "SAY (2:27-2:50), look at the panel, not the screen: 'Richard Maponya started in the 1950s with a milk round in Soweto, delivered by bicycle. His customers trusted him, and decades later he opened Maponya Mall. The next Maponya is out there right now: selling kotas, running a spaza, laying bricks. Everyone wants a piece of the kasi economy. Akayza makes sure the people who run it keep theirs. We don't hold the stock. We build the record. Keep it in the kasi.' Then stop talking.\n\n" +
      "Maponya: Dube Hygienic Dairy, early 1950s, milk delivered by young men on bicycles to homes without fridges; Maponya Mall opened in 2007 (Daily Maverick, Wikipedia).");
  }

  // ================================================================ 11. DETAIL
  {
    // Everything from here on is the detail for the assessors, in its own section.
    section = "The detail";
    pres.addSection({ title: section });
    const s = newSlide();
    kicker(s, "The detail");
    title(s, "Everything behind the pitch");
    t(s, "The pitch is slides 1 to 10. What follows is the detail, mapped to what the organisers asked for.", { x: 0.6, y: 1.62, w: 12.1, h: 0.4, fontSize: 16, color: C.muted });
    const map = [
      [Fi.FiAlertCircle, "Problem statement", "Evidence, charts and photos", "2, 3, 13", C.am],
      [Fi.FiSmartphone, "Solution offering", "What it is, and how it works", "4-6, 12, 15", C.em],
      [Fi.FiUser, "User journey story", "Sipho's week, and Thabo's job", "14", C.emL],
      [Fi.FiLayers, "Technological architecture", "How it's built, and kept safe", "18, 20", C.em],
      [Fi.FiBarChart2, "Competitive analysis", "Why we stand out", "9", C.amL],
      [Fi.FiEyeOff, "Data privacy policy", "What we collect, why, your rights", "19", C.emL],
      [Fi.FiDollarSign, "Costs and the ask", "Business model, pilot, break-even", "7, 8, 23", C.am],
      [Fi.FiTrendingUp, "Market and growth", "Opportunity, traction, team", "16-17, 21-24", C.em],
    ];
    for (let i = 0; i < 8; i++) {
      const x = 0.6 + (i % 2) * 6.15, y = 2.2 + Math.floor(i / 2) * 1.1;
      card(s, x, y, 5.85, 0.95);
      await disc(s, map[i][0], x + 0.2, y + 0.17, 0.6, map[i][4]);
      t(s, map[i][1], { x: x + 0.98, y: y + 0.14, w: 3.0, h: 0.36, fontSize: 15, bold: true });
      t(s, map[i][2], { x: x + 0.98, y: y + 0.52, w: 3.0, h: 0.3, fontSize: 12, color: C.muted });
      t(s, map[i][3], { x: x + 3.95, y: y + 0.24, w: 1.7, h: 0.45, fontFace: TITLE, fontSize: 16, bold: true, color: map[i][4], align: "right" });
    }
    foot(s);
    s.addNotes("Not presented in the room. A map for the assessors: each item the organisers asked for, and the slides that answer it.");
  }

  // ================================================================ 12. HOW IT WORKS (real screens)
  {
    const s = newSlide();
    kicker(s, "How it works");
    title(s, "One app, at the counter and on site");
    const shots = [
      ["screen_tools.png", "Switch on the tools your business needs", C.em],
      ["screen_suppliers.png", "Your own suppliers, and ones that fit you", C.amL],
      ["screen_pay.png", "Pay on PayFast's page, confirmed by the provider", C.emL],
      ["screen_credit.png", "Who owes you, with customers' names private", C.em],
      ["screen_job.png", "A builder's job in stages, signed off by the client", C.amL],
    ];
    for (let i = 0; i < 5; i++) {
      const x = 0.745 + i * 2.43; // five 2.13" frames, centred
      const w = phone(s, shots[i][0], x, 1.85, 4.05, i + 1, shots[i][2]);
      t(s, shots[i][1], { x, y: 6.18, w, h: 0.6, fontSize: 12, bold: true, align: "center" });
    }
    foot(s);
    s.addNotes(
      "Detail slide, not in the pitch. If asked how it works: 'The owner switches on the tools the business needs. Akayza shows the suppliers she already uses, and recommends ones that fit: suppliers, never products. She pays on PayFast's own page, and the provider confirms it. The credit book keeps who owes her. And a builder runs each job in stages, with the client signing off.'\n\n" +
      "These are real screens from our app on a Samsung A56, recorded for the demo, with sample suppliers and made-up customers.");
  }

  // ================================================================ 13. WHY IT STAYS INVISIBLE
  {
    const s = newSlide();
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
    foot(s);
    s.addNotes(
      "SAY (20 s): 'Why hasn't anyone fixed this? Because the tools were built for formal businesses: they assume a registered company, a bookkeeper, card machines. Informal businesses run on cash, trust and a phone, busy all day, buying from the same few suppliers for years. Nothing fits how they work, so nothing gets captured.'\n\n" +
      "WhatsApp is how they talk to each other; it isn't the problem. The problem is that nothing turns their everyday trading into a record.");
  }

  // ================================================================ 14. USER JOURNEY
  {
    const s = newSlide();
    kicker(s, "User journey");
    title(s, "Sipho's week, and Thabo's job");
    const lanes = [
      ["Sipho", "runs a kota shop by the taxi rank", C.em, [
        [Fi.FiMapPin, "Signs up", "Picks Food and drops a pin where he trades"],
        [Fi.FiTruck, "Finds suppliers", "Ones who deliver to him, near and recommended"],
        [Fi.FiCreditCard, "Orders and pays", "Bread from a bakery that delivers, paid in the app, confirmed by the provider"],
        [Fi.FiBarChart2, "Sees his business", "Kotas sold, stock bought, and his record growing"],
      ]],
      ["Thabo", "a builder", C.amL, [
        [Fi.FiClipboard, "Logs a job", "The client, the price and the stages"],
        [Fi.FiCamera, "Photographs each stage", "Our server keeps each photo's time and fingerprint"],
        [Fi.FiCheckSquare, "Client signs off", "From a link: the stage is confirmed by both"],
        [Fi.FiAward, "Builds a track record", "Finished jobs he can show his next client"],
      ]],
    ];
    for (let l = 0; l < 2; l++) {
      const y = 1.9 + l * 2.0, [name, sub, color, steps] = lanes[l];
      card(s, 0.6, y, 2.1, 1.75, C.panel2);
      t(s, name, { x: 0.8, y: y + 0.3, w: 1.8, h: 0.55, fontFace: TITLE, fontSize: 24, bold: true, color });
      t(s, sub, { x: 0.8, y: y + 0.9, w: 1.75, h: 1.0, fontSize: 12.5, color: C.muted });
      for (let j = 0; j < 4; j++) {
        const x = 2.9 + j * 2.47;
        card(s, x, y, 2.3, 1.75);
        await disc(s, steps[j][0], x + 0.18, y + 0.2, 0.52, color);
        t(s, steps[j][1], { x: x + 0.82, y: y + 0.16, w: 1.4, h: 0.6, fontSize: 14, bold: true, valign: "middle" });
        t(s, steps[j][2], { x: x + 0.18, y: y + 0.88, w: 1.95, h: 0.8, fontSize: 12, color: C.muted });
        if (j < 3) s.addShape(pres.shapes.LINE, { x: x + 2.31, y: y + 0.88, w: 0.15, h: 0, line: { color: C.faint, width: 1.25, endArrowType: "triangle" } });
      }
    }
    t(s, "The same journey works for a spaza shop, a salon or a mechanic.", { x: 0.6, y: 5.95, w: 12, h: 0.35, fontSize: 14, italic: true, color: C.em });
    foot(s);
    s.addNotes(
      "The user journey behind the demo. Sipho and Thabo are illustrations of the owners we built for, not real customers. If asked: 'they're the kind of owners we built for; the pilot puts real names to them.'\n" +
      "Honest status: Sipho's payment in the app is confirmed by the payment provider; his order book and credit book are his own records. Thabo's stages are confirmed by both him and the client.");
  }

  // ================================================================ 15. WHO WINS
  {
    const s = newSlide();
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
    foot(s);
    s.addNotes(
      "SAY (20 s): 'Everyone in the chain gains. Businesses use it free. Suppliers pay us, because we bring them more orders from the shops and builders they already serve and end the cash lost between the driver and the depot. And next, banks, funds and government get businesses they can finally see, only with the owner's consent.'\n\n" +
      "Partners are the roadmap, not revenue today. Our revenue is suppliers.");
  }

  // ================================================================ 16. THE OPPORTUNITY
  {
    const s = newSlide();
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
    foot(s, "Standard Bank 2025 (economy size; spaza segment ~R180 bn a year). Year-3 figures are our estimates.");
    s.addNotes(
      "SAY (20 s): 'The whole township economy is R900 billion. Spaza shops alone move about R180 billion a year: one segment, already buying every week. Our goal is 20,000 businesses and 200 paying suppliers by year three, about R13 million a year.'\n\n" +
      "R180 bn is specifically spaza shops (that's what the evidence measures), so we name them here. Everywhere else: informal and small businesses.");
  }

  // ================================================================ 17. WHY SOUTH AFRICA FIRST
  {
    const s = newSlide();
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
    foot(s, "Standard Bank 2025 (56% prefer EFT or bank transfer).");
    s.addNotes(
      "SAY (20 s): 'Why South Africa first, not Africa? Because we know this market from the inside. It's big and dense, it's already moving to digital payments (56% prefer EFT), and the rules are clear. Win here, then take the same model across the continent.'");
  }

  // ================================================================ 18. ARCHITECTURE
  {
    const s = newSlide();
    kicker(s, "Technological architecture");
    title(s, "How it's built");
    const bullets = (items, o) => s.addText(items.map((q, j) => ({ text: q, options: { bullet: true, breakLine: j < items.length - 1 } })),
      { fontFace: BODY, fontSize: 12.5, color: C.muted, paraSpaceAfter: 5, margin: 0, valign: "top", isTextBox: true, ...o });
    // The phone
    card(s, 0.6, 1.8, 2.95, 3.1);
    await disc(s, Fi.FiSmartphone, 0.85, 2.02, 0.62, C.em);
    t(s, "Mobile app", { x: 1.6, y: 2.14, w: 1.85, h: 0.4, fontSize: 17, bold: true, color: C.em });
    bullets(["React Native + Expo, TypeScript", "Android first", "Sign-in kept in secure storage", "Offline orders wait, then send once"], { x: 0.85, y: 2.85, w: 2.5, h: 1.95 });
    // The API: one module per area, and a test that keeps them apart
    card(s, 3.95, 1.8, 5.45, 3.1);
    await disc(s, Fi.FiServer, 4.2, 2.02, 0.62, C.amL);
    t(s, "API: Python + Flask", { x: 4.95, y: 2.14, w: 4.2, h: 0.4, fontSize: 17, bold: true, color: C.amL });
    const areas = [["Identity", "accounts, sign-in, devices"], ["Business tools", "credit, orders, jobs, builders"], ["Suppliers", "catalogue, the matching engine"], ["Commerce", "orders, payments, invoices"], ["Proof", "payment proof, sealed records"], ["Platform", "alerts, audit trail"]];
    for (let i = 0; i < 6; i++) {
      const x = 4.15 + (i % 2) * 2.6, y = 2.78 + Math.floor(i / 2) * 0.69;
      card(s, x, y, 2.45, 0.6, C.panel2);
      s.addText([{ text: areas[i][0], options: { bold: true, fontSize: 12, color: C.white, breakLine: true } }, { text: areas[i][1], options: { fontSize: 10, color: C.muted } }],
        { x: x + 0.14, y: y + 0.05, w: 2.25, h: 0.5, fontFace: BODY, margin: 0, valign: "middle", isTextBox: true });
    }
    // The database
    card(s, 9.8, 1.8, 2.93, 3.1);
    await disc(s, Fi.FiDatabase, 10.05, 2.02, 0.62, C.emL);
    t(s, "PostgreSQL", { x: 10.8, y: 2.14, w: 1.85, h: 0.4, fontSize: 17, bold: true, color: C.emL });
    bullets(["One schema per area", "Versioned migrations", "Audit trail with no personal data"], { x: 10.05, y: 2.85, w: 2.5, h: 1.95 });
    for (const x of [3.57, 9.42]) s.addShape(pres.shapes.LINE, { x, y: 3.35, w: 0.36, h: 0, line: { color: C.em, width: 2, beginArrowType: "triangle", endArrowType: "triangle" } });
    // Outside services, each doing one job
    t(s, "SERVICES WE USE", { x: 0.6, y: 5.02, w: 5, h: 0.25, fontSize: 11, bold: true, color: C.faint, charSpacing: 2 });
    const svc = [[Fi.FiCreditCard, "PayFast", "payments, checked 4 ways"], [Fi.FiImage, "Cloudinary", "signed photo uploads"], [Fi.FiMap, "Mapbox", "address search"], [Fi.FiMail, "Email", "codes, receipts, alerts"]];
    for (let i = 0; i < 4; i++) {
      const x = 0.6 + i * 3.08;
      card(s, x, 5.32, 2.9, 0.68);
      await disc(s, svc[i][0], x + 0.14, 5.4, 0.52, C.em);
      s.addText([{ text: svc[i][1], options: { bold: true, fontSize: 12.5, color: C.white, breakLine: true } }, { text: svc[i][2], options: { fontSize: 10.5, color: C.muted } }],
        { x: x + 0.8, y: 5.38, w: 2.02, h: 0.56, fontFace: BODY, margin: 0, valign: "middle", isTextBox: true });
    }
    card(s, 0.6, 6.12, 12.13, 0.66, C.panel2);
    t(s, "On every request: HTTPS, a signed-in token, only the owner's data (anyone else's is 'not found'), strict input checks, rate limits, no double orders, and the server sets every price.",
      { x: 0.85, y: 6.12, w: 11.65, h: 0.66, fontSize: 12.5, valign: "middle" });
    foot(s);
    s.addNotes(
      "SAY (only if asked, 20 s): 'The app talks to one API over HTTPS. Inside, each area is its own module: identity, business tools, suppliers, commerce, proof and platform. An automated architecture test fails the build if one area reads another's data, and identity is sealed behind one account service. PostgreSQL sits behind it, one schema per area. Payments happen on PayFast's own page and count only after four checks; photos go straight to Cloudinary with a signature from us.'\n\n" +
      "Numbers: about 1,280 backend tests and 204 app tests run before every merge. Sealed records: the owner can seal the whole record with ML-DSA-65 (NIST FIPS 204, post-quantum) plus Ed25519, and a check shows anything changed or deleted since.");
  }

  // ================================================================ 19. DATA PRIVACY POLICY
  {
    const s = newSlide();
    kicker(s, "Data privacy policy");
    title(s, "Your data is yours. POPIA from day one.");
    card(s, 0.6, 1.8, 7.45, 3.55);
    t(s, "What we collect, and why", { x: 0.9, y: 1.98, w: 6.9, h: 0.4, fontSize: 17, bold: true, color: C.emL });
    const rows = [
      ["Email and password (stored hashed)", "to sign you in"],
      ["Business name, type and area", "the right tools and suppliers"],
      ["A CIPC number, only if you choose", "a badge, checked on the register"],
      ["Orders and payment results", "invoices, receipts and your record"],
      ["Your tools: credit book, jobs", "yours; suppliers never see it"],
    ];
    for (let i = 0; i < 5; i++) {
      const y = 2.55 + i * 0.54;
      s.addShape(pres.shapes.OVAL, { x: 0.92, y: y + 0.13, w: 0.14, h: 0.14, fill: { color: C.em }, line: { color: C.em } });
      t(s, rows[i][0], { x: 1.2, y, w: 3.45, h: 0.4, fontSize: 13.5, valign: "middle" });
      t(s, rows[i][1], { x: 4.7, y, w: 3.2, h: 0.4, fontSize: 13, color: C.muted, valign: "middle" });
    }
    card(s, 8.3, 1.8, 4.43, 3.55, C.panel2);
    t(s, "What we never do", { x: 8.6, y: 1.98, w: 3.9, h: 0.4, fontSize: 17, bold: true, color: C.amL });
    const never = ["Ask for an ID number or passport", "See or store card numbers", "Sell your data, or use it for ads", "Show your customers' names to suppliers"];
    for (let i = 0; i < 4; i++) {
      const y = 2.55 + i * 0.66;
      await disc(s, Fi.FiX, 8.6, y, 0.44, C.amL);
      t(s, never[i], { x: 9.2, y: y - 0.06, w: 3.35, h: 0.56, fontSize: 13.5, valign: "middle" });
    }
    card(s, 0.6, 5.55, 12.13, 1.2);
    t(s, "YOUR RIGHTS", { x: 0.9, y: 5.68, w: 4, h: 0.28, fontSize: 11.5, bold: true, color: C.em, charSpacing: 2 });
    const rights = [
      ["See and download your data", "On our server today; the app button is next"],
      ["Close your account", "In the app today; every phone is signed out"],
      ["Delete your data", "Next. Tax records stay 5 years, by law"],
      ["If there's ever a breach", "We tell you and the Information Regulator"],
    ];
    for (let i = 0; i < 4; i++) {
      const x = 0.9 + i * 2.97;
      t(s, rights[i][0], { x, y: 5.98, w: 2.8, h: 0.3, fontSize: 13.5, bold: true });
      t(s, rights[i][1], { x, y: 6.28, w: 2.8, h: 0.42, fontSize: 11, color: C.muted });
    }
    foot(s, "A summary of our privacy policy (v0.2, a draft: a legal review comes before launch). Some providers store data outside South Africa, under POPIA section 72.");
    s.addNotes(
      "SAY (only if asked, 20 s): 'We collect only what the service needs, and we say why. No ID numbers, no card numbers; we never sell data or use it for ads, and suppliers never see your customers. You can download your data and close your account, and if there's ever a breach, we tell you and the Information Regulator.'\n\n" +
      "HONEST STATUS, don't claim more: data download is built on the server (GET /me/export), but the app has no button for it yet. 'Close my account' works in the app. 'Delete my account and data' says 'Coming soon'; when it comes, personal data is deleted or anonymised, and orders, invoices and payment records stay 5 years (tax law).\n" +
      "The full policy is in the app (src/content/legal/privacyPolicy.ts). Customer names in the credit book stay private to the owner; the supplier engine uses aggregates only. PayFast, Cloudinary, Mapbox and the email provider may store data outside South Africa: POPIA section 72.");
  }

  // ================================================================ 20. SECURITY
  {
    const s = newSlide();
    kicker(s, "Security");
    title(s, "Safe by design, simple to use");
    const items = [
      [Fi.FiLock, "Your data is yours", "Every request is limited to the owner. Anyone else's record answers 'not found'."],
      [Fi.FiSmartphone, "Simple, still safe", "Email and password; one code only on a new phone. The rest runs on our side."],
      [Fi.FiCreditCard, "No card data", "The payment provider's own page. A payment counts only after 4 checks."],
      [Fi.FiLink, "Signed links", "Invoice, receipt and payment links are signed and expire. A QR check shows no personal details."],
      [Fi.FiCheckSquare, "Honest proof", "Only provider-confirmed payments are proof. The rest is the owner's own record."],
      [Fi.FiAlertTriangle, "Tested like an attacker", "Hostile-input tests on every endpoint, rate limits, the OWASP API Top 10."],
    ];
    for (let i = 0; i < 6; i++) {
      const x = 0.6 + (i % 3) * 4.1, y = 1.95 + Math.floor(i / 3) * 2.35;
      card(s, x, y, 3.8, 2.15);
      await disc(s, items[i][0], x + 0.3, y + 0.3, 0.7, i === 4 ? C.amL : C.em);
      t(s, items[i][1], { x: x + 1.15, y: y + 0.4, w: 2.5, h: 0.5, fontSize: 16, bold: true });
      t(s, items[i][2], { x: x + 0.3, y: y + 1.1, w: 3.25, h: 0.95, fontSize: 13, color: C.muted });
    }
    foot(s);
    s.addNotes("Answer to 'won't security make it hard to use?': 'Security is invisible to the owner: email, password, and a code only on a new phone. Everything else happens on our server.'");
  }

  // ================================================================ 21. GO-TO-MARKET
  {
    const s = newSlide();
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
    foot(s);
    s.addNotes(
      "SAY (20 s): 'We don't chase businesses one by one. We sign a supplier, and the supplier brings the businesses it already delivers to. Two suppliers in the pilot, fifteen in the first year, two hundred by year three.'");
  }

  // ================================================================ 22. IT'S REAL
  {
    const s = newSlide();
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
    foot(s);
    s.addNotes(
      "SAY (15 s): 'This isn't a mock-up. It's built: over a thousand automated tests pass before every change, payments run end to end in the provider's sandbox, and card numbers never touch our servers. We're at TRL 4 today; the pilot takes us to 6.'\n\nIf a mentor rated the TRL differently, change it to match.");
  }

  // ================================================================ 23. COSTS: START AND GROW
  {
    const s = newSlide();
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
    foot(s, "Estimates. Costs: team, field agents, sales, hosting and messaging, security and POPIA.");
    s.addNotes(
      "SAY (20 s): 'To start, R300,000 for the pilot. After the pilot we raise about R1.5 million to hire ahead of revenue. Costs grow with us, but suppliers' fees grow faster: we break even in year two, and by year three we make about R1.1 million a month against R650,000 in costs.'\n\n" +
      "IF ASKED for the breakdown (a month at year end, R thousand, estimates): team 40 / 150 / 350 (2, 5, 10 people); field agents 16 / 50 / 120 (2, 6, 15); sales and marketing 10 / 40 / 100; hosting, SMS, email, maps 5 / 15 / 40; security, POPIA, audits 4 / 15 / 40. Totals 75 / 270 / 650.\n" +
      "Why R1.5m: year 1 runs at a loss of about R20-40k a month while suppliers sign up, plus hiring the year-2 team before their revenue arrives, plus six months of safety.\n" +
      "Running costs stay low because we don't hold stock, cash or delivery vans: suppliers deliver, the payment provider holds the money.");
  }

  // ================================================================ 24. TEAM
  {
    const s = newSlide();
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
    foot(s);
    s.addNotes("TEAM (10 s): who we are in one line each. Edit the roles to how you want to be introduced; add the DataQuest 2026 win here if you want it.");
  }

  // ================================================================ 25. WHAT'S NEXT
  {
    const s = newSlide();
    kicker(s, "What's next");
    title(s, "The road from here");
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
    foot(s);
    s.addNotes("Post-quantum (built): 'Records are meant to prove things for years, and quantum computers will break today\'s signatures. So the owner can seal their whole record with two signatures: ML-DSA-65, the NIST post-quantum standard, and Ed25519. A check shows exactly which records changed or were deleted, even straight in the database. We keep no copy of the seal, and our public keys are published so anyone can check without us.' Built and tested; invoices and receipts are next.");
  }

  await pres.writeFile({ fileName: OUT });
  console.log("wrote", OUT);
})();
