import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Core trading tools
import { registerListStrategies } from "./tools/list-strategies.js";
import { registerListAgents } from "./tools/list-agents.js";
import { registerGetPortfolio } from "./tools/get-portfolio.js";
import { registerLaunchAgent } from "./tools/launch-agent.js";
import { registerManageAgent } from "./tools/manage-agent.js";
import { registerRecomposePortfolio } from "./tools/recompose-portfolio.js";
import { registerCloneAgent } from "./tools/clone-agent.js";
import { registerCompareAgents } from "./tools/compare-agents.js";
import { registerGetAgentPerformance } from "./tools/get-agent-performance.js";
import { registerEstimateRisk } from "./tools/estimate-risk.js";
import { registerExportPnl } from "./tools/export-pnl.js";

// Portfolio & price tools
import { registerGetTokenPrice } from "./tools/get-token-price.js";
import { registerSearchTokens } from "./tools/search-tokens.js";
import { registerGetLiquidity } from "./tools/get-liquidity.js";
import { registerGetDashboard } from "./tools/get-dashboard.js";

// Burn & tier tools
import { registerGetBurnEstimate } from "./tools/get-burn-estimate.js";
import { registerGetBurnHistory } from "./tools/get-burn-history.js";
import { registerGetBurnAnalytics } from "./tools/get-burn-analytics.js";
import { registerCheckTier } from "./tools/check-tier.js";

// Market data & network tools
import { registerGetMarketData } from "./tools/get-market-data.js";
import { registerGetGasStatus } from "./tools/get-gas-status.js";

// Social
import { registerGetFarcasterActivity } from "./tools/get-farcaster-activity.js";

// XMTP messaging tools
import { registerSendXmtpMessage } from "./tools/send-xmtp-message.js";
import { registerGetXmtpConversations } from "./tools/get-xmtp-conversations.js";
import { registerManageAlerts } from "./tools/manage-alerts.js";
import { registerGetAlertSubscriptions } from "./tools/get-alert-subscriptions.js";

// Advanced analytics tools
import { registerBacktestStrategy } from "./tools/backtest-strategy.js";
import { registerGetCorrelationMatrix } from "./tools/get-correlation-matrix.js";
import { registerGetWhaleTransfers } from "./tools/get-whale-transfers.js";
import { registerGetTradeJournal } from "./tools/get-trade-journal.js";

// Resources & prompts
import { registerResources } from "./resources.js";
import { registerPrompts } from "./prompts.js";

// ── Startup banner ──

const BANNER = `
\x1b[36m
    ╔══════════════════════════════════════════════════════════════╗
    ║                                                              ║
    ║   ███╗   ███╗ ██████╗ ███╗   ██╗████████╗██████╗  █████╗    ║
    ║   ████╗ ████║██╔═══██╗████╗  ██║╚══██╔══╝██╔══██╗██╔══██╗   ║
    ║   ██╔████╔██║██║   ██║██╔██╗ ██║   ██║   ██████╔╝███████║   ║
    ║   ██║╚██╔╝██║██║   ██║██║╚██╗██║   ██║   ██╔══██╗██╔══██║   ║
    ║   ██║ ╚═╝ ██║╚██████╔╝██║ ╚████║   ██║   ██║  ██║██║  ██║   ║
    ║   ╚═╝     ╚═╝ ╚═════╝ ╚═╝  ╚═══╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝   ║
    ║                                                              ║
    ║          ⚡ F I N A N Q U A N T I X    M C P ⚡              ║
    ║            Autonomous Trading Infrastructure                 ║
    ║                    on Base Chain                              ║
    ║                                                              ║
    ╚══════════════════════════════════════════════════════════════╝
\x1b[0m`;

const TOOL_MANIFEST = [
  // Trading
  { name: "list_strategies",        group: "Trading" },
  { name: "list_agents",            group: "Trading" },
  { name: "launch_agent",           group: "Trading" },
  { name: "clone_agent",            group: "Trading" },
  { name: "manage_agent",           group: "Trading" },
  { name: "get_agent_performance",  group: "Trading" },
  { name: "compare_agents",         group: "Trading" },
  { name: "export_pnl",             group: "Trading" },
  // Portfolio
  { name: "recompose_portfolio",    group: "Portfolio" },
  { name: "get_portfolio",          group: "Portfolio" },
  { name: "get_dashboard",          group: "Portfolio" },
  { name: "estimate_risk",          group: "Portfolio" },
  // Price & Liquidity
  { name: "get_token_price",        group: "Price" },
  { name: "search_tokens",          group: "Price" },
  { name: "get_liquidity",          group: "Price" },
  // Burn & Tier
  { name: "get_burn_estimate",      group: "Burn" },
  { name: "get_burn_history",       group: "Burn" },
  { name: "get_burn_analytics",     group: "Burn" },
  { name: "check_tier",             group: "Tier" },
  // Market Data & Network
  { name: "get_market_data",        group: "Market Data" },
  { name: "get_gas_status",         group: "Network" },
  // Social
  { name: "get_farcaster_activity", group: "Social" },
  // XMTP Messaging
  { name: "send_xmtp_message",      group: "XMTP" },
  { name: "get_xmtp_conversations", group: "XMTP" },
  { name: "manage_alerts",          group: "XMTP" },
  { name: "get_alert_subscriptions",group: "XMTP" },
  // Advanced Analytics
  { name: "backtest_strategy",       group: "Analytics" },
  { name: "get_correlation_matrix",  group: "Analytics" },
  { name: "get_whale_transfers",     group: "Analytics" },
  { name: "get_trade_journal",       group: "Analytics" },
];

