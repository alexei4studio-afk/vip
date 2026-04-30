import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { parsePrice, findMinPriceIndices } from './utils';
import type { DataRecord } from './types';

type RGB = [number, number, number];

const GOLD: RGB = [212, 175, 55];
const DARK: RGB = [29, 29, 31];
const MUTED: RGB = [134, 134, 139];
const LIGHT_BG: RGB = [245, 245, 247];
const GREEN: RGB = [52, 199, 89];
const RED: RGB = [255, 59, 48];
const WHITE: RGB = [255, 255, 255];
const BORDER: RGB = [210, 210, 215];
const ALT_ROW: RGB = [250, 250, 252];

const M = 14;
const TP = '{total_pg}';

type DataType = 'pizza' | 'national' | 'generic';

// ─── Data helpers ────────────────────────────────────────────

function detectDataType(data: DataRecord[]): DataType {
  if (data.length === 0) return 'generic';
  const first = data[0];
  if ('margherita' in first && 'diavola' in first) return 'pizza';
  if ('nume_sursa' in first || 'pret_mediu_national' in first) return 'national';
  return 'generic';
}

function isPizzaData(data: DataRecord[]): boolean {
  return (
    data.length > 0 &&
    'margherita' in data[0] &&
    'diavola' in data[0] &&
    'quattro_formaggi' in data[0]
  );
}

