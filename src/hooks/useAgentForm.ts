import { z } from 'zod';

export const deployAgentSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(32, 'Name must be 32 characters or less'),
  strategyId: z.enum(['momentum', 'mean_reversion', 'arbitrage', 'breakout', 'grid_trading', 'dca'], {
    required_error: 'Select a strategy',
  }),
  budgetAmount: z.number({ required_error: 'Enter a budget amount' }).min(100, 'Minimum budget is 100').max(1_000_000, 'Maximum budget is 1,000,000'),
  budgetCurrency: z.enum(['MONTRA', 'USDC']),
  maxDrawdownPct: z.number().min(1).max(50),
  maxPositionSizePct: z.number().min(1).max(100),
  mandate: z.string().max(280).optional().default(''),
});

export type DeployAgentFormData = z.infer<typeof deployAgentSchema>;

export const defaultFormValues: DeployAgentFormData = {
  name: '',
  strategyId: 'momentum',
  budgetAmount: 1000,
  budgetCurrency: 'USDC',
  maxDrawdownPct: 15,
  maxPositionSizePct: 25,
  mandate: '',
};
