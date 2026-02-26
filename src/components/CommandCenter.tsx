import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from "react";
import { Zap } from "lucide-react";
import { buildMarketContext, detectSymbols, type MarketVisualData } from "@/services/marketData";
import { useBurn } from "@/hooks/useBurn";
import BurnConfirmModal from "@/components/BurnConfirmModal";
import { GPU_CONFIG, AI_MODELS } from "@/config/platform";

const VLLM_BASE = import.meta.env.VITE_VLLM_BASE || "/api";
const VLLM_URL = `${VLLM_BASE}/chat`;

const SYSTEM_PROMPT = `You are MONTRA — an elite quantitative crypto trading AI built for institutional-grade analysis on the Base blockchain.

RESPONSE FORMAT (every response, no exceptions):

### SIGNAL MATRIX
| Signal | Reading | Weight |
|--------|---------|--------|
| Whale Flow | Accumulating/Distributing/Neutral | High/Med/Low |
| Smart Money | Bullish/Bearish/Neutral | High/Med/Low |
| Derivatives | Overleveraged Longs/Shorts/Balanced | High/Med/Low |
| Volatility | Calm/Normal/Elevated | Med |
| Order Flow | Net Buying/Selling/Mixed | Med |

### TRADE CALL
**Direction:** BUY/SELL [COIN]
**Conviction:** 0.XX/1.00
**Entry:** $XX,XXX (limit at support/resistance)
**Target:** $XX,XXX (+X.X%)
**Stop:** $XX,XXX (-X.X%)
**R:R:** X.X:1
**Size:** X% of account ($XXX on $5K)

### THESIS
2-3 sentences explaining WHY this trade makes sense in plain English. Tell the trader: (1) what the big money is doing and why that matters, (2) what makes this entry level attractive, and (3) what would invalidate this trade. Be specific — reference price levels, whale behavior, or market conditions.

*Not financial advice. Manage your risk.*

STRICT RULES:
1. ALWAYS use the EXACT format above — Signal Matrix + Trade Call + Thesis. EXCEPTION: If the user asks a purely educational question, skip the trade format and give a brief 2-3 sentence answer, then suggest a trade setup.
2. ALWAYS give a directional trade — BUY or SELL. NEVER say "HOLD", "WAIT", "NO TRADE". Mixed signals = lower conviction (0.45-0.55) + smaller size (1-2%).
3. CONSISTENCY: Count the bullish vs bearish signals in YOUR Signal Matrix. If more bearish → SELL. If more bullish → BUY. The Trade Call must NEVER contradict your own Signal Matrix.
4. R:R MINIMUM 2:1. Use limit order near support (buys) or resistance (sells).
5. THESIS = 2-3 sentences. Explain the WHY.
6. BANNED: funding rate, OI, open interest, ATR, CVD, L/S ratio, leverage ratio, implied volatility. Use plain English.
7. Conviction: 0.45-0.58 mixed, 0.60-0.72 moderate, 0.75-0.88 strong.
8. Under 200 words total.
9. COIN RULE: Trade the SPECIFIC coin the user asked about. NEVER substitute.
10. Entry, Target, and Stop MUST be real dollar prices — NEVER "N/A".
11. COMPARISON RULE: If comparing coins, pick the STRONGEST and explain why.`;

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  projections?: MarketVisualData[];
}

const QUICK_ACTIONS = [
  { label: "BTC Trade", prompt: "Should I buy or sell BTC right now? Give me the full trade." },
  { label: "ETH Trade", prompt: "Should I buy or sell ETH right now? Give me the full trade." },
  { label: "Best Trade", prompt: "What's the single best crypto trade right now?" },
  { label: "$5K Play", prompt: "I have a $5K account. What's my best trade right now? Tell me the exact dollar amount." },
];

const ANALYSIS_STEPS = [
  { text: "Scanning whale wallets & exchange flows", duration: 600 },
  { text: "Analyzing derivatives positioning", duration: 500 },
  { text: "Processing on-chain signals", duration: 400 },
  { text: "Running Monte Carlo price simulation", duration: 700 },
  { text: "Calculating optimal entry & position size", duration: 500 },
  { text: "Synthesizing trade recommendation", duration: 400 },
];

function cleanJargon(text: string): string {
  return text
    .replace(/\bfunding rate\b/gi, "holding cost")
    .replace(/\bOI\b/g, "market interest")
    .replace(/\bopen interest\b/gi, "market interest")
    .replace(/\bL\/S ratio\b/gi, "buyer/seller balance")
    .replace(/\blong[\s-]short ratio\b/gi, "buyer/seller balance")
    .replace(/\bcascade\b/gi, "chain reaction")
    .replace(/\bregime\b/gi, "phase")
    .replace(/\bKelly\b/g, "optimal")
    .replace(/\bcompression breakout\b/gi, "price squeeze")
    .replace(/\bleverage ratio\b/gi, "borrowed money level")
    .replace(/\bimplied volatility\b/gi, "expected price swings")
    .replace(/\bATR\b/g, "price range")
    .replace(/\baverage true range\b/gi, "price range")
    .replace(/\bCVD\b/g, "buy/sell volume")
    .replace(/\bcumulative volume delta\b/gi, "buy/sell volume")
    .replace(/\bdivergence\b/gi, "disagreement")
    .replace(/\bslippage\b/gi, "price impact")
    .replace(/\bMFI\b/g, "money flow");
}

