import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSupabase } from "../lib/supabase.js";
import { STRATEGIES } from "../lib/strategies.js";

export function registerEstimateRisk(server: McpServer) {
  server.tool(
    "estimate_risk",
    "Assess portfolio risk exposure across all agents: strategy concentration, drawdown exposure, budget utilization, and risk score",
    {
      walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Wallet address to assess risk for"),
    },
    async ({ walletAddress }) => {
      const supabase = getSupabase();

      const { data: agents, error } = await supabase
        .from("agents")
        .select("id, config, status, stats, wallet_data")
        .eq("wallet_address", walletAddress.toLowerCase());

      if (error) {
        return {
          content: [{ type: "text" as const, text: `Error fetching agents: ${error.message}` }],
          isError: true,
        };
      }

      const activeAgents = (agents || []).filter((a: any) => a.status === "active" || a.status === "deploying");

      if (activeAgents.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                wallet: walletAddress,
                riskScore: 0,
                riskLevel: "none",
                summary: "No active agents. Portfolio has zero trading risk exposure.",
                agents: [],
              }, null, 2),
            },
          ],
        };
      }

      // Strategy concentration analysis
      const strategyCounts: Record<string, { count: number; budget: number }> = {};
      let totalBudget = 0;
      let totalMaxDrawdown = 0;
      let highRiskBudget = 0;
      let medRiskBudget = 0;
      let lowRiskBudget = 0;

      for (const agent of activeAgents) {
        const config = agent.config || {};
        const wd = agent.wallet_data || {};
        const stratId = config.strategyId || "unknown";
        const budget = wd.allocatedBudget || 0;
        const maxDD = config.maxDrawdownPct || 15;

        totalBudget += budget;
        totalMaxDrawdown += budget * (maxDD / 100);

        if (!strategyCounts[stratId]) strategyCounts[stratId] = { count: 0, budget: 0 };
        strategyCounts[stratId].count++;
        strategyCounts[stratId].budget += budget;

        const strat = STRATEGIES.find((s) => s.id === stratId);
        if (strat?.riskLevel === "high") highRiskBudget += budget;
        else if (strat?.riskLevel === "medium") medRiskBudget += budget;
        else lowRiskBudget += budget;
      }

      // Concentration risk: how much of budget is in a single strategy
      const maxConcentration = totalBudget > 0
        ? Math.max(...Object.values(strategyCounts).map((s) => s.budget / totalBudget)) * 100
        : 0;

      // Diversification score (1 = all in one strategy, 0 = perfectly spread)
      const strategyCount = Object.keys(strategyCounts).length;
      const concentrationRisk = strategyCount <= 1 ? 100 : Math.round(maxConcentration);

      // High risk exposure ratio
      const highRiskPct = totalBudget > 0 ? Math.round((highRiskBudget / totalBudget) * 100) : 0;

      // Max portfolio drawdown (weighted sum of agent max drawdowns)
      const portfolioMaxDD = totalBudget > 0
        ? Math.round((totalMaxDrawdown / totalBudget) * 10000) / 100
        : 0;

      // Composite risk score (0-100)
      let riskScore = 0;
      riskScore += highRiskPct * 0.35;          // High-risk allocation weight
      riskScore += concentrationRisk * 0.25;     // Concentration weight
      riskScore += portfolioMaxDD * 0.25;        // Drawdown exposure weight
      riskScore += (activeAgents.length > 5 ? 15 : activeAgents.length * 3); // Complexity factor
      riskScore = Math.min(100, Math.round(riskScore));

      const riskLevel =
        riskScore >= 75 ? "critical" :
        riskScore >= 50 ? "high" :
        riskScore >= 30 ? "moderate" :
        riskScore >= 10 ? "low" : "minimal";

      // Per-agent risk flags
      const agentRisks = activeAgents.map((a: any) => {
        const config = a.config || {};
        const stats = a.stats || {};
        const wd = a.wallet_data || {};
        const pnl = stats.pnlUsd ?? 0;
        const budget = wd.allocatedBudget || 1;
        const drawdownPct = pnl < 0 ? Math.abs(pnl / budget) * 100 : 0;
        const maxDD = config.maxDrawdownPct || 15;

        const flags: string[] = [];
        if (drawdownPct > maxDD * 0.8) flags.push("NEAR_MAX_DRAWDOWN");
        if (drawdownPct > maxDD) flags.push("EXCEEDED_MAX_DRAWDOWN");
        if ((stats.winRate ?? 0) < 40 && (stats.tradeCount ?? 0) > 20) flags.push("LOW_WIN_RATE");
        if (wd.remainingBudget < budget * 0.1) flags.push("LOW_REMAINING_BUDGET");

        return {
          agentId: a.id,
          name: config.name || a.id.slice(0, 12),
          strategy: config.strategyId,
          currentDrawdownPct: Math.round(drawdownPct * 100) / 100,
          maxDrawdownPct: maxDD,
          flags,
        };
      });

      const warnings = agentRisks.filter((a) => a.flags.length > 0);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                wallet: walletAddress,
                riskScore,
                riskLevel,
                activeAgents: activeAgents.length,
                totalBudgetAllocated: Math.round(totalBudget * 100) / 100,
                exposure: {
                  highRiskPct,
                  mediumRiskPct: totalBudget > 0 ? Math.round((medRiskBudget / totalBudget) * 100) : 0,
                  lowRiskPct: totalBudget > 0 ? Math.round((lowRiskBudget / totalBudget) * 100) : 0,
                },
                strategyConcentration: Object.entries(strategyCounts).map(([id, data]) => ({
                  strategyId: id,
                  agentCount: data.count,
                  budgetAllocated: Math.round(data.budget * 100) / 100,
                  portfolioPct: totalBudget > 0 ? Math.round((data.budget / totalBudget) * 100) : 0,
                })),
                portfolioMaxDrawdownPct: portfolioMaxDD,
                diversificationScore: Math.max(0, 100 - concentrationRisk),
                warnings: warnings.length > 0 ? warnings : "No active warnings",
                agents: agentRisks,
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
