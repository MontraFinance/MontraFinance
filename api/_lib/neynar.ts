/**
 * Neynar client factory for serverless functions
 * Follows the same lazy-singleton pattern as supabase.ts
 */
import { NeynarAPIClient, Configuration } from "@neynar/nodejs-sdk";

let _client: NeynarAPIClient | null = null;

export function getNeynar(): NeynarAPIClient {
  if (_client) return _client;

  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) {
    throw new Error("Missing NEYNAR_API_KEY");
  }

  const config = new Configuration({ apiKey });
  _client = new NeynarAPIClient(config);
  return _client;
}

export function getFarcasterConfig(): { fid: number; signerUuid: string } {
  const fid = process.env.FARCASTER_FID;
  const signerUuid = process.env.FARCASTER_SIGNER_UUID;

  if (!fid || !signerUuid) {
    throw new Error("Missing FARCASTER_FID or FARCASTER_SIGNER_UUID");
  }

  return { fid: Number(fid), signerUuid };
}