function formatMarkdown(text: string): string {
  if (!text) return "";
  const lines = text.split("\n");
  const out: string[] = [];
  let inCode = false;
  let codeBuf = "";
  let inTable = false;
  const tRows: string[] = [];

  const SECTION_KW = [
    "SIGNAL", "CONVICTION", "RECOMMENDATION", "POSITION", "RISK",
    "ENTRY", "TARGET", "STOP", "SUMMARY", "ANALYSIS", "OVERVIEW", "VERDICT",
    "WHALE", "SMART MONEY", "DERIVATIVE", "VOLATILITY",
    "DIRECTION", "SETUP", "TRADE", "EXECUTION", "R:R", "KEY",
    "MATRIX", "CALL", "THESIS", "ORDER",
  ];

  function isSection(t: string): boolean {
    const u = t.toUpperCase().replace(/[^A-Z\s/:. &]/g, "").trim();
    return SECTION_KW.some(k => u.includes(k));
  }

  function hl(s: string): string {
    s = s.replace(/(\$[\d,]+(?:\.\d+)?(?:\s?[BMKbmk](?:illion)?)?)/g,
      '<span style="color:#2563eb;font-family:monospace;font-weight:600">$1</span>');
    s = s.replace(/(?<![#\w])([+-]?\d+\.?\d*%)(?![<])/g,
      '<span style="color:#2563eb;font-weight:500">$1</span>');
    s = s.replace(/\b(0\.\d{1,2}|1\.00?)\b(?![%<\d])/g,
      '<span style="color:#2563eb;font-weight:700">$1</span>');
    s = s.replace(/\b(\d+\.?\d*:\d+)\b/g,
      '<span style="color:#2563eb;font-weight:600">$1</span>');
    s = s.replace(/\b(LONG|BULLISH|BUY|Accumulating|Net Buying)\b/gi, '<span style="color:#059669;font-weight:600">$1</span>');
    s = s.replace(/\b(SHORT|BEARISH|SELL|Distributing|Net Selling)\b/gi, '<span style="color:#dc2626;font-weight:600">$1</span>');
    s = s.replace(/\b(NEUTRAL|STAND ASIDE|NO TRADE|FLAT|Balanced|Mixed|Neutral)\b/g, '<span style="color:rgba(0,0,0,0.4);font-weight:600">$1</span>');
    s = s.replace(/\b(High)\b/g, '<span style="color:#059669;font-weight:500">$1</span>');
    s = s.replace(/\b(Low)\b/g, '<span style="color:#dc2626;font-weight:500">$1</span>');
    s = s.replace(/\b(Med)\b/g, '<span style="color:#d97706;font-weight:500">$1</span>');
    s = s.replace(/`([^`]+)`/g, '<code style="background:rgba(37,99,235,0.06);color:#2563eb;padding:0 5px;border-radius:3px;font-size:13px;font-family:monospace">$1</code>');
    s = s.replace(/\*\*(.+?)\*\*/g, '<span style="color:rgba(0,0,0,0.85);font-weight:600">$1</span>');
    return s;
  }

  function flushTable() {
    if (!tRows.length) return;
    let h = '<table style="width:100%;border-collapse:collapse;font-size:13px;margin:6px 0;border:1px solid rgba(37,99,235,0.1);border-radius:8px;overflow:hidden">';
    tRows.forEach((r, i) => {
      const cells = r.split("|").filter(c => c.trim());
      const tag = i === 0 ? "th" : "td";
      const bg = i === 0 ? "background:rgba(37,99,235,0.05)" : i % 2 === 0 ? "background:rgba(0,0,0,0.015)" : "background:transparent";
      const st = i === 0
        ? `${bg};color:#2563eb;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;padding:6px 12px`
        : `${bg};color:rgba(0,0,0,0.65);padding:5px 12px;border-top:1px solid rgba(0,0,0,0.06)`;
      h += `<tr>${cells.map(c => `<${tag} style="${st};text-align:left">${hl(c.trim())}</${tag}>`).join("")}</tr>`;
    });
    h += "</table>";
    out.push(h);
    tRows.length = 0;
    inTable = false;
  }

  function sectionHdr(t: string) {
    out.push(`<div style="display:flex;align-items:center;gap:8px;margin:14px 0 4px 0"><div style="width:3px;height:14px;border-radius:1px;background:#2563eb;box-shadow:0 0 6px rgba(37,99,235,0.2)"></div><span style="color:#2563eb;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:0.1em">${t}</span></div>`);
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const t = raw.trim();
    if (t.startsWith("```")) {
      if (!inCode) { inCode = true; codeBuf = ""; continue; }
      inCode = false;
      out.push(`<pre style="background:rgba(0,0,0,0.03);border:1px solid rgba(37,99,235,0.1);border-radius:8px;padding:10px 14px;overflow-x:auto;font-size:12px;line-height:1.5;margin:6px 0;color:rgba(0,0,0,0.7)">${codeBuf}</pre>`);
      continue;
    }
    if (inCode) { codeBuf += (codeBuf ? "\n" : "") + raw; continue; }
    if (t.startsWith("|") && t.includes("|")) {
      if (/^\|[\s\-:|]+\|$/.test(t)) { inTable = true; continue; }
      inTable = true; tRows.push(t); continue;
    } else if (inTable) { flushTable(); }
    if (/^[-=]{3,}\s*$/.test(t)) { out.push('<div style="margin:10px 0;height:1px;background:linear-gradient(90deg,rgba(37,99,235,0.15),rgba(37,99,235,0.03),transparent)"></div>'); continue; }
    if (!t) { out.push('<div style="height:4px"></div>'); continue; }
    if (t.startsWith("#### ")) { out.push(`<div style="color:rgba(0,0,0,0.8);font-weight:600;font-size:13px;margin:8px 0 2px 0;padding-left:11px;border-left:2px solid rgba(37,99,235,0.3)">${hl(t.slice(5))}</div>`); continue; }
    if (t.startsWith("### ")) { sectionHdr(t.slice(4)); continue; }
    if (t.startsWith("## ")) { out.push(`<div style="display:flex;align-items:center;gap:10px;margin:14px 0 4px 0"><div style="width:3px;height:18px;border-radius:1px;background:#2563eb;box-shadow:0 0 8px rgba(37,99,235,0.2)"></div><span style="color:rgba(0,0,0,0.9);font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:0.05em">${t.slice(3)}</span></div>`); continue; }
    const boldOnly = t.match(/^\*\*(.+?)\*\*:?\s*$/);
    if (boldOnly && isSection(boldOnly[1])) { sectionHdr(boldOnly[1]); continue; }
    const boldVal = t.match(/^\*\*(.+?)\*\*[:\s]+(.+)$/);
    if (boldVal) {
      if (isSection(boldVal[1])) { sectionHdr(boldVal[1]); out.push(`<div style="color:rgba(0,0,0,0.65);padding-left:11px;font-size:14px;line-height:1.5">${hl(boldVal[2])}</div>`); continue; }
      out.push(`<div style="padding:2px 0;font-size:14px"><span style="color:rgba(0,0,0,0.85);font-weight:600">${boldVal[1]}:</span> <span style="color:rgba(0,0,0,0.6)">${hl(boldVal[2])}</span></div>`); continue;
    }
    if (/^[-*]\s/.test(t)) { out.push(`<div style="display:flex;align-items:baseline;gap:8px;padding:2px 0 2px 2px;font-size:14px"><span style="color:rgba(37,99,235,0.4);flex-shrink:0">&bull;</span><span style="color:rgba(0,0,0,0.65)">${hl(t.replace(/^[-*]\s+/, ""))}</span></div>`); continue; }
    const numM = t.match(/^(\d+)[.)]\s+(.+)$/);
    if (numM) { out.push(`<div style="display:flex;align-items:baseline;gap:8px;padding:2px 0 2px 2px;font-size:14px"><span style="color:#2563eb;font-weight:700;font-size:11px;min-width:14px">${numM[1]}.</span><span style="color:rgba(0,0,0,0.65)">${hl(numM[2])}</span></div>`); continue; }
    if (t.startsWith("*") && t.endsWith("*") && !t.startsWith("**")) { out.push(`<div style="color:rgba(0,0,0,0.3);font-size:11px;font-style:italic;margin-top:8px">${t.slice(1, -1)}</div>`); continue; }
    out.push(`<div style="color:rgba(0,0,0,0.65);padding:1px 0;font-size:14px;line-height:1.5">${hl(t)}</div>`);
  }
  if (inTable) flushTable();
  return out.join("");
}

