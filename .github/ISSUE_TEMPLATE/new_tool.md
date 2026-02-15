---
name: New Tool Proposal
about: Propose a new MCP tool for the server
title: "[TOOL] "
labels: new-tool
assignees: ''
---

## Tool Name

`tool_name_here`

## Category

- [ ] Trading
- [ ] Portfolio
- [ ] Price & Liquidity
- [ ] Burn & Tier
- [ ] Market Data
- [ ] Social / Messaging
- [ ] Analytics
- [ ] Network

## Description

What does this tool do? What data does it return?

## Parameters (Zod Schema)

```typescript
{
  param1: z.string().describe("Description"),
  param2: z.number().optional().describe("Description"),
}
```

## Example Response

```json
{
  "success": true,
  "data": {}
}
```

## Data Source

Where does the data come from?
- [ ] Supabase (existing tables)
- [ ] Base RPC (on-chain)
- [ ] External API (specify: ___)
- [ ] Computed / derived

## Dependencies

Does this tool require new environment variables, packages, or database tables?