function parseMidpoint(val: string | number | null | undefined): number {
  if (val == null) return Infinity;
  const str = String(val);
  const m = str.match(/(\d+[.,]?\d*)\s*[-–]\s*(\d+[.,]?\d*)/);
  if (m) {
    return (parseFloat(m[1].replace(',', '.')) + parseFloat(m[2].replace(',', '.'))) / 2;
  }
  return parsePrice(val);
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function getPrices(data: DataRecord[], key: string): number[] {
  return data.map((r) => parsePrice(r[key])).filter((p) => p !== Infinity && !isNaN(p));
}

// ─── Market Position Index ───────────────────────────────────

interface MarketPosition {
  belowPct: number;
  atPct: number;
  abovePct: number;
  marketAvg: number;
  total: number;
  belowN: number;
  atN: number;
  aboveN: number;
}

function calcMarketPosition(data: DataRecord[], dt: DataType): MarketPosition {
  let prices: number[] = [];

  if (dt === 'pizza') {
    for (const k of ['margherita', 'diavola', 'quattro_formaggi']) {
      prices.push(...getPrices(data, k));
    }
  } else if (dt === 'national') {
    prices = getPrices(data, 'pret_mediu_national');
  } else {
    prices = data
      .map((r) => parseMidpoint(r.pret ?? r['Preț'] ?? r.price))
      .filter((p) => p !== Infinity);
  }

  if (prices.length === 0)
    return { belowPct: 0, atPct: 100, abovePct: 0, marketAvg: 0, total: 0, belowN: 0, atN: 0, aboveN: 0 };

  const mkt = avg(prices);
  const tol = mkt * 0.03;
  let below = 0,
    at = 0,
    above = 0;
  for (const p of prices) {
    if (p < mkt - tol) below++;
    else if (p > mkt + tol) above++;
    else at++;
  }
  const t = prices.length;
  return {
    belowPct: Math.round((below / t) * 100),
    atPct: Math.round((at / t) * 100),
    abovePct: Math.round((above / t) * 100),
    marketAvg: mkt,
    total: t,
    belowN: below,
    atN: at,
    aboveN: above,
  };
}

// ─── Top Wins / Losses ──────────────────────────────────────

interface WinLoss {
  label: string;
  detail: string;
  diff: number;
}

function calcWinsLosses(data: DataRecord[], dt: DataType): { wins: WinLoss[]; losses: WinLoss[] } {
  const items: { label: string; price: number; fee: number; total: number }[] = [];

  if (dt === 'pizza') {
    for (const r of data) {
      const fee = parsePrice(r.taxa_livrare);
      const pp = [parsePrice(r.margherita), parsePrice(r.diavola), parsePrice(r.quattro_formaggi)].filter(
        (p) => p !== Infinity,
      );
      if (fee === Infinity || pp.length === 0) continue;
      items.push({
        label: `${r.competitor} (${r.platforma})`,
        price: avg(pp),
        fee,
        total: avg(pp) + fee,
      });
    }
  } else if (dt === 'national') {
    for (const r of data) {
      const p = parsePrice(r.pret_mediu_national);
      if (p === Infinity) continue;
      items.push({ label: String(r.nume_sursa || '-'), price: p, fee: 0, total: p });
    }
  } else {
    for (const r of data) {
      const p = parseMidpoint(r.pret ?? r['Preț'] ?? r.price);
      if (p === Infinity) continue;
      items.push({
        label: String(r.produs || r.Produs || r.product || '-'),
        price: p,
        fee: 0,
        total: p,
      });
    }
  }

  if (items.length === 0) return { wins: [], losses: [] };

  const mktAvg = avg(items.map((i) => i.total));

  const mapped = items
    .map((it) => ({
      label: it.label,
      detail:
        dt === 'pizza'
          ? `${it.price.toFixed(1)} + ${it.fee.toFixed(1)} livrare = ${it.total.toFixed(1)} RON`
          : `${it.total.toFixed(1)} RON`,
      diff: it.total - mktAvg,
    }))
    .sort((a, b) => a.diff - b.diff);

  return {
    wins: mapped
      .slice(0, 3)
      .filter((w) => w.diff < 0)
      .map((w) => ({ ...w, diff: Math.abs(w.diff) })),
    losses: mapped
      .slice(-3)
      .reverse()
      .filter((l) => l.diff > 0),
  };
}

// ─── Sparkline data ──────────────────────────────────────────

interface SparkPoint {
  label: string;
  value: number;
}

interface SparkLine {
  name: string;
  points: SparkPoint[];
  color: RGB;
}

function buildSparkData(data: DataRecord[], dt: DataType): { lines: SparkLine[]; avgVal: number } {
  if (dt === 'pizza') {
    const defs: { key: string; name: string; color: RGB }[] = [
      { key: 'margherita', name: 'Margherita', color: GOLD },
      { key: 'diavola', name: 'Diavola', color: GREEN },
      { key: 'quattro_formaggi', name: 'Q. Formaggi', color: [88, 86, 214] },
    ];
    const lines = defs
      .map(({ key, name, color }) => ({
        name,
        color,
        points: data
          .map((r) => ({ label: String(r.competitor || r.platforma || '-'), value: parsePrice(r[key]) }))
          .filter((p) => p.value !== Infinity),
      }))
      .filter((l) => l.points.length > 0);
    const all = lines.flatMap((l) => l.points.map((p) => p.value));
    return { lines, avgVal: avg(all) };
  }

  if (dt === 'national') {
    const pts = data
      .map((r) => ({ label: String(r.nume_sursa || '-'), value: parsePrice(r.pret_mediu_national) }))
      .filter((p) => p.value !== Infinity);
    return { lines: [{ name: 'Preț Mediu', points: pts, color: GOLD }], avgVal: avg(pts.map((p) => p.value)) };
  }

  const pts = data
    .map((r) => ({
      label: String(r.produs || r.Produs || r.product || '-'),
      value: parseMidpoint(r.pret ?? r['Preț'] ?? r.price),
    }))
    .filter((p) => p.value !== Infinity);
  return { lines: [{ name: 'Preț', points: pts, color: GOLD }], avgVal: avg(pts.map((p) => p.value)) };
}

// ─── Drawing primitives ─────────────────────────────────────

function drawPageHeader(doc: jsPDF, clientName: string) {
  const w = doc.internal.pageSize.getWidth();

  doc.setFillColor(...LIGHT_BG);
  doc.rect(0, 0, w, 38, 'F');

  doc.setFillColor(...GOLD);
  doc.rect(M, 34, w - M * 2, 0.4, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...DARK);
  doc.text(clientName, M, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text('Executive Summary · Business Intelligence Report', M, 24);
  doc.text(new Date().toLocaleString('ro-RO'), M, 30);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...GOLD);
  doc.text('AZISUNT.VIP', w - M, 16, { align: 'right' });
}

function drawPageFooter(doc: jsPDF, pageNum: number) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(M, h - 16, w - M, h - 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text('Generat automat de AZISUNT.VIP Business Intelligence', M, h - 10);
  doc.text('Confidențial', w / 2, h - 10, { align: 'center' });
  doc.text(`Pagina ${pageNum} din ${TP}`, w - M, h - 10, { align: 'right' });
}

function sectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFillColor(...GOLD);
  doc.rect(M, y, 3, 12, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...DARK);
  doc.text(title, M + 7, y + 9);
  return y + 18;
}

function ensureSpace(doc: jsPDF, y: number, need: number, clientName: string): number {
  const maxY = doc.internal.pageSize.getHeight() - 24;
  if (y + need > maxY) {
    doc.addPage();
    drawPageHeader(doc, clientName);
    return 44;
  }
  return y;
}

