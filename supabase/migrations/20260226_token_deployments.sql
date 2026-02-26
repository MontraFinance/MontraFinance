-- ERC-20 tokens deployed via Clawncher SDK through MontraFi Agent Token Factory.
-- Each deployment creates a Uniswap V4 pool with MEV protection on Base.
-- LP fee revenue feeds back into the $MONTRA buyback/burn flywheel.

create table if not exists token_deployments (
  id                  uuid primary key default gen_random_uuid(),
  token_address       text unique,
  token_name          text not null,
  token_symbol        text not null,
  token_image         text,
  token_description   text,
  deployer_wallet     text not null,
  fee_recipient       text not null,
  reward_bps          integer not null default 8000,
  tx_hash             text,
  total_fees_claimed  numeric(30,18) default 0,
  last_fee_claim_at   timestamptz,
  status              text not null default 'pending',
  error_message       text,
  payer_address       text,
  price_paid_usdc     numeric(18,6),
  created_at          timestamptz not null default now(),
  deployed_at         timestamptz
);

create index if not exists idx_token_deploy_status on token_deployments(status);
create index if not exists idx_token_deploy_deployer on token_deployments(deployer_wallet);
create index if not exists idx_token_deploy_created on token_deployments(created_at desc);
