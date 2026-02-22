# Contributing to Montra MCP Server

Thanks for your interest in contributing to Montra Finance's open-source MCP server. Here's how to help.

---

## Ways to Contribute

### New Tools
Add tools that expand Montra's capabilities:
- New market data integrations (DEX aggregators, L2 analytics)
- Chain-specific tools (bridge status, gas comparison)
- Advanced analytics (correlation analysis, regime detection)
- Social intelligence (Twitter sentiment, Farcaster analytics)

### Documentation
- Tool usage examples with sample conversations
- Workflow guides for common trading scenarios
- Integration guides for other MCP clients
- Video tutorials and walkthroughs

### Bug Reports
Open an issue with:
- Tool name and parameters used
- Expected vs actual behavior
- Error message (if any)
- Environment (Node version, OS)

### Testing
- Unit tests for tool handlers
- Integration tests against Supabase
- Mock responses for external APIs

---

## Development Setup

```bash
# Clone
git clone https://github.com/MontraFinance/montra-mcp-server.git
cd montra-mcp-server

# Install
npm install

# Run
npx tsx src/index.ts

# Type check
npx tsc --noEmit
```

---

## Adding a New Tool

1. Create `src/tools/your-tool-name.ts`
2. Export a function that takes `(server: McpServer)` and registers the tool
3. Use Zod for input validation
4. Return structured JSON
5. Register in `src/index.ts`
6. Add docs to `TOOLS.md`

**Template:**

```typescript
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerYourTool(server: McpServer) {
  server.tool(
    "your_tool_name",
    "Description of what this tool does",
    {
      param1: z.string().describe("What this parameter is"),
      param2: z.number().optional().describe("Optional parameter"),
    },
    async ({ param1, param2 }) => {
      // Your logic here
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
```

---

## Code Style

- TypeScript strict mode
- Zod for all input validation
- Descriptive tool names with underscores (`get_token_price`)
- JSON responses with structured data
- Error handling with informative messages
- No secrets in code — use environment variables

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
