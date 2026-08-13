-- F3 · Campanhas persistentes
CREATE TABLE IF NOT EXISTS campaigns (
    id         UUID PRIMARY KEY,
    name       TEXT NOT NULL,
    workflow   JSONB NOT NULL,
    status     TEXT NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_created ON campaigns (created_at);
