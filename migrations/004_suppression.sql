-- F3 · Lista de supressão (opt-out / LGPD) — durável
CREATE TABLE IF NOT EXISTS suppression (
    cnpj       TEXT PRIMARY KEY,
    reason     TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suppression_created ON suppression (created_at);