// ─── Executive sections ─────────────────────────────────────

function drawMarketIndex(doc: jsPDF, pos: MarketPosition, y: number): number {
  const w = doc.internal.pageSize.getWidth();
  const cardW = w - M * 2;
  const cardH = 56;

  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(M, y, cardW, cardH, 3, 3, 'F');

  const cx = M + 10;
  const cw = cardW - 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text('INDICELE POZIȚIEI PE PIAȚĂ', cx, y + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...DARK);
  doc.text(
    `Media Pieței: ${pos.marketAvg.toFixed(1)} RON  ·  ${pos.total} prețuri analizate`,
    cx,
    y + 20,
  );

  const barY = y + 26;
  const barH = 10;

  doc.setFillColor(230, 230, 235);
  doc.roundedRect(cx, barY, cw, barH, 2, 2, 'F');

  const greenW = (pos.belowPct / 100) * cw;
  const redW = (pos.abovePct / 100) * cw;

  if (greenW > 0) {
    doc.setFillColor(...GREEN);
    doc.roundedRect(cx, barY, Math.max(greenW, 4), barH, 2, 2, 'F');
    if (greenW < cw) doc.rect(cx + greenW - 2, barY, 2, barH, 'F');
  }
  if (redW > 0) {
    doc.setFillColor(...RED);
    const rx = cx + cw - redW;
    doc.roundedRect(rx, barY, Math.max(redW, 4), barH, 2, 2, 'F');
    if (redW < cw) doc.rect(rx, barY, 2, barH, 'F');
  }

  const labY = barY + barH + 8;
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');

  doc.setTextColor(...GREEN);
  doc.text(`▼ ${pos.belowPct}% sub medie (${pos.belowN})`, cx, labY);

  doc.setTextColor(...GOLD);
  doc.text(`● ${pos.atPct}% la medie (${pos.atN})`, cx + cw * 0.35, labY);

  doc.setTextColor(...RED);
  doc.text(`▲ ${pos.abovePct}% peste medie (${pos.aboveN})`, cx + cw * 0.68, labY);

  return y + cardH + 6;
}

function drawWinsLosses(doc: jsPDF, wins: WinLoss[], losses: WinLoss[], y: number): number {
  const w = doc.internal.pageSize.getWidth();
  const halfW = (w - M * 2 - 8) / 2;
  const cardH = 58;
  const lx = M;
  const rx = M + halfW + 8;

  // Wins card
  doc.setFillColor(243, 255, 246);
  doc.roundedRect(lx, y, halfW, cardH, 3, 3, 'F');
  doc.setDrawColor(200, 240, 210);
  doc.setLineWidth(0.3);
  doc.roundedRect(lx, y, halfW, cardH, 3, 3, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...GREEN);
  doc.text('TOP AVANTAJE COMPETITIVE', lx + 8, y + 11);

  doc.setFontSize(7);
  doc.setTextColor(...DARK);
  if (wins.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MUTED);
    doc.text('Niciun avantaj semnificativ.', lx + 8, y + 22);
  } else {
    wins.forEach((item, i) => {
      const iy = y + 20 + i * 12;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...DARK);
      doc.text(`${i + 1}.`, lx + 8, iy);
      doc.setFont('helvetica', 'normal');
      const trunc = item.label.length > 22 ? item.label.substring(0, 22) + '…' : item.label;
      doc.text(trunc, lx + 14, iy);
      doc.setTextColor(...GREEN);
      doc.setFont('helvetica', 'bold');
      doc.text(`-${item.diff.toFixed(1)} RON`, lx + halfW - 8, iy, { align: 'right' });
    });
  }

  // Losses card
  doc.setFillColor(255, 243, 243);
  doc.roundedRect(rx, y, halfW, cardH, 3, 3, 'F');
  doc.setDrawColor(240, 200, 200);
  doc.setLineWidth(0.3);
  doc.roundedRect(rx, y, halfW, cardH, 3, 3, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...RED);
  doc.text('TOP PIERDERI DIN TAXE / PREȚ', rx + 8, y + 11);

  doc.setFontSize(7);
  if (losses.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MUTED);
    doc.text('Nicio pierdere semnificativă.', rx + 8, y + 22);
  } else {
    losses.forEach((item, i) => {
      const iy = y + 20 + i * 12;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...DARK);
      doc.text(`${i + 1}.`, rx + 8, iy);
      doc.setFont('helvetica', 'normal');
      const trunc = item.label.length > 22 ? item.label.substring(0, 22) + '…' : item.label;
      doc.text(trunc, rx + 14, iy);
      doc.setTextColor(...RED);
      doc.setFont('helvetica', 'bold');
      doc.text(`+${item.diff.toFixed(1)} RON`, rx + halfW - 8, iy, { align: 'right' });
    });
  }

  return y + cardH + 6;
}

