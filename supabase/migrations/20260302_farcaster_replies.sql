CREATE TABLE farcaster_replies (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mention_hash  TEXT NOT NULL UNIQUE,
  mention_text  TEXT,
  author_fid    BIGINT NOT NULL,
  author_name   TEXT,
  reply_text    TEXT,
  reply_hash    TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',
  error         TEXT,
  replied_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_farcaster_replies_mention_hash ON farcaster_replies(mention_hash);
CREATE INDEX idx_farcaster_replies_author_cooldown ON farcaster_replies(author_fid, replied_at DESC);
CREATE INDEX idx_farcaster_replies_status ON farcaster_replies(status);
