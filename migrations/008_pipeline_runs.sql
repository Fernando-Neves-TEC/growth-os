-- F3 · Rastreabilidade do pipeline de leads
CREATE TABLE IF NOT EXISTS pipeline_runs (
    run_id       TEXT PRIMARY KEY,
    query        TEXT,
    region       TEXT,
    collected    INT NOT NULL DEFAULT 0,
    deduplicated INT NOT NULL DEFAULT 0,
    rejected     INT NOT NULL DEFAULT 0,
    qualified    INT NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE leads_enriched ADD COLUMN IF NOT EXISTS pipeline_run_id TEXT;
ALTER TABLE leads_enriched ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_leads_enriched_run ON leads_enriched (pipeline_run_id);
