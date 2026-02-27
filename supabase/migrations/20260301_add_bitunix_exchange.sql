-- Add Bitunix to supported exchanges
-- The original CHECK constraint only allowed: binance, coinbase, bybit, okx

ALTER TABLE exchange_api_keys
  DROP CONSTRAINT IF EXISTS exchange_api_keys_exchange_check;

ALTER TABLE exchange_api_keys
  ADD CONSTRAINT exchange_api_keys_exchange_check
  CHECK (exchange IN ('binance', 'coinbase', 'bybit', 'okx', 'bitunix'));