function drawSparkChart(doc: jsPDF, spark: ReturnType<typeof buildSparkData>, y: number): number {
  const w = doc.internal.pageSize.getWidth();
  const cardW = w - M * 2;

  const allVals = spark.lines.flatMap((l) => l.points.map((p) => p.value));
  if (allVals.length < 2) {
    doc.setFillColor(...LIGHT_BG);
    doc.roundedRect(M, y, cardW, 30, 3, 3, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text('Date insuficiente pentru graficul de tendințe.', M + 10, y + 18);
    return y + 36;
  }

  const chartCardH = 78;
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(M, y, cardW, chartCardH, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text('TENDINȚE PREȚ COMPETITORI', M + 10, y + 10);

  const gx = M + 22;
  const gw = cardW - 34;
  const gy = y + 16;
  const gh = 38;

  const minV = Math.min(...allVals) * 0.94;
  const maxV = Math.max(...allVals) * 1.06;
  const range = maxV - minV || 1;

  // Grid lines
  doc.setDrawColor(220, 220, 225);
  doc.setLineWidth(0.15);
  for (let i = 0; i <= 4; i++) {
    const ly = gy + (gh * i) / 4;
    doc.line(gx, ly, gx + gw, ly);
    const val = maxV - (range * i) / 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(...MUTED);
    doc.text(val.toFixed(0), gx - 3, ly + 1.5, { align: 'right' });
  }

  // Average dashed line
  const avgY = gy + ((maxV - spark.avgVal) / range) * gh;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.35);
  for (let dx = gx; dx < gx + gw; dx += 4) {
    doc.line(dx, avgY, Math.min(dx + 2.5, gx + gw), avgY);
  }

  // Data lines and points
  for (const line of spark.lines) {
    const pts = line.points.slice(0, 14);
    if (pts.length === 0) continue;
    const step = gw / Math.max(pts.length - 1, 1);

    doc.setDrawColor(...line.color);
    doc.setLineWidth(0.7);
    for (let i = 0; i < pts.length - 1; i++) {
      const x1 = gx + i * step;
      const y1 = gy + ((maxV - pts[i].value) / range) * gh;
      const x2 = gx + (i + 1) * step;
      const y2 = gy + ((maxV - pts[i + 1].value) / range) * gh;
      doc.line(x1, y1, x2, y2);
    }

    doc.setFillColor(...line.color);
    for (let i = 0; i < pts.length; i++) {
      const px = gx + i * step;
      const py = gy + ((maxV - pts[i].value) / range) * gh;
      doc.circle(px, py, 1.3, 'F');
    }

    // X labels
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5);
    doc.setTextColor(...MUTED);
    for (let i = 0; i < pts.length; i++) {
      const px = gx + i * step;
      const lbl = pts[i].label.length > 10 ? pts[i].label.substring(0, 9) + '…' : pts[i].label;
      doc.text(lbl, px, gy + gh + 5, { align: 'center' });
    }
  }

  // Legend row
  const legY = y + chartCardH - 8;
  let legX = M + 10;
  doc.setFontSize(6.5);
  for (const line of spark.lines) {
    doc.setFillColor(...line.color);
    doc.circle(legX + 2, legY - 1, 1.5, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DARK);
    doc.text(line.name, legX + 5, legY);
    legX += doc.getTextWidth(line.name) + 14;
  }

  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  for (let dx = legX; dx < legX + 8; dx += 3) {
    doc.line(dx, legY - 1, dx + 2, legY - 1);
  }
  doc.setTextColor(...GOLD);
  doc.setFont('helvetica', 'normal');
  doc.text(`Medie (${spark.avgVal.toFixed(1)})`, legX + 10, legY);

  return y + chartCardH + 6;
}

// ─── Data table ──────────────────────────────────────────────

