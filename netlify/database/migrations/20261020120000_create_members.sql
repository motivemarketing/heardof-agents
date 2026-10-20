-- Heard Of for Agents: members, login links, background jobs and weekly Instagram snapshots.

CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  tier TEXT NOT NULL DEFAULT 'toolkit' CHECK (tier IN ('toolkit', 'coaching')),
  ghl_contact_id TEXT,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  ig_handle TEXT,
  business_name TEXT,
  city TEXT,
  region TEXT,
  market_size TEXT NOT NULL DEFAULT 'mid' CHECK (market_size IN ('small', 'mid', 'metro')),
  place_id TEXT,
  app_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE login_tokens (
  token_hash TEXT PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);
CREATE INDEX login_tokens_member_idx ON login_tokens (member_id);

CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('audit', 'leaders')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'error')),
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);
CREATE INDEX jobs_member_kind_idx ON jobs (member_id, kind, created_at DESC);

CREATE TABLE ig_snapshots (
  id BIGSERIAL PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  handle TEXT NOT NULL,
  taken_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  followers INTEGER,
  posts_30d INTEGER,
  video_pct INTEGER,
  post_dates JSONB NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX ig_snapshots_member_idx ON ig_snapshots (member_id, taken_at DESC);