/* Monte Carlo Projection */
const MonteCarloProjection = ({ projections }: { projections: MarketVisualData[] }) => {
  if (!projections?.length || !projections[0]?.price) return null;
  const p = projections[0];
  const price = p.price;
  const support = p.support;
  const resistance = p.resistance;
  const isBullish = p.bias.toLowerCase().includes("bull");
  const isBearish = p.bias.toLowerCase().includes("bear");
  const realVol7d = p.volatility7d || 2.5;

  const paths = useMemo(() => {
    const vol = (realVol7d / 100) / Math.sqrt(168);
    const confFactor = (p.confidence - 50) / 5000;
    const drift = isBullish ? Math.abs(confFactor) + 0.0001 : isBearish ? -Math.abs(confFactor) - 0.0001 : 0;
    const steps = 24;
    const numPaths = 50;
    const result: number[][] = [];
    for (let i = 0; i < numPaths; i++) {
      const path = [price];
      let curr = price;
      for (let t = 1; t <= steps; t++) {
        const u1 = Math.random();
        const u2 = Math.random();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        curr = curr * (1 + drift + vol * z);
        path.push(curr);
      }
      result.push(path);
    }
    return result;
  }, [price, isBullish, isBearish, realVol7d, p.confidence]);

  const allPrices = paths.flat();
  const minP = Math.min(...allPrices, support) * 0.998;
  const maxP = Math.max(...allPrices, resistance) * 1.002;
  const range = maxP - minP;
  const W = 360, H = 140, padY = 8;
  const toX = (t: number) => (t / 24) * W;
  const toY = (p: number) => padY + (1 - (p - minP) / range) * (H - padY * 2);
  const getPercentile = (step: number, pct: number) => { const vals = paths.map(p => p[step]).sort((a, b) => a - b); return vals[Math.floor(vals.length * pct)]; };
  const steps = Array.from({ length: 25 }, (_, i) => i);
  const band90Upper = steps.map(s => getPercentile(s, 0.9));
  const band90Lower = steps.map(s => getPercentile(s, 0.1));
  const band75Upper = steps.map(s => getPercentile(s, 0.75));
  const band75Lower = steps.map(s => getPercentile(s, 0.25));
  const median = steps.map(s => getPercentile(s, 0.5));
  const buildAreaPath = (upper: number[], lower: number[]) => { const top = steps.map(s => `${toX(s)},${toY(upper[s])}`).join(" L"); const bottom = steps.map(s => `${toX(s)},${toY(lower[s])}`).reverse().join(" L"); return `M${top} L${bottom} Z`; };
  const buildLinePath = (vals: number[]) => steps.map((s, i) => `${i === 0 ? "M" : "L"}${toX(s)},${toY(vals[s])}`).join(" ");
  const endPrices = paths.map(p => p[p.length - 1]);
  const bullishPct = Math.round((endPrices.filter(p => p > price).length / endPrices.length) * 100);
  const medianEnd = median[median.length - 1];
  const bestEntry = Math.min(support, price * 0.99);
  const medianReturn = ((medianEnd - price) / price * 100).toFixed(1);

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} transition={{ duration: 0.4, delay: 0.2 }} className="border-b border-gray-200">
      <div className="px-4 pt-3 pb-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-600" style={{ boxShadow: "0 0 8px rgba(37,99,235,0.3)" }} />
          <span className="text-[11px] font-mono text-blue-600 font-semibold tracking-wider uppercase">Monte Carlo Simulation &bull; {p.symbol}</span>
        </div>
        <span className="text-[10px] font-mono text-gray-400">50 paths &bull; 24h &bull; vol {realVol7d.toFixed(1)}%</span>
      </div>
      <div className="px-4 pb-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "140px" }}>
          <path d={buildAreaPath(band90Upper, band90Lower)} fill="rgba(37,99,235,0.04)" />
          <path d={buildAreaPath(band75Upper, band75Lower)} fill="rgba(37,99,235,0.08)" />
          <line x1={0} y1={toY(support)} x2={W} y2={toY(support)} stroke="rgba(220,38,38,0.3)" strokeWidth="1" strokeDasharray="4 3" />
          <line x1={0} y1={toY(resistance)} x2={W} y2={toY(resistance)} stroke="rgba(5,150,105,0.3)" strokeWidth="1" strokeDasharray="4 3" />
          <line x1={0} y1={toY(price)} x2={W} y2={toY(price)} stroke="rgba(0,0,0,0.1)" strokeWidth="0.5" />
          <path d={buildLinePath(median)} fill="none" stroke="rgba(37,99,235,0.8)" strokeWidth="1.5" />
          <circle cx={toX(0)} cy={toY(price)} r="3" fill="#2563eb" />
          <circle cx={toX(24)} cy={toY(medianEnd)} r="3" fill={medianEnd > price ? "#059669" : "#dc2626"} />
          <text x={W - 2} y={toY(resistance) - 4} textAnchor="end" fill="rgba(5,150,105,0.6)" fontSize="9" fontFamily="monospace">${resistance.toLocaleString()}</text>
          <text x={W - 2} y={toY(support) + 10} textAnchor="end" fill="rgba(220,38,38,0.6)" fontSize="9" fontFamily="monospace">${support.toLocaleString()}</text>
          <text x={4} y={toY(price) - 4} fill="rgba(0,0,0,0.35)" fontSize="9" fontFamily="monospace">NOW ${price.toLocaleString()}</text>
        </svg>
      </div>
      <div className="px-4 pb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-[11px] font-mono">
          <div className="flex flex-col items-center"><span className="text-gray-500">Bullish Paths</span><span className={`font-semibold ${bullishPct > 55 ? "text-emerald-600" : bullishPct < 45 ? "text-red-600" : "text-gray-500"}`}>{bullishPct}%</span></div>
          <div className="w-px h-6 bg-gray-200" />
          <div className="flex flex-col items-center"><span className="text-gray-500">Median Return</span><span className={`font-semibold ${Number(medianReturn) > 0 ? "text-emerald-600" : "text-red-600"}`}>{Number(medianReturn) > 0 ? "+" : ""}{medianReturn}%</span></div>
          <div className="w-px h-6 bg-gray-200" />
          <div className="flex flex-col items-center"><span className="text-gray-500">Best Entry</span><span className="font-semibold text-blue-600">${bestEntry.toLocaleString()}</span></div>
          <div className="w-px h-6 bg-gray-200" />
          <div className="flex flex-col items-center"><span className="text-gray-500">Confidence</span><span className="font-semibold text-blue-600">{p.confidence}%</span></div>
        </div>
      </div>
    </motion.div>
  );
};