function buildTableData(data: DataRecord[], dt: DataType) {
  const pizza = isPizzaData(data);

  const columns = pizza
    ? ['Platforma', 'Competitor', 'Margherita', 'Diavola', 'Quattro Formaggi', 'Taxa livrare']
    : dt === 'national'
      ? ['Sursa', 'Preț mediu', 'Status stoc']
      : ['Produs / Platformă', 'Preț', 'Timp livrare', 'Data'];

  const priceKeys = pizza
    ? ['margherita', 'diavola', 'quattro_formaggi']
    : dt === 'national'
      ? ['pret_mediu_national']
      : ['Preț', 'pret', 'price'];

  const minSets = priceKeys.map((k) => findMinPriceIndices(data, k));

  const body = data.map((item, ri) => {
    if (pizza) {
      return [
        String(item.platforma || '-'),
        String(item.competitor || '-'),
        String(item.margherita || '-'),
        String(item.diavola || '-'),
        String(item.quattro_formaggi || '-'),
        String(item.taxa_livrare || '-'),
      ].map((val, ci) => {
        if (ci >= 2 && ci <= 4 && minSets[ci - 2]?.has(ri))
          return { content: val, styles: { textColor: GOLD, fontStyle: 'bold' as const } };
        return val;
      });
    }
    if (dt === 'national') {
      return [
        String(item.nume_sursa || '-'),
        String(item.pret_mediu_national || '-'),
        String(item.stoc_status || '-'),
      ].map((val, ci) => {
        if (ci === 1 && minSets[0]?.has(ri))
          return { content: val, styles: { textColor: GOLD, fontStyle: 'bold' as const } };
        return val;
      });
    }
    const pv = String(item['Preț'] || item.pret || item.price || '-');
    const leader = minSets.some((s) => s.has(ri));
    return [
      String(item.nume_sursa || item.Produs || item.produs || item.product || '-'),
      leader ? { content: pv, styles: { textColor: GOLD, fontStyle: 'bold' as const } } : pv,
      String(item.timp_livrare || '-'),
      String(item['Data Verificării'] || item.data || item.date || item.timestamp || '-'),
    ];
  });

  return { columns, body };
}

// ─── Main export ─────────────────────────────────────────────

export function generateExecutivePdf(
  clientName: string,
  data: DataRecord[],
  strategies: string[],
) {
  const doc = new jsPDF();
  const w = doc.internal.pageSize.getWidth();
  const dt = detectDataType(data);

  // ── Page 1: Executive Summary ──
  drawPageHeader(doc, clientName);

  let y = 44;
  y = sectionTitle(doc, 'EXECUTIVE SUMMARY', y);

  const mktPos = calcMarketPosition(data, dt);
  y = drawMarketIndex(doc, mktPos, y);

  const { wins, losses } = calcWinsLosses(data, dt);
  y = drawWinsLosses(doc, wins, losses, y);

  const spark = buildSparkData(data, dt);
  y = drawSparkChart(doc, spark, y);

  // ── Page 2+: Data Table ──
  doc.addPage();
  drawPageHeader(doc, clientName);

  let tableY = 44;
  tableY = sectionTitle(doc, 'Date Competitive Detaliate', tableY);

  const { columns, body } = buildTableData(data, dt);

  autoTable(doc, {
    head: [columns],
    body,
    startY: tableY,
    margin: { top: 48, left: M, right: M, bottom: 24 },
    styles: {
      fontSize: 9,
      cellPadding: 5,
      lineColor: BORDER,
      lineWidth: 0,
      textColor: DARK,
      font: 'helvetica',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: DARK,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 6,
    },
    alternateRowStyles: {
      fillColor: ALT_ROW,
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
    },
    didDrawPage: () => {
      const pg = doc.getNumberOfPages();
      if (pg > 2) {
        drawPageHeader(doc, clientName);
      }
    },
  });

  // ── Recommendations ──
  let recY =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? tableY;
  recY += 14;

  recY = ensureSpace(doc, recY, 50, clientName);
  recY = sectionTitle(doc, 'Recomandări Strategice', recY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 67);
  const strats = strategies.length > 0 ? strategies : ['Nu există recomandări disponibile.'];
  strats.forEach((line, i) => {
    recY = ensureSpace(doc, recY, 14, clientName);
    const bullet = `${i + 1}. ${line}`;
    const wrapped = doc.splitTextToSize(bullet, w - M * 2 - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 67);
    doc.text(wrapped, M + 7, recY);
    recY += wrapped.length * 5.5 + 2;
  });

  // ── Footer on every page ──
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawPageFooter(doc, i);
  }
  doc.putTotalPages(TP);

  doc.save(`raport_executive_${clientName.replace(/\s+/g, '_').toLowerCase()}.pdf`);
}
