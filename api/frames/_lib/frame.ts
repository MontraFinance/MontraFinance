/**
 * Farcaster Frames v2 helpers.
 * Generates HTML responses with the correct Open Graph + fc:frame meta tags.
 * Uses SVG-based dynamic images (no external deps).
 */
import type { VercelResponse } from "@vercel/node";

const BASE_URL = "https://montrafinance.com";

/* ── Types ── */

interface FrameButton {
  label: string;
  /** "post" sends POST back to target, "link" opens URL, "post_redirect" follows redirect */
  action?: "post" | "link" | "post_redirect";
  target?: string;
}

interface FrameResponse {
  /** URL to the OG image (must be <256KB, 1.91:1 ratio recommended) */
  imageUrl: string;
  /** Up to 4 buttons */
  buttons?: FrameButton[];
  /** POST target for buttons with action=post (defaults to current URL) */
  postUrl?: string;
  /** Optional text input placeholder */
  inputText?: string;
}

/* ── Frame HTML generator ── */

export function sendFrame(res: VercelResponse, frame: FrameResponse): void {
  const buttonTags = (frame.buttons || [])
    .map((btn, i) => {
      const idx = i + 1;
      let tags = `<meta property="fc:frame:button:${idx}" content="${esc(btn.label)}" />`;
      if (btn.action) {
        tags += `\n    <meta property="fc:frame:button:${idx}:action" content="${btn.action}" />`;
      }
      if (btn.target) {
        tags += `\n    <meta property="fc:frame:button:${idx}:target" content="${esc(btn.target)}" />`;
      }
      return tags;
    })
    .join("\n    ");

  const inputTag = frame.inputText
    ? `<meta property="fc:frame:input:text" content="${esc(frame.inputText)}" />`
    : "";

  const postUrlTag = frame.postUrl
    ? `<meta property="fc:frame:post_url" content="${esc(frame.postUrl)}" />`
    : "";

  const html = `<!DOCTYPE html>
<html>
<head>
    <meta property="fc:frame" content="vNext" />
    <meta property="fc:frame:image" content="${esc(frame.imageUrl)}" />
    <meta property="fc:frame:image:aspect_ratio" content="1.91:1" />
    ${postUrlTag}
    ${inputTag}
    ${buttonTags}
    <meta property="og:image" content="${esc(frame.imageUrl)}" />
    <meta property="og:title" content="Montra Finance" />
</head>
<body></body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60");
  res.status(200).send(html);
}

/* ── SVG Image Builder ── */

interface StatItem {
  label: string;
  value: string;
  color?: string;
}

interface ImageOptions {
  title: string;
  subtitle?: string;
  stats: StatItem[];
  accentColor?: string;
  badge?: string;
}

/**
 * Generates an SVG image as a data URI for frame display.
 * Dimensions: 1200x630 (1.91:1 ratio, standard OG image size).
 */
export function buildImageSvg(opts: ImageOptions): string {
  const accent = opts.accentColor || "#10b981";
  const statsRows = opts.stats
    .map((s, i) => {
      const y = 320 + i * 70;
      const valColor = s.color || "#f4f4f5";
      return `
      <text x="80" y="${y}" fill="#a1a1aa" font-size="22" font-family="monospace">${esc(s.label)}</text>
      <text x="1120" y="${y}" fill="${valColor}" font-size="28" font-weight="bold" font-family="monospace" text-anchor="end">${esc(s.value)}</text>`;
    })
    .join("");

  const badgeEl = opts.badge
    ? `<rect x="80" y="135" width="${opts.badge.length * 12 + 24}" height="28" rx="6" fill="${accent}" opacity="0.15" />
       <text x="92" y="154" fill="${accent}" font-size="14" font-weight="bold" font-family="monospace" letter-spacing="1">${esc(opts.badge)}</text>`
    : "";

  const subtitleEl = opts.subtitle
    ? `<text x="80" y="${opts.badge ? 200 : 170}" fill="#71717a" font-size="20" font-family="monospace">${esc(opts.subtitle)}</text>`
    : "";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="g1" cx="90%" cy="10%" r="60%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.08" />
      <stop offset="100%" stop-color="transparent" />
    </radialGradient>
    <radialGradient id="g2" cx="10%" cy="90%" r="50%">
      <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.06" />
      <stop offset="100%" stop-color="transparent" />
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="#09090b" />
  <rect width="1200" height="630" fill="url(#g1)" />
  <rect width="1200" height="630" fill="url(#g2)" />
  <!-- Grid -->
  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#ffffff" stroke-opacity="0.03" stroke-width="1"/>
  </pattern>
  <rect width="1200" height="630" fill="url(#grid)" />
  <!-- Title -->
  <text x="80" y="110" fill="#f4f4f5" font-size="38" font-weight="bold" font-family="system-ui, sans-serif">${esc(opts.title)}</text>
  ${badgeEl}
  ${subtitleEl}
  <!-- Divider -->
  <line x1="80" y1="260" x2="1120" y2="260" stroke="#ffffff" stroke-opacity="0.06" stroke-width="1" />
  <!-- Stats -->
  ${statsRows}
  <!-- Footer -->
  <text x="80" y="600" fill="#52525b" font-size="16" font-family="monospace" letter-spacing="1">MONTRA FINANCE</text>
  <circle cx="1100" cy="594" r="5" fill="${accent}" opacity="0.8" />
  <text x="1080" y="600" fill="${accent}" font-size="14" font-weight="bold" font-family="monospace" text-anchor="end">LIVE</text>
</svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/** Build a full URL for frame endpoints */
export function frameUrl(path: string): string {
  return `${BASE_URL}/api/frames/${path}`;
}

/** HTML-escape for meta tag values */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