/* Signal Radar */
const SignalRadar = ({ data }: { data: MarketVisualData }) => {
  if (!data?.signals) return null;
  const axes = [
    { label: "Whale Flow", value: data.signals.whaleFlow },
    { label: "Smart Money", value: data.signals.smartMoney },
    { label: "Derivatives", value: data.signals.derivatives },
    { label: "Volatility", value: data.signals.volatility },
    { label: "Order Flow", value: data.signals.orderFlow },
    { label: "Momentum", value: data.signals.momentum },
  ];
  const avgValue = Math.round(axes.reduce((a, b) => a + b.value, 0) / axes.length);
  const overallBias = avgValue > 60 ? "BULLISH" : avgValue < 40 ? "BEARISH" : "NEUTRAL";
  const biasColor = avgValue > 60 ? "#059669" : avgValue < 40 ? "#dc2626" : "rgba(0,0,0,0.4)";

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} transition={{ duration: 0.4, delay: 0.4 }} className="border-b border-gray-200">
      <div className="px-4 pt-3 pb-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-600" style={{ boxShadow: "0 0 8px rgba(8,145,178,0.3)" }} />
          <span className="text-[11px] font-mono text-cyan-600 font-semibold tracking-wider uppercase">Signal Radar &bull; {data.symbol}</span>
        </div>
        <span className="text-[10px] font-mono font-semibold" style={{ color: biasColor }}>{overallBias} ({avgValue}/100)</span>
      </div>
      <div className="px-4 pb-3 space-y-1.5">
        {axes.map((axis, i) => {
          const v = axis.value;
          const barColor = v > 60 ? "rgba(5,150,105," : v < 40 ? "rgba(220,38,38," : "rgba(37,99,235,";
          const textColor = v > 60 ? "text-emerald-600" : v < 40 ? "text-red-600" : "text-blue-600";
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-gray-500 w-[76px] text-right flex-shrink-0 truncate">{axis.label}</span>
              <div className="flex-1 h-3 rounded-full overflow-hidden bg-gray-100 relative">
                <div className="absolute top-0 left-1/2 w-[1px] h-full bg-gray-200 z-10" />
                {v >= 50 ? (
                  <motion.div initial={{ width: 0 }} animate={{ width: `${v}%` }} transition={{ duration: 0.6, delay: 0.05 * i }} className="absolute top-0 left-0 h-full rounded-full" style={{ background: `linear-gradient(90deg, ${barColor}0.1), ${barColor}${0.25 + (v - 50) / 100}))` }} />
                ) : (
                  <motion.div initial={{ width: 0 }} animate={{ width: `${100 - v}%` }} transition={{ duration: 0.6, delay: 0.05 * i }} className="absolute top-0 right-0 h-full rounded-full" style={{ background: `linear-gradient(270deg, ${barColor}0.1), ${barColor}${0.25 + (50 - v) / 100}))` }} />
                )}
              </div>
              <span className={`text-[10px] font-mono font-semibold w-[48px] text-right flex-shrink-0 ${textColor}`}>{v}/100</span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

/* Whale Flow Tracker */
const WhaleFlowTracker = ({ data }: { data: MarketVisualData }) => {
  if (!data?.buyVolume && !data?.sellVolume) return null;
  const buy = data.buyVolume, sell = data.sellVolume, total = buy + sell || 1;
  const buyPct = Math.round((buy / total) * 100), sellPct = 100 - buyPct;
  const net = data.netFlow, isNetBullish = net > 0;
  const formatUsd = (v: number) => { if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`; if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`; if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`; return `$${v.toFixed(0)}`; };

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} transition={{ duration: 0.4, delay: 0.5 }} className="border-b border-gray-200">
      <div className="px-4 pt-3 pb-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-purple-600" style={{ boxShadow: "0 0 8px rgba(147,51,234,0.3)" }} />
          <span className="text-[11px] font-mono text-purple-600 font-semibold tracking-wider uppercase">Whale Flow &bull; {data.symbol}</span>
        </div>
        <span className="text-[10px] font-mono text-gray-400">{data.largeTrades} large trades</span>
      </div>
      <div className="px-4 pb-3 space-y-2">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] font-mono"><span className="text-emerald-600">BUY {formatUsd(buy)}</span><span className="text-red-600">SELL {formatUsd(sell)}</span></div>
          <div className="flex h-4 rounded-full overflow-hidden bg-gray-100">
            <motion.div initial={{ width: 0 }} animate={{ width: `${buyPct}%` }} transition={{ duration: 0.8 }} className="h-full rounded-l-full" style={{ background: "linear-gradient(90deg, rgba(5,150,105,0.25), rgba(5,150,105,0.5))" }} />
            <motion.div initial={{ width: 0 }} animate={{ width: `${sellPct}%` }} transition={{ duration: 0.8 }} className="h-full rounded-r-full" style={{ background: "linear-gradient(90deg, rgba(220,38,38,0.5), rgba(220,38,38,0.25))" }} />
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono"><span className="text-emerald-600/60">{buyPct}%</span><span className="text-red-600/60">{sellPct}%</span></div>
        </div>
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2"><span className="text-[10px] font-mono text-gray-500">Net Flow</span><span className={`text-[12px] font-mono font-semibold ${isNetBullish ? "text-emerald-600" : "text-red-600"}`}>{isNetBullish ? "+" : ""}{formatUsd(net)}</span></div>
          <span className={`text-[10px] font-mono font-semibold ${isNetBullish ? "text-emerald-600" : "text-red-600"}`}>{data.flowSentiment.toUpperCase()} {isNetBullish ? "\u2197" : "\u2198"}</span>
        </div>
      </div>
    </motion.div>
  );
};

function stripTradeCallFromText(text: string): string {
  if (!text) return text;
  let cleaned = text;
  cleaned = cleaned.replace(/###\s*TRADE\s*CALL[\s\S]*?(?=###\s*THESIS|$)/i, "");
  cleaned = cleaned.replace(/###\s*THESIS[\s\S]*?(?=\*Not financial|$)/i, "");
  cleaned = cleaned.replace(/\*Not financial advice[^*]*\*/i, "");
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");
  return cleaned.trim();
}

function parseTradeCall(text: string): { direction?: string; coin?: string; conviction?: string; entry?: string; target?: string; targetPct?: string; stop?: string; stopPct?: string; rr?: string; size?: string; thesis?: string } | null {
  if (!text) return null;
  const d: Record<string, string> = {};
  const dirM = text.match(/Direction[:\s]*\**\s*(BUY|SELL|LONG|SHORT)\s+(\w+)/i) || text.match(/\*\*Direction[:\s]*\*\*\s*(BUY|SELL|LONG|SHORT)\s+(\w+)/i);
  if (dirM) { d.direction = dirM[1].toUpperCase(); d.coin = dirM[2].toUpperCase(); }
  const convM = text.match(/Conviction[:\s]*\**\s*([\d.]+(?:\/[\d.]+)?)/i);
  if (convM) d.conviction = convM[1].includes("/") ? convM[1] : convM[1] + "/1.00";
  const entM = text.match(/Entry[:\s]*\**\s*(\$[\d,.]+)/i);
  if (entM) d.entry = entM[1];
  const tgtM = text.match(/Target[:\s]*\**\s*(\$[\d,.]+)\s*\(([^)]+)\)/i);
  if (tgtM) { d.target = tgtM[1]; d.targetPct = tgtM[2]; } else { const t2 = text.match(/Target[:\s]*\**\s*(\$[\d,.]+)/i); if (t2) d.target = t2[1]; }
  const stpM = text.match(/Stop[:\s]*\**\s*(\$[\d,.]+)\s*\(([^)]+)\)/i);
  if (stpM) { d.stop = stpM[1]; d.stopPct = stpM[2]; } else { const s2 = text.match(/Stop[:\s]*\**\s*(\$[\d,.]+)/i); if (s2) d.stop = s2[1]; }
  const rrM = text.match(/R:R[:\s]*\**\s*([\d.]+:[\d.]+)/i);
  if (rrM) d.rr = rrM[1];
  const szM = text.match(/Size[:\s]*\**\s*(.+?)(?:\n|$)/i);
  if (szM) { const raw = szM[1].replace(/\*+/g, "").trim(); if (raw && raw !== "N/A") d.size = raw; }
  const thesisM = text.match(/###\s*THESIS\s*\n+([\s\S]*?)(?=\*Not financial|\n*$)/i);
  if (thesisM) { const raw = thesisM[1].replace(/\*+/g, "").replace(/\n+/g, " ").trim(); if (raw && raw.length > 10) d.thesis = raw; }
  if (!d.direction || !d.entry) return null;
  return d;
}

const TradeSetupCard = ({ content, price }: { content: string; price: number }) => {
  const trade = parseTradeCall(content);
  if (!trade) return null;
  const isSell = trade.direction === "SELL" || trade.direction === "SHORT";
  const dirColor = isSell ? "#dc2626" : "#059669";
  const dirLabel = isSell ? "SHORT" : "LONG";
  const parsePrice = (s?: string) => s ? parseFloat(s.replace(/[$,]/g, "")) : 0;
  const levels = [
    { label: "TARGET", value: trade.target || "\u2014", pct: trade.targetPct || "", num: parsePrice(trade.target), color: "#059669" },
    { label: "ENTRY", value: trade.entry || "\u2014", pct: "", num: parsePrice(trade.entry), color: "#2563eb" },
    { label: "STOP", value: trade.stop || "\u2014", pct: trade.stopPct || "", num: parsePrice(trade.stop), color: "#dc2626" },
  ].filter(l => l.num > 0).sort((a, b) => b.num - a.num);
  const convNum = trade.conviction ? parseFloat(trade.conviction.split("/")[0]) : 0;
  const convPct = Math.round(convNum * 100);

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} transition={{ duration: 0.4, delay: 0.55 }} className="border-b border-gray-200">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ background: dirColor, boxShadow: `0 0 8px ${dirColor}40` }} /><span className="text-[11px] font-mono font-semibold tracking-wider uppercase" style={{ color: dirColor }}>{dirLabel} {trade.coin || ""}</span></div>
        <div className="flex items-center gap-3">{trade.rr && <span className="text-[10px] font-mono text-blue-600 font-semibold">R:R {trade.rr}</span>}{trade.conviction && <span className="text-[10px] font-mono text-gray-500">{trade.conviction}</span>}</div>
      </div>
      <div className="px-4 pb-3 flex gap-4">
        <div className="flex flex-col items-stretch gap-0 w-[180px] flex-shrink-0">
          {levels.map((level, i) => {
            const isEntry = level.label === "ENTRY";
            const showZone = i < levels.length - 1;
            const nextLevel = levels[i + 1];
            const zoneIsProfit = (level.label === "TARGET" && nextLevel?.label === "ENTRY") || (level.label === "ENTRY" && nextLevel?.label === "STOP" && isSell) || (level.label === "ENTRY" && nextLevel?.label === "TARGET");
            const zoneBorder = zoneIsProfit ? "rgba(5,150,105,0.15)" : "rgba(220,38,38,0.15)";
            const zoneBg = zoneIsProfit ? "rgba(5,150,105,0.04)" : "rgba(220,38,38,0.04)";
            return (
              <div key={level.label}>
                <div className="flex items-center gap-2 py-1.5">
                  <div className="flex flex-col items-center w-3 flex-shrink-0"><div className="w-2.5 h-2.5 rounded-full border-2" style={{ borderColor: level.color, background: isEntry ? level.color : "transparent" }} /></div>
                  <span className="text-[10px] font-mono uppercase tracking-wider w-[46px] flex-shrink-0 font-semibold" style={{ color: level.color }}>{level.label}</span>
                  <span className="text-[14px] font-mono font-bold" style={{ color: level.color }}>{level.value}</span>
                  {level.pct && <span className="text-[10px] font-mono text-gray-400 ml-auto">{level.pct}</span>}
                </div>
                {showZone && <div className="ml-[5px] border-l-2 h-3" style={{ borderColor: zoneBorder, background: zoneBg, marginLeft: "5px", paddingLeft: "8px" }}><div className="h-full" /></div>}
              </div>
            );
          })}
          <div className="flex items-center gap-2 pt-2 mt-1 border-t border-gray-200">
            <div className="w-3 flex-shrink-0 flex justify-center"><div className="w-1.5 h-1.5 rounded-full bg-gray-400" /></div>
            <span className="text-[10px] font-mono text-gray-400 w-[46px] flex-shrink-0">NOW</span>
            <span className="text-[12px] font-mono text-gray-500">${price.toLocaleString()}</span>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          {convNum > 0 && (
            <div className="relative w-[72px] h-[72px]">
              <svg viewBox="0 0 72 72" className="w-full h-full"><circle cx="36" cy="36" r="30" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="4" /><circle cx="36" cy="36" r="30" fill="none" stroke={dirColor} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${convNum * 188.5} 188.5`} transform="rotate(-90 36 36)" style={{ filter: `drop-shadow(0 0 4px ${dirColor}40)` }} /></svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-[18px] font-mono font-bold" style={{ color: dirColor }}>{convPct}</span><span className="text-[8px] font-mono text-gray-500 -mt-0.5">CONVICTION</span></div>
            </div>
          )}
          {trade.size && <div className="text-center px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200"><div className="text-[8px] font-mono text-gray-500 uppercase tracking-wider">Position</div><div className="text-[11px] font-mono text-gray-600 mt-0.5">{trade.size}</div></div>}
        </div>
      </div>
      {trade.thesis && (
        <div className="px-4 pb-3">
          <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1.5"><div className="w-[3px] h-[10px] rounded-sm bg-blue-600" style={{ boxShadow: "0 0 4px rgba(37,99,235,0.2)" }} /><span className="text-[9px] font-mono text-blue-600/60 uppercase tracking-wider font-semibold">Why This Trade</span></div>
            <p className="text-[13px] leading-[1.6] text-gray-600 font-mono">{trade.thesis}</p>
          </div>
          <div className="mt-2 text-center"><span className="text-[9px] font-mono text-gray-400 italic">Not financial advice. Manage your risk.</span></div>
        </div>
      )}
    </motion.div>
  );
};

