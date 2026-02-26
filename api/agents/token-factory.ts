/**
 * POST /api/agents/token-factory
 *
 * x402-gated endpoint — deploys an ERC-20 token via Clawncher SDK on Base.
 * Internal frontend users deploy free; external API callers pay USDC.
 * Server-side agent wallet handles the on-chain deployment.
 *
 * Creates a Uniswap V4 pool with MEV protection. LP fees (80%) are routed
 * to the MontraFi treasury wallet, feeding the $MONTRA buyback/burn flywheel.
 *
 * Env vars required:
 *   TOKEN_FACTORY_ENABLED=true
 *   TOKEN_FACTORY_PRICE_USD=5          (USDC per deployment, default 5)
 *   CLAWNCHER_PRIVATE_KEY=0x...        (server-side deployer wallet)
 *   CLAWNCHER_FEE_RECIPIENT=0x...      (treasury wallet for LP fees)
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withX402 } from "../_lib/x402.js";
import { getSupabase } from "../_lib/supabase.js";
import { getDeployer, getFeeRecipient, getDeployerAddress } from "../_lib/clawncher.js";
import { castTokenDeployed } from "../_lib/cast-templates.js";
import type { Address } from "viem";

const PRICE_USD = parseFloat(process.env.TOKEN_FACTORY_PRICE_USD || "5");
const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

async function handleDeploy(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST required" });

  // Feature flag
  if (process.env.TOKEN_FACTORY_ENABLED !== "true") {
    return res.status(503).json({ error: "Token Factory is not enabled" });
  }

  if (!process.env.CLAWNCHER_PRIVATE_KEY) {
    return res.status(503).json({ error: "CLAWNCHER_PRIVATE_KEY not configured" });
  }

  // Parse body
  const { name, symbol, wallet, description, imageUrl, website, twitter } = req.body || {};

  // Validate required fields
  if (!name || typeof name !== "string" || name.length > 100) {
    return res.status(400).json({ error: "Invalid token name (required, max 100 chars)" });
  }
  if (!symbol || typeof symbol !== "string" || symbol.length > 32 || !/^[A-Z0-9]+$/.test(symbol)) {
    return res.status(400).json({ error: "Invalid symbol (uppercase alphanumeric, max 32 chars)" });
  }
  if (!wallet || typeof wallet !== "string" || !WALLET_RE.test(wallet)) {
    return res.status(400).json({ error: "Invalid wallet address" });
  }
  if (!description || typeof description !== "string" || description.length > 1000) {
    return res.status(400).json({ error: "Invalid description (required, max 1000 chars)" });
  }
  if (!imageUrl || typeof imageUrl !== "string") {
    return res.status(400).json({ error: "Image URL is required" });
  }

  const supabase = getSupabase();
  const feeRecipient = getFeeRecipient();
  const payer = (res.getHeader("X-Payment-Payer") as string) || "internal";

  // Insert pending record
  const { data: record, error: insertError } = await supabase
    .from("token_deployments")
    .insert({
      token_name: name.trim(),
      token_symbol: symbol.trim(),
      token_image: imageUrl.trim(),
      token_description: description.trim(),
      deployer_wallet: wallet.toLowerCase(),
      fee_recipient: feeRecipient.toLowerCase(),
      reward_bps: 10000,
      status: "pending",
      payer_address: payer.toLowerCase(),
      price_paid_usdc: PRICE_USD,
    })
    .select()
    .single();

  if (insertError || !record) {
    console.error("[token-factory] Insert error:", insertError?.message);
    return res.status(500).json({ error: "Failed to create deployment record" });
  }

  try {
    const deployer = getDeployer();
    const deployerAddress = getDeployerAddress();

    // Build social media URLs if provided
    const socialMediaUrls: Array<{ platform: string; url: string }> = [];
    if (website?.trim()) socialMediaUrls.push({ platform: "website", url: website.trim() });
    if (twitter?.trim()) socialMediaUrls.push({ platform: "twitter", url: twitter.trim() });

    // Deploy via Clawncher SDK
    const deployResult = await deployer.deploy({
      name: name.trim(),
      symbol: symbol.trim(),
      tokenAdmin: wallet as Address,
      image: imageUrl.trim(),
      metadata: {
        description: description.trim(),
        ...(socialMediaUrls.length > 0 ? { socialMediaUrls } : {}),
      },
      context: {
        platform: "montra-finance",
        id: record.id,
      },
      rewards: {
        recipients: [
          {
            recipient: feeRecipient as Address,
            admin: deployerAddress as Address,
            bps: 10000,
            feePreference: "Paired", // Receive fees in WETH
          },
        ],
      },
      vanity: false,
    });

    if (deployResult.error) {
      throw deployResult.error;
    }

    // Update status to confirming
    await supabase
      .from("token_deployments")
      .update({ status: "confirming", tx_hash: deployResult.txHash || null })
      .eq("id", record.id);

    // Wait for confirmation
    const confirmed = await deployResult.waitForTransaction();

    if (!confirmed.address) {
      throw new Error("Deployment confirmed but no token address returned");
    }

    // Update to deployed
    await supabase
      .from("token_deployments")
      .update({
        status: "deployed",
        token_address: confirmed.address.toLowerCase(),
        deployed_at: new Date().toISOString(),
      })
      .eq("id", record.id);

    // Queue Farcaster announcement (fire-and-forget)
    const eventKey = `token_deployed:${confirmed.address.toLowerCase()}`;
    supabase
      .from("farcaster_casts")
      .insert({
        event_type: "token_deployed",
        event_key: eventKey,
        cast_text: castTokenDeployed({
          name: name.trim(),
          symbol: symbol.trim(),
          tokenAddress: confirmed.address,
          deployerWallet: wallet,
        }),
        status: "pending",
      })
      .then(
        () => {},
        (err: any) => {
          console.warn("[token-factory] Failed to queue cast:", err.message);
        },
      );

    console.log(`[token-factory] Deployed $${symbol} at ${confirmed.address}`);

    return res.status(200).json({
      success: true,
      tokenAddress: confirmed.address,
      txHash: deployResult.txHash,
      name: name.trim(),
      symbol: symbol.trim(),
      feeRecipient,
      deploymentId: record.id,
    });
  } catch (err: any) {
    console.error(`[token-factory] Deployment failed:`, err.message);

    // Update record as failed
    await supabase
      .from("token_deployments")
      .update({
        status: "failed",
        error_message: err.message?.slice(0, 500),
      })
      .eq("id", record.id);

    return res.status(500).json({
      error: "Deployment failed",
      details: err.message,
      deploymentId: record.id,
    });
  }
}

export default withX402(
  { priceUsd: PRICE_USD, description: "Deploy ERC-20 token via Clawncher on Base" },
  handleDeploy,
);
