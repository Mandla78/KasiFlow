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
    // The event theme, "Build for Use: Igniting Capabilities for Markets", in our words.
    t(s, "Igniting capabilities for South Africa's informal market.", { x: 0.8, y: 5.15, w: 8.2, h: 0.45, fontSize: 19, bold: true, color: C.white });
    t(s, "Built for use by spaza shops, food sellers and builders, on the phones they already own.", { x: 0.8, y: 5.62, w: 8.0, h: 0.6, fontSize: 15, color: C.muted });
    t(s, "Prepared by Team PR  ·  GKHack26  ·  27 September 2026", { x: 0.8, y: 6.35, w: 8, h: 0.4, fontSize: 13, color: C.faint });
    // A quiet motif on the right: the three flows of the logo as rings.
    s.addShape(pres.shapes.OVAL, { x: 9.2, y: 0.9, w: 3.6, h: 3.6, fill: { color: C.bg }, line: { color: C.panel2, width: 2 } });
    s.addShape(pres.shapes.OVAL, { x: 10.1, y: 2.5, w: 2.9, h: 2.9, fill: { color: C.bg, transparency: 100 }, line: { color: C.em, width: 1.5, transparency: 40 } });
    s.addShape(pres.shapes.OVAL, { x: 9.0, y: 3.5, w: 2.5, h: 2.5, fill: { color: C.bg, transparency: 100 }, line: { color: C.am, width: 1.5, transparency: 40 } });
    s.addNotes(
      "On screen while we're introduced. Start the speech on the next slide.\n\n" +
      "THE 3-MINUTE PITCH follows the speech, slides 2-8: 0:00 the problem (2-3) · 0:28 the solution and airtime advance (4) · 0:55 the demo video, 50 s (5) · 1:45 cost and ask (6) · 2:06 why we stand out (7) · 2:27 the close (8), done by 2:50.\n" +
      "Slides 9-10 (architecture, data privacy) are for the assessors. Don't present them; open one only if a question calls for it. The rules allow 10 slides at most.");
  }

  // ================================================================ 2. HOOK
  {
    const s = newSlide();
    kicker(s, "The problem");
    t(s, "Everyone wants a piece of the informal market", { x: 0.6, y: 0.85, w: 7.9, h: 1.3, fontFace: TITLE, fontSize: 34, bold: true });
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
      "SAY (0:00-0:15): 'Everyone wants a piece of the informal market. Big retailers are moving into townships. Banks and payment apps are fighting for its customers. Because it's worth about R900 billion a year.'\n\n" +
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
    t(s, "One free app for the whole informal market", { x: 1.75, y: 0.66, w: 11.0, h: 0.8, fontFace: TITLE, fontSize: 32, bold: true });
    const rows = [
      [Fi.FiTruck, "Matched with suppliers who deliver", "Spaza shops and food sellers order from the suppliers they use, and ones that fit them.", C.em, "screen_suppliers.png"],
      [Fi.FiCamera, "Every job logged with photos", "Builders photograph each stage, and the client signs it off from a link.", C.amL, "screen_job.png"],
      [Fi.FiCheckCircle, "Payments confirmed", "Paid in the app: confirmed by the payment provider. A job stage: confirmed by both sides.", C.emL, "screen_pay.png"],
    ];
    for (let i = 0; i < 3; i++) {
      const y = 1.75 + i * 1.28;
      await disc(s, rows[i][0], 0.6, y, 0.6, rows[i][3]);
      s.addText([
        { text: rows[i][1], options: { bold: true, fontSize: 17, color: rows[i][3], breakLine: true, paraSpaceAfter: 4 } },
        { text: rows[i][2], options: { fontSize: 13.5, color: C.muted } },
      ], { x: 1.38, y: y - 0.02, w: 4.85, h: 1.2, fontFace: BODY, margin: 0, valign: "top", isTextBox: true });
      phone(s, rows[i][4], 6.59 + i * 2.13, 1.75, 3.55, i + 1, rows[i][3]);
    }
    // Airtime advance: why the record matters, in an idea everyone already knows.
    card(s, 0.6, 5.6, 12.13, 1.12, C.panel2);
    await disc(s, Fi.FiSmartphone, 0.82, 5.8, 0.72, C.amL);
    s.addText([
      { text: "Airtime advance, for business. ", options: { bold: true, color: C.amL } },
      { text: "Your network lends you airtime because it's seen that you always pay. Every paid order and signed-off job adds to a record the owner holds: the first step to credit, better suppliers and new clients.", options: { color: C.white } },
    ], { x: 1.75, y: 5.6, w: 10.8, h: 1.12, fontFace: BODY, fontSize: 14.5, margin: 0, valign: "middle", isTextBox: true });
    foot(s);
    s.addNotes(
      "SAY (0:28-0:55): 'Akayza is one free app for the whole informal market. Spaza shops and food sellers are matched with suppliers who deliver. Builders log every job with photos, and clients sign off each stage.'\n" +
      "Then, pointing at the band: 'You know airtime advance: your network lends you airtime because it's seen that you always pay. Akayza builds that kind of history for a business. Every paid order and signed-off job adds to a record the owner holds: the first step to credit, better suppliers and new clients.'\n\n" +
      "Real screens from our app on a Samsung A56, with sample suppliers and made-up customers. Honest wording: a payment made in the app is confirmed by the payment provider; a job stage is confirmed by both sides. IF ASKED 'do you lend?': 'No. We build the record, and the owner decides who sees it.'");
  }

  // ================================================================ 5. DEMO
  {
    const s = newSlide();
    kicker(s, "User journey  ·  demo");
    title(s, "Meet Sipho and Thabo");
    // The 49-second room cut is inside the deck, so the pitch never leaves PowerPoint for a
    // browser or the Wi-Fi. It's silent: the speech narrates it. autoplay_video.ps1 then sets it
    // to start by itself when the slide opens. The full 81-second version stays on Drive.
    card(s, 0.52, 1.67, 7.76, 4.435, C.panel2); // a thin frame, so the video reads as a screen
    s.addMedia({ type: "video", path: __dirname + "/demo_room.mp4", cover: "data:" + img("demo_poster.png"),
      x: 0.6, y: 1.75, w: 7.6, h: 4.275, objectName: "Demo video" });
    if (DEMO_URL) t(s, [{ text: "Full video, 81 seconds:  ", options: { bold: true, color: C.muted } }, { text: DEMO_URL, options: { hyperlink: { url: DEMO_URL, tooltip: "Watch the full demo" }, color: C.emL } }],
      { x: 0.6, y: 6.25, w: 7.7, h: 0.45, fontSize: 10 });
    // The user journey, step by step, beside the video that shows it.
    const lanes = [
      ["SIPHO  ·  KOTA SHOP", C.em, ["Picks Food seller and drops a pin where he trades", "Finds suppliers who deliver to him", "Orders bread and pays: PayFast confirms it", "Sells kotas at the counter, in his order book", "His record grows, confirmed payments marked"]],
      ["THABO  ·  BUILDER", C.amL, ["Photographs each stage of a job in the app", "The client signs off from a link: confirmed by both", "Finished jobs become his track record"]],
    ];
    let y = 1.75;
    for (const [head, color, steps] of lanes) {
      t(s, head, { x: 8.6, y, w: 4.13, h: 0.3, fontSize: 12, bold: true, color, charSpacing: 2 });
      s.addText(steps.map((q, j) => ({ text: q, options: { bullet: { type: "number" }, breakLine: j < steps.length - 1 } })),
        { x: 8.6, y: y + 0.36, w: 4.13, h: steps.length * 0.46, fontFace: BODY, fontSize: 12.5, color: C.white, paraSpaceAfter: 4, margin: 0, valign: "top", isTextBox: true });
      y += 0.36 + steps.length * 0.46 + 0.25;
    }
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
      "The 49-second video is in the deck and starts by itself when this slide opens. It's silent, so speak over it. If it doesn't start, click it (or press Alt+P). No Wi-Fi needed.\n" +
      "The steps on the right are the user journey the organisers ask for. Sipho and Thabo are illustrations of the owners we built for, not real customers. The full 81-second version with music is on Google Drive (the link under the video).");
  }

  // ================================================================ 6. MONEY AND ASK
  {
    const s = newSlide();
    kicker(s, "Business model  ·  the ask");
    title(s, "Suppliers pay. We need R300,000.");
    const prices = [["Starter", "R299", "/month"], ["Pro", "R1,499", "/month"], ["ERP link", "R4,999", "/month + setup"], ["Digital orders", "~1%", "cash stays free"]];
    for (let i = 0; i < 4; i++) {
      const y = 1.9 + i * 0.82;
      card(s, 0.6, y, 5.4, 0.7);
      t(s, prices[i][0], { x: 0.85, y: y + 0.15, w: 2.3, h: 0.4, fontSize: 16, bold: true, color: C.muted });
      t(s, prices[i][1], { x: 2.9, y: y + 0.04, w: 1.9, h: 0.62, fontFace: TITLE, fontSize: 26, bold: true, color: i === 3 ? C.amL : C.emL, align: "right" });
      t(s, prices[i][2], { x: 4.9, y: y + 0.21, w: 1.05, h: 0.35, fontSize: 10.5, color: C.faint });
    }
    t(s, "Businesses use it free. Next: lenders pay to see a business's record, only with the owner's consent.", { x: 0.6, y: 5.25, w: 5.4, h: 0.6, fontSize: 13.5, italic: true, color: C.amL });
    t(s, "Estimates: about R56,000 a month by the end of year 1, and R1.1 million a month by year 3.", { x: 0.6, y: 5.95, w: 5.4, h: 0.55, fontSize: 12, color: C.muted });
    card(s, 6.35, 1.9, 6.38, 4.75);
    t(s, "R300,000", { x: 6.65, y: 2.02, w: 5.8, h: 0.8, fontFace: TITLE, fontSize: 44, bold: true, color: C.amL });
    t(s, "for a 6-month pilot: the sum of its costs (R thousand)", { x: 6.65, y: 2.85, w: 5.9, h: 0.4, fontSize: 14.5, bold: true });
    s.addChart(pres.charts.DOUGHNUT, [{ name: "Use of funds", labels: ["Stipends for pilot businesses", "Field agent", "Data bundles", "Running costs", "POPIA review + security test", "Devices + contingency"], values: [96, 60, 60, 24, 30, 30] }], {
      x: 6.5, y: 3.25, w: 6.1, h: 2.75, holeSize: 55, showTitle: false,
      chartColors: [C.em, C.am, C.emL, "7C93B5", C.red, "C4B5FD"], showValue: true, showPercent: false, dataLabelColor: C.bg, dataLabelFontSize: 11, dataLabelFontBold: true,
      showLegend: true, legendPos: "r", legendColor: C.white, legendFontSize: 10.5,
    });
    t(s, "2 suppliers and 50-100 businesses live  ·  break-even at 2 suppliers on Starter (about R460 a month to run)", { x: 6.65, y: 6.05, w: 5.9, h: 0.5, fontSize: 11.5, color: C.muted });
    foot(s, "Estimates. Commission assumes ~R4,000 of digital orders per business per month.");
    s.addNotes(
      "SAY (1:45-2:06): 'Businesses use Akayza for free. Suppliers pay: from R299 a month, plus about 1% on digital orders, never on cash. Next, lenders pay to see a business's record, only with the owner's consent.' Then, slowly, it's the most important number: 'For a six-month pilot in Soshanguve, with 2 suppliers and 50 to 100 businesses, we need R300,000: field agents, stipends for pilot businesses, data, running costs and a POPIA review.'\n\n" +
      "Use of funds: stipends R96k, field agent R60k, data R60k, running costs R24k, POPIA review + external security test R30k, devices + contingency R30k. After the pilot it costs about R460 a month to run, so two suppliers on Starter already cover it.\n" +
      "IF ASKED how the revenue adds up: subscriptions = supplier mix × price; commission = active businesses × ~R4,000 digital orders a month × 1%. Year 1: 5 Starter + 10 Pro suppliers, 1,000 businesses. They're estimates, and we say so. Lenders are next, not revenue today.");
  }

  // ================================================================ 7. WHY WE WIN
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
      "SAY (2:06-2:27): 'Ordering apps give traders a place to buy. Payment apps take cards. Akayza gives the informal market something it's never had: a record people can trust. Payments are confirmed by the payment provider, and job stages by both sides, so it's more than a receipt. And the record belongs to the owner: nothing goes to a lender without their consent.'\n\n" +
      "Our biggest competitor is the habit of WhatsApp and a notebook. Don't attack anyone; show the gap. We complement payment apps; we don't replace them.");
  }

  // ================================================================ 8. CLOSE
  {
    const s = newSlide();
    s.addImage({ data: LOGO, x: 0.75, y: 0.7, w: 1.0, h: 1.0 });
    t(s, "In the 1950s, Richard Maponya started a milk business in Soweto. His customers trusted him, and decades later he opened Maponya Mall.",
      { x: 0.8, y: 2.0, w: 11.5, h: 0.85, fontSize: 17, color: C.muted });
    t(s, "The next Maponya is out there right now.", { x: 0.8, y: 2.95, w: 12.0, h: 0.8, fontFace: TITLE, fontSize: 36, bold: true });
    t(s, "Selling kotas. Running a spaza. Laying bricks.", { x: 0.8, y: 3.8, w: 11.5, h: 0.55, fontFace: TITLE, fontSize: 24, italic: true, color: C.amL });
    t(s, "We don't hold the stock. We build the record.", { x: 0.8, y: 4.75, w: 11.5, h: 0.5, fontSize: 20, bold: true, color: C.emL });
    t(s, "Keep it in the kasi.", { x: 0.8, y: 5.35, w: 11.5, h: 0.75, fontFace: TITLE, fontSize: 32, italic: true });
    t(s, "Thank you  ·  R300,000 for a 6-month pilot  ·  Team PR, GKHack26", { x: 0.8, y: 6.5, w: 11.5, h: 0.4, fontSize: 13, color: C.faint });
    s.addNotes(
      "SAY (2:27-2:50), look at the panel, not the screen: 'Richard Maponya started in the 1950s with a milk business in Soweto. His customers trusted him, and decades later he opened Maponya Mall. The next Maponya is out there right now: selling kotas, running a spaza, laying bricks. Everyone wants a piece of the informal market. Akayza makes sure the people who run it keep theirs. We don't hold the stock. We build the record. Keep it in the kasi.' Then stop talking.\n\n" +
      "Maponya: Dube Hygienic Dairy, early 1950s, milk delivered by young men on bicycles to homes without fridges; Maponya Mall opened in 2007 (Daily Maverick, Wikipedia).");
  }

  // ================================================================ 9. ARCHITECTURE
  {
    // The last two slides are the detail for the assessors, in their own section.
    section = "The detail";
    pres.addSection({ title: section });
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
    t(s, "On every request: HTTPS, a signed-in token, only the owner's data (anyone else's is 'not found'), strict input checks, rate limits, no double orders, and the server sets every price. 1,281 backend and 204 app tests run before every merge.",
      { x: 0.85, y: 6.12, w: 11.65, h: 0.66, fontSize: 12.5, valign: "middle" });
    foot(s);
    s.addNotes(
      "SAY (only if asked, 20 s): 'The app talks to one API over HTTPS. Inside, each area is its own module: identity, business tools, suppliers, commerce, proof and platform. An automated architecture test fails the build if one area reads another's data, and identity is sealed behind one account service. PostgreSQL sits behind it, one schema per area. Payments happen on PayFast's own page and count only after four checks; photos go straight to Cloudinary with a signature from us.'\n\n" +
      "Numbers: about 1,280 backend tests and 204 app tests run before every merge. Sealed records: the owner can seal the whole record with ML-DSA-65 (NIST FIPS 204, post-quantum) plus Ed25519, and a check shows anything changed or deleted since.");
  }

  // ================================================================ 10. DATA PRIVACY POLICY
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

  await pres.writeFile({ fileName: OUT });
  console.log("wrote", OUT);
})();