/* Analysis Pipeline */
const AnalysisPipeline = ({ isActive }: { isActive: boolean }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  useEffect(() => {
    if (!isActive) { setCurrentStep(0); setCompletedSteps([]); return; }
    let stepIndex = 0;
    const runStep = () => {
      if (stepIndex >= ANALYSIS_STEPS.length) return;
      setCurrentStep(stepIndex);
      const timer = setTimeout(() => { setCompletedSteps(prev => [...prev, stepIndex]); stepIndex++; runStep(); }, ANALYSIS_STEPS[stepIndex].duration);
      return timer;
    };
    const timer = runStep();
    return () => { if (timer) clearTimeout(timer); };
  }, [isActive]);
  if (!isActive) return null;
  return (
    <div className="px-5 py-4 space-y-1">
      {ANALYSIS_STEPS.map((step, i) => {
        const isCompleted = completedSteps.includes(i);
        const isCurrent = currentStep === i && !isCompleted;
        const isPending = i > currentStep;
        return (
          <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: isPending ? 0.3 : 1, x: 0 }} transition={{ delay: i * 0.08, duration: 0.2 }} className="flex items-center gap-3 py-1">
            <div className="w-5 flex-shrink-0 flex items-center justify-center">
              {isCompleted ? <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-emerald-600 text-xs">{"\u2713"}</motion.span> : isCurrent ? <motion.div className="w-2 h-2 rounded-full bg-blue-600" animate={{ opacity: [1, 0.3, 1], scale: [1, 0.8, 1] }} transition={{ duration: 0.6, repeat: Infinity }} /> : <div className="w-1.5 h-1.5 rounded-full bg-gray-200" />}
            </div>
            <span className={`text-xs font-mono ${isCompleted ? "text-gray-500" : isCurrent ? "text-blue-600" : "text-gray-300"}`}>
              {step.text}{isCurrent && <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ duration: 1, repeat: Infinity }} className="ml-1">...</motion.span>}
            </span>
          </motion.div>
        );
      })}
      <div className="mt-2 h-[2px] bg-gray-100 rounded-full overflow-hidden"><motion.div className="h-full bg-gradient-to-r from-blue-500/60 to-blue-600" initial={{ width: "0%" }} animate={{ width: `${((completedSteps.length) / ANALYSIS_STEPS.length) * 100}%` }} transition={{ duration: 0.3 }} /></div>
    </div>
  );
};

