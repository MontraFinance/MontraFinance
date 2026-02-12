import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSupabase } from "../lib/supabase.js";

export function registerExportPnl(server: McpServer) {
  server.tool(
    "export_pnl",
    "Export formatted P&L report for one or all agents — includes summary stats, per-agent breakdown, and P&L time series data",
    {
      walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Wallet address"),
      agentId: z.string().optional().describe("Specific agent ID (omit for all agents)"),
      format: z.enum(["summary", "detailed", "csv"]).optional().describe("Report format: summary (default), detailed (with P&L history), csv (comma-separated)"),
    },
    async ({ walletAddress, agentId, format }) => {
      const supabase = getSupabase();
      const reportFormat = format ?? "summary";

      let query = supabase
        .from("agents")
        .select("id, config, status, stats, wallet_data, pnl_history, created_at")
        .eq("wallet_address", walletAddress.toLowerCase());

      if (agentId) {
        query = query.eq("id", agentId);
      }

      const { data: agents, error } = await query.order("created_at", { ascending: false });

      if (error) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
          isError: true,
        };
      }

      if (!agents || agents.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No agents found for this wallet." }],
          isError: true,
        };
      }

      if (reportFormat === "csv") {
        const header = "agent_id,name,strategy,status,pnl_usd,pnl_pct,trade_count,win_rate,allocated_budget,remaining_budget,currency,created_at";
        const rows = agents.map((a: any) => {
          const c = a.config || {};
          const s = a.stats || {};
          const w = a.wallet_data || {};
          return [
            a.id,
            `"${(c.name || "").replace(/"/g, '""')}"`,
            c.strategyId || "",
            a.status,
            s.pnlUsd ?? s.totalPnl ?? 0,
            s.pnlPct ?? 0,
            s.tradeCount ?? s.totalTrades ?? 0,
            s.winRate ?? 0,
            w.allocatedBudget ?? 0,
            w.remainingBudget ?? 0,
            w.currency || c.budgetCurrency || "",
            a.created_at,
          ].join(",");
        });

        return {
          content: [
            {
              type: "text" as const,
              text: [header, ...rows].join("\n"),
            },
          ],
        };
      }

      // Build report
      const agentReports = agents.map((a: any) => {
        const config = a.config || {};
        const stats = a.stats || {};
        const wd = a.wallet_data || {};
        const pnlHistory: any[] = a.pnl_history || [];

        const allocated = wd.allocatedBudget || 0;
        const remaining = wd.remainingBudget || 0;
        const pnl = stats.pnlUsd ?? stats.totalPnl ?? 0;

        const report: any = {
          agentId: a.id,
          name: config.name || a.id,
          strategy: config.strategyId,
          status: a.status,
          createdAt: a.created_at,
          pnl: {
            usd: Math.round(pnl * 100) / 100,
            pct: stats.pnlPct ?? 0,
            direction: pnl > 0 ? "profit" : pnl < 0 ? "loss" : "flat",
          },
          trades: {
            count: stats.tradeCount ?? stats.totalTrades ?? 0,
            winRate: stats.winRate ?? 0,
          },
          budget: {
            allocated: Math.round(allocated * 100) / 100,
            remaining: Math.round(remaining * 100) / 100,
            used: Math.round((allocated - remaining) * 100) / 100,
            currency: wd.currency || config.budgetCurrency || "USDC",
            roi: allocated > 0 ? Math.round((pnl / allocated) * 10000) / 100 : 0,
          },
        };

        if (reportFormat === "detailed" && pnlHistory.length > 0) {
          report.pnlHistory = pnlHistory.slice(-48);
          report.pnlHistoryCount = pnlHistory.length;
        }

        return report;
      });

      // Portfolio-level summary
      const totalPnl = agentReports.reduce((s: number, a: any) => s + a.pnl.usd, 0);
      const totalAllocated = agentReports.reduce((s: number, a: any) => s + a.budget.allocated, 0);
      const totalTrades = agentReports.reduce((s: number, a: any) => s + a.trades.count, 0);

      const bestAgent = agentReports.reduce((best: any, a: any) =>
        a.pnl.usd > (best?.pnl?.usd ?? -Infinity) ? a : best, agentReports[0]);
      const worstAgent = agentReports.reduce((worst: any, a: any) =>
        a.pnl.usd < (worst?.pnl?.usd ?? Infinity) ? a : worst, agentReports[0]);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                wallet: walletAddress,
                reportFormat,
                generatedAt: new Date().toISOString(),
                summary: {
                  totalAgents: agents.length,
                  activeAgents: agents.filter((a: any) => a.status === "active").length,
                  totalPnlUsd: Math.round(totalPnl * 100) / 100,
                  totalAllocatedBudget: Math.round(totalAllocated * 100) / 100,
                  portfolioRoi: totalAllocated > 0 ? Math.round((totalPnl / totalAllocated) * 10000) / 100 : 0,
                  totalTrades,
                  bestPerformer: bestAgent ? { name: bestAgent.name, pnlUsd: bestAgent.pnl.usd } : null,
                  worstPerformer: worstAgent ? { name: worstAgent.name, pnlUsd: worstAgent.pnl.usd } : null,
                },
                agents: agentReports,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