const RESOURCE_MANIFEST = [
  "montra://strategies",
  "montra://tiers",
  "montra://tokens",
  "montra://burn-pricing",
  "montra://platform",
];

const PROMPT_MANIFEST = [
  "deploy-agent",
  "portfolio-review",
  "market-brief",
  "agent-health-check",
  "risk-assessment",
  "token-research",
];

function printStartup() {
  console.error(BANNER);
  console.error("\x1b[33m  [BOOT]\x1b[0m Initializing Montra MCP Server v1.1.0...");
  console.error("\x1b[33m  [BOOT]\x1b[0m Loading environment configuration...");

  const envStatus = (key: string) => process.env[key] ? "\x1b[32m●\x1b[0m" : "\x1b[31m○\x1b[0m";
  console.error(`\x1b[33m  [ENV ]\x1b[0m  ${envStatus("SUPABASE_URL")} SUPABASE_URL`);
  console.error(`\x1b[33m  [ENV ]\x1b[0m  ${envStatus("SUPABASE_SERVICE_ROLE_KEY")} SUPABASE_SERVICE_ROLE_KEY`);
  console.error(`\x1b[33m  [ENV ]\x1b[0m  ${envStatus("BASE_RPC_URL")} BASE_RPC_URL`);
  console.error(`\x1b[33m  [ENV ]\x1b[0m  ${envStatus("BURN_TOKEN_ADDRESS")} BURN_TOKEN_ADDRESS`);
  console.error(`\x1b[33m  [ENV ]\x1b[0m  ${envStatus("COINGLASS_KEY")} COINGLASS_KEY`);
  console.error(`\x1b[33m  [ENV ]\x1b[0m  ${envStatus("WHALE_ALERT_KEY")} WHALE_ALERT_KEY`);
  console.error(`\x1b[33m  [ENV ]\x1b[0m  ${envStatus("HELSINKI_BASE")} HELSINKI_BASE`);
  console.error(`\x1b[33m  [ENV ]\x1b[0m  ${envStatus("XMTP_BOT_PRIVATE_KEY")} XMTP_BOT_PRIVATE_KEY`);
  console.error(`\x1b[33m  [ENV ]\x1b[0m  ${envStatus("XMTP_ENV")} XMTP_ENV`);

  console.error("");
  console.error("\x1b[33m  [LOAD]\x1b[0m Registering tools...");

  const groups: Record<string, string[]> = {};
  for (const t of TOOL_MANIFEST) {
    if (!groups[t.group]) groups[t.group] = [];
    groups[t.group].push(t.name);
  }
  for (const [group, tools] of Object.entries(groups)) {
    console.error(`\x1b[33m  [TOOL]\x1b[0m  \x1b[35m${group}\x1b[0m`);
    for (const name of tools) {
      console.error(`\x1b[33m  [TOOL]\x1b[0m    \x1b[32m✓\x1b[0m ${name}`);
    }
  }

  console.error("");
  console.error("\x1b[33m  [RSRC]\x1b[0m Registering resources...");
  for (const uri of RESOURCE_MANIFEST) {
    console.error(`\x1b[33m  [RSRC]\x1b[0m    \x1b[32m✓\x1b[0m ${uri}`);
  }

  console.error("");
  console.error("\x1b[33m  [PRMT]\x1b[0m Registering prompts...");
  for (const name of PROMPT_MANIFEST) {
    console.error(`\x1b[33m  [PRMT]\x1b[0m    \x1b[32m✓\x1b[0m ${name}`);
  }

  console.error("");
  console.error(`\x1b[33m  [LIVE]\x1b[0m \x1b[32m${TOOL_MANIFEST.length} tools | ${RESOURCE_MANIFEST.length} resources | ${PROMPT_MANIFEST.length} prompts — system online\x1b[0m`);
  console.error(`\x1b[33m  [LIVE]\x1b[0m Listening on stdio transport...`);
  console.error("");
}

// ── Server setup ──

const server = new McpServer({
  name: "montra-mcp",
  version: "1.1.0",
});

// Register trading tools
registerListStrategies(server);
registerListAgents(server);
registerLaunchAgent(server);
registerCloneAgent(server);
registerManageAgent(server);
registerGetAgentPerformance(server);
registerCompareAgents(server);
registerExportPnl(server);

// Register portfolio tools
registerRecomposePortfolio(server);
registerGetPortfolio(server);
registerGetDashboard(server);
registerEstimateRisk(server);

// Register price & liquidity tools
registerGetTokenPrice(server);
registerSearchTokens(server);
registerGetLiquidity(server);

// Register burn & tier tools
registerGetBurnEstimate(server);
registerGetBurnHistory(server);
registerGetBurnAnalytics(server);
registerCheckTier(server);

// Register market data & network tools
registerGetMarketData(server);
registerGetGasStatus(server);

// Register social tools
registerGetFarcasterActivity(server);

// Register XMTP messaging tools
registerSendXmtpMessage(server);
registerGetXmtpConversations(server);
registerManageAlerts(server);
registerGetAlertSubscriptions(server);

// Register advanced analytics tools
registerBacktestStrategy(server);
registerGetCorrelationMatrix(server);
registerGetWhaleTransfers(server);
registerGetTradeJournal(server);

// Register resources & prompts
registerResources(server);
registerPrompts(server);

// Print startup banner to stderr (stdout is reserved for MCP protocol)
printStartup();

// Connect via stdio
const transport = new StdioServerTransport();
await server.connect(transport);
