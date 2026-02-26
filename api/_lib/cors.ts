/**
 * CORS Configuration for MontraFinance API
 */
import type { VercelResponse } from "@vercel/node";

export const ALLOWED_ORIGINS = [
  "https://montrafinance.com",
  "https://www.montrafinance.com",
  "http://localhost:5173",
  "http://localhost:3000",
];

export function getAllowedOrigin(origin: string | undefined): string {
  if (!origin) return "https://www.montrafinance.com";
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  // Allow Vercel preview deployments
  if (origin.match(/^https:\/\/montrafinanquantix[\w-]*\.vercel\.app/)) return origin;
  return "https://www.montrafinance.com";
}

/** Set CORS headers for a response (supports GET + POST) */
export function setCorsHeaders(res: VercelResponse, origin: string | undefined): void {
  res.setHeader("Access-Control-Allow-Origin", getAllowedOrigin(origin));
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