// Cache market data for 30s so follow-up questions get the SAME data
const marketCache = { data: "", timestamp: 0, symbols: "" as string, priceData: [] as MarketVisualData[] };

export interface CommandCenterHandle {
  submitQuery: (text: string) => void;
}

const CommandCenter = forwardRef<CommandCenterHandle>((_, ref) => {
  const [activeQuery, setActiveQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [modelStatus, setModelStatus] = useState<"online" | "offline" | "checking">("checking");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Burn gate
  const { requestBurn, estimate, burnStatus, burnError, showBurnModal, tokenBalance, confirmBurn, cancelBurn } = useBurn();

  // Expose submitQuery to parent via ref
  const sendMessageRef = useRef<(text: string) => void>();

  useImperativeHandle(ref, () => ({
    submitQuery: (text: string) => {
      if (sendMessageRef.current) sendMessageRef.current(text);
    },
  }));

  const scrollToBottom = useCallback(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, []);
  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // Check model health
  useEffect(() => {
    const check = async () => {
      try { const res = await fetch(`${VLLM_BASE}/chat`, { signal: AbortSignal.timeout(5000) }); setModelStatus(res.ok ? "online" : "offline"); } catch { setModelStatus("offline"); }
    };
    check();
    const i = setInterval(check, 30000);
    return () => clearInterval(i);
  }, []);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return;

    // Burn gate — blocks until user confirms burn or passes through if disabled
    const burnApproved = await requestBurn(text.trim());
    if (!burnApproved) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text.trim() };
    const assistantId = crypto.randomUUID();
    setMessages(prev => [...prev, userMsg, { id: assistantId, role: "assistant", content: "" }]);
    setActiveQuery("");
    setIsStreaming(true);
    setIsAnalyzing(true);

    try {
      let marketContext: string;
      let priceData: MarketVisualData[] = [];
      const now = Date.now();
      let detectedSymbols = detectSymbols(text);
      if (detectedSymbols.length === 0 && marketCache.symbols) { detectedSymbols = marketCache.symbols.split(","); }
      const querySymbols = detectedSymbols.join(",");

      if (marketCache.data && now - marketCache.timestamp < 30000 && marketCache.symbols === querySymbols) {
        marketContext = marketCache.data;
        priceData = marketCache.priceData;
        await new Promise(r => setTimeout(r, 400));
      } else {
        try {
          const result = await Promise.race([
            buildMarketContext(text, detectedSymbols),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Market data timeout")), 15000)),
          ]);
          marketContext = result.context;
          priceData = result.priceData;
          marketCache.data = marketContext;
          marketCache.timestamp = now;
          marketCache.symbols = querySymbols;
          marketCache.priceData = priceData;
        } catch {
          marketContext = "";
          priceData = [];
        }
        await new Promise(r => setTimeout(r, 800));
      }

      setIsAnalyzing(false);
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, projections: priceData } : m));

      const chatMessages = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
      if (marketContext && chatMessages.length > 0) {
        const last = chatMessages[chatMessages.length - 1];
        if (last.role === "user") { last.content = `${marketContext}\n\n${last.content}`; }
      }

      const response = await fetch(VLLM_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "montra-32b", messages: [{ role: "system", content: SYSTEM_PROMPT }, ...chatMessages], max_tokens: 500, temperature: 0.3, stream: true }),
        signal: AbortSignal.timeout(120000),
      });

      if (!response.ok) throw new Error(`Model error: ${response.status}`);
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let fullContent = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          // Handle both NDJSON (Ollama native) and SSE (OpenAI compat)
          let jsonStr = trimmed;
          if (trimmed.startsWith("data: ")) {
            jsonStr = trimmed.slice(6);
            if (jsonStr === "[DONE]") continue;
          }
          try {
            const parsed = JSON.parse(jsonStr);
            // Ollama native: parsed.message.content / OpenAI: parsed.choices[0].delta.content
            const content = parsed.message?.content || parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.delta?.reasoning || "";
            if (content) {
              fullContent += content;
              const cleaned = cleanJargon(fullContent);
              setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: cleaned } : m));
            }
          } catch { /* skip */ }
        }
      }

      // Handle empty response — stream completed but produced no content
      if (!fullContent.trim()) {
        throw new Error("Empty response from model — try again");
      }
    } catch (err) {
      setIsAnalyzing(false);
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: `**Connection Error:** ${err instanceof Error ? err.message : "Failed to reach Montra AI"}. The model may be restarting — try again in a moment.` } : m));
    } finally {
      setIsStreaming(false);
      setIsAnalyzing(false);
      inputRef.current?.focus();
    }
  };

  sendMessageRef.current = sendMessage;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(activeQuery); }
    if (e.key === "Escape") { setActiveQuery(""); }
  };

  const clearChat = () => {
    setMessages([]);
    marketCache.data = ""; marketCache.timestamp = 0; marketCache.symbols = ""; marketCache.priceData = [];
    inputRef.current?.focus();
  };

  return (
    <div className="flex-1 flex flex-col min-h-[360px] max-h-[calc(100vh-200px)] bg-card/50 backdrop-blur bg-card border border-border rounded-2xl p-4 overflow-hidden">
      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-y-auto min-h-0 space-y-4">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
              <Zap size={28} className="text-primary" />
            </div>
            <h2 className="text-xl font-mono font-bold tracking-wider mb-1">MONTRA</h2>
            <p className="text-[10px] font-mono text-muted-foreground tracking-[0.3em] uppercase mb-4">
              Intelligent Research &amp; Operations System
            </p>
            <p className="text-[10px] font-mono text-muted-foreground mb-2 tracking-widest">
              TRADING INTELLIGENCE &bull; INSTITUTIONAL-GRADE QUANTITATIVE ANALYSIS
            </p>
            <p className="text-xs text-muted-foreground max-w-md mb-3 leading-relaxed">
              Montra Terminal provides real-time market intelligence through advanced signal processing, topological data analysis, and multi-model AI consensus systems.
            </p>
            <p className="text-xs font-mono text-primary italic">
              This is your unfair advantage. Use it wisely.
            </p>
            <div className="flex items-center gap-4 mt-4 text-[10px] font-mono text-muted-foreground">
              <span className="flex items-center gap-1"><span className={`w-1.5 h-1.5 rounded-full ${modelStatus === "online" ? "bg-primary" : "bg-destructive"}`} /> SYSTEM {modelStatus === "online" ? "ONLINE" : "OFFLINE"}</span>
              <span>GPU: <span className="text-primary">{GPU_CONFIG.label.split(' · ')[0]}</span></span>
              <span>MODEL: <span className="text-primary">{AI_MODELS[0].name}</span></span>
            </div>
          </div>
        ) : (
          <AnimatePresence>
            {messages.map((msg) => (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start w-full"}`}>
                {msg.role === "assistant" && (
                  <div className="flex-shrink-0 mt-1"><div className="w-8 h-8 rounded-xl border border-primary/25 bg-primary/5 flex items-center justify-center" style={{ boxShadow: "0 0 12px rgba(37,99,235,0.08)" }}><Zap size={14} className="text-primary" /></div></div>
                )}
                <div className={`${msg.role === "user" ? "max-w-[75%] rounded-2xl rounded-br-md px-5 py-3 bg-primary text-white text-sm font-medium shadow-[0_2px_16px_rgba(59,130,246,0.15)]" : "flex-1 min-w-0 rounded-2xl rounded-bl-md"}`}>
                  {msg.role === "assistant" ? (
                    <div className="relative">
                      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-primary/20 via-primary/5 to-transparent rounded-t-2xl" />
                      <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md overflow-hidden" style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
                        {isAnalyzing && msg.id === messages[messages.length - 1]?.id && !msg.content && <AnalysisPipeline isActive={true} />}
                        {msg.projections && msg.projections.length > 0 && !isAnalyzing && <MonteCarloProjection projections={msg.projections} />}
                        {msg.projections?.[0] && !isAnalyzing && <SignalRadar data={msg.projections[0]} />}
                        {msg.projections?.[0] && !isAnalyzing && <WhaleFlowTracker data={msg.projections[0]} />}
                        {(!isAnalyzing || msg.content) && (
                          <div className="px-4 py-3">
                            <div className="text-[14px] leading-[1.5] [&_table]:w-full" dangerouslySetInnerHTML={{ __html: formatMarkdown(!isStreaming && msg.content && parseTradeCall(msg.content) ? stripTradeCallFromText(msg.content) : msg.content) || '<div class="flex items-center gap-2"><span class="text-gray-400 text-xs">Generating trade...</span></div>' }} />
                            {isStreaming && msg.id === messages[messages.length - 1]?.id && msg.content && <motion.span className="inline-block w-[3px] h-[18px] bg-primary ml-0.5 rounded-sm" animate={{ opacity: [1, 0] }} transition={{ duration: 0.6, repeat: Infinity }} style={{ boxShadow: "0 0 6px rgba(37,99,235,0.3)" }} />}
                          </div>
                        )}
                        {!isStreaming && msg.content && msg.projections?.[0] && (() => { const parsed = parseTradeCall(msg.content); const coin = parsed?.coin?.toUpperCase(); const matched = coin && msg.projections!.length > 1 ? msg.projections!.find(p => p.symbol.toUpperCase() === coin) || msg.projections![0] : msg.projections![0]; return <TradeSetupCard content={msg.content} price={matched.price} />; })()}
                        {!isStreaming && msg.content && (
                          <div className="px-5 py-2 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
                            <span className="text-[10px] font-mono text-gray-400">bastion-32b &bull; Monte Carlo &bull; Signal Radar &bull; Whale Flow</span>
                            <div className="flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-emerald-500" /><span className="text-[10px] font-mono text-gray-400">synced</span></div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : <span>{msg.content}</span>}
                </div>
                {msg.role === "user" && <div className="flex-shrink-0 mt-1"><div className="w-8 h-8 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center"><span className="text-[12px] text-gray-500 font-semibold">U</span></div></div>}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Terminal input */}
      <div className="border-t border-border mt-auto pt-3">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-accent" />
          <span className="w-2.5 h-2.5 rounded-full bg-primary/60" />
          <span className="text-[10px] font-mono text-muted-foreground ml-2">Montra Terminal v1.0</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-primary">$</span>
          <span className="text-xs font-mono text-muted-foreground">Ask MONTRA:</span>
          <input
            ref={inputRef}
            type="text"
            value={activeQuery}
            onChange={(e) => setActiveQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? "Analyzing..." : "Enter your query..."}
            disabled={isStreaming}
            className="flex-1 bg-transparent text-xs font-mono text-foreground outline-none placeholder:text-muted-foreground/50 disabled:opacity-40"
          />
          <motion.button
            onClick={() => sendMessage(activeQuery)}
            disabled={isStreaming || !activeQuery.trim()}
            className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/80 transition disabled:opacity-20 disabled:cursor-not-allowed"
            whileHover={!isStreaming && activeQuery.trim() ? { scale: 1.05 } : {}}
            whileTap={!isStreaming && activeQuery.trim() ? { scale: 0.95 } : {}}
          >
            {"\u2192"}
          </motion.button>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <button onClick={() => sendMessage(activeQuery)} disabled={isStreaming || !activeQuery.trim()} className="text-[10px] font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded hover:text-foreground transition disabled:opacity-30">Run</button>
          <button onClick={clearChat} className="text-[10px] font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded hover:text-foreground transition">Clear</button>
          {["Multi", "Focus", "Alt", "Cancel"].map(cmd => (
            <button key={cmd} className="text-[10px] font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded hover:text-foreground transition">{cmd}</button>
          ))}
        </div>
      </div>

      {/* Burn Confirmation Modal */}
      <BurnConfirmModal
        open={showBurnModal}
        estimate={estimate}
        tokenBalance={tokenBalance}
        burnStatus={burnStatus}
        burnError={burnError}
        onConfirm={confirmBurn}
        onCancel={cancelBurn}
      />
    </div>
  );
});

CommandCenter.displayName = "CommandCenter";

export default CommandCenter;
