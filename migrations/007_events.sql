-- F3 · Eventos do funil (ingestão idempotente por event_id)
CREATE TABLE IF NOT EXISTS events (
    event_id    TEXT PRIMARY KEY,
    type        TEXT NOT NULL,
    cnpj        TEXT,
    channel     TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_type ON events (type);
CREATE INDEX IF NOT EXISTS idx_events_cnpj ON events (cnpj);
