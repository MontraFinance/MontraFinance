# Montra MCP — Quick Start Guide

Get Claude connected to Montra's trading intelligence in under 60 seconds.

---

## Prerequisites

- **Node.js** 18+ installed
- **Claude Desktop** or **Claude Code** installed
- A Supabase project (for agent/burn data)

---

## Step 1: Clone & Install

```bash
git clone https://github.com/MontraFinance/montra-mcp-server.git
cd montra-mcp-server
npm install
```

## Step 2: Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your keys:

```env
# Required
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Optional (enable more tools)
BASE_RPC_URL=https://mainnet.base.org
BURN_TOKEN_ADDRESS=0x...
COINGLASS_KEY=your-key
WHALE_ALERT_KEY=your-key
HELSINKI_BASE=https://api.helsinkivm.com
```

## Step 3: Connect to Claude

### Claude Code (fastest)

```bash
claude mcp add montra -- npx tsx src/index.ts
```

### Claude Desktop

Copy `mcp-config.json` contents into your `claude_desktop_config.json`:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "montra": {
      "command": "npx",
      "args": ["tsx", "src/index.ts"],
      "cwd": "/path/to/montra-mcp-server"
    }
  }
}
```

Restart Claude Desktop.

## Step 4: Verify

Ask Claude:

> "List the available Montra trading strategies"

If Claude responds with 6 strategies (Momentum Rider, Mean Reversion, etc.), you're connected to 30 tools.

---

## Try These

| Ask Claude... | Tools Used |
|---------------|------------|
| "What strategies are available?" | `list_strategies` |
| "Check my tier for 0x..." | `check_tier` |
| "What's the price of DEGEN?" | `get_token_price` |
| "Deploy a grid trading agent with $200" | `launch_agent` |
| "Give me a full portfolio review" | `deploy-agent` prompt |
| "How's the gas on Base right now?" | `get_gas_status` |
| "Research AERO token before I buy" | `token-research` prompt |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Claude doesn't see Montra tools | Restart Claude after config change |
| "SUPABASE_URL not set" | Check your `.env` file |
| Agent deploy fails | Ensure `agents` table exists in Supabase |
| Price lookups return null | DexScreener API is rate-limited — wait 10s |
| Gas status fails | Check `BASE_RPC_URL` is valid |

---

**Full docs:** [README.md](README.md) | **Tool reference:** [TOOLS.md](TOOLS.md)
