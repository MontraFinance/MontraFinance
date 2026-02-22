# Security

## Environment Variables

All sensitive credentials are stored as environment variables — never hardcoded:

| Variable | Sensitivity | Notes |
|----------|-------------|-------|
| `SUPABASE_SERVICE_ROLE_KEY` | **Critical** | Full database access — never expose |
| `COINGLASS_KEY` | High | API key — rate-limited per key |
| `WHALE_ALERT_KEY` | High | API key — rate-limited per key |
| `BURN_TOKEN_ADDRESS` | Low | Public contract address |
| `BASE_RPC_URL` | Low | Public RPC endpoint |

## Best Practices

- **Never commit `.env` files** — `.env` is in `.gitignore`
- **Use environment-specific keys** — separate dev/staging/prod keys
- **Rotate keys regularly** — especially after team member changes
- **Minimize permissions** — Supabase RLS policies restrict access
- **No withdrawal permissions** — never grant wallet withdrawal access to API keys

## Wallet Safety

- The MCP server **reads** on-chain data but does NOT hold private keys
- Agent wallets are derived addresses — not custodial
- Portfolio scanning is read-only (Base RPC `eth_call`)
- No token transfers or approvals are executed by the MCP server

## Responsible Disclosure

If you discover a security vulnerability:

1. **Do NOT** open a public GitHub issue
2. Email: security@montrafinance.com
3. Include: description, reproduction steps, potential impact
4. We will respond within 48 hours

## Rate Limiting

All API proxy endpoints enforce rate limits:
- 10-30 requests/minute per IP
- Burst protection on write operations
- Automatic cooldown on repeated failures
