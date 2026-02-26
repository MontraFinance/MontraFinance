-- CEX Trade Execution Support
-- Extends cow_trade_queue to support centralized exchange order routing

ALTER TABLE cow_trade_queue
  ADD COLUMN IF NOT EXISTS exchange_key_id   UUID,
  ADD COLUMN IF NOT EXISTS exchange          TEXT,
  ADD COLUMN IF NOT EXISTS exchange_order_id TEXT,
  ADD COLUMN IF NOT EXISTS exchange_symbol   TEXT,
  ADD COLUMN IF NOT EXISTS execution_venue   TEXT NOT NULL DEFAULT 'cow';

-- Index for filtering by venue in the cron job
CREATE INDEX IF NOT EXISTS idx_trade_queue_venue
  ON cow_trade_queue(execution_venue, status);

-- Comment for clarity
COMMENT ON COLUMN cow_trade_queue.execution_venue IS 'cow = CoW Protocol on-chain, cex = centralized exchange';
COMMENT ON COLUMN cow_trade_queue.exchange_order_id IS 'Order ID returned by the exchange after placement';
COMMENT ON COLUMN cow_trade_queue.exchange_symbol IS 'Exchange trading pair symbol e.g. ETHUSDC, ETH-USDC';
