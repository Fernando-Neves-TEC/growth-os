-- S1 · Pilar 1 — tabela de leads brutos normalizados
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS leads_raw (
    id          BIGSERIAL PRIMARY KEY,
    raw_id      TEXT,
    source      TEXT NOT NULL,
    company_name TEXT NOT NULL,
    cnpj        TEXT NOT NULL UNIQUE,
    cnae        TEXT,
    address     TEXT,
    city        TEXT,
    state       TEXT,
    phone       TEXT,
    website     TEXT,
    email       TEXT,
    capital     NUMERIC(14,2) DEFAULT 0,
    porte       TEXT,
    rating      NUMERIC(3,1),
    simulated   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_raw_cnpj ON leads_raw (cnpj);
CREATE INDEX IF NOT EXISTS idx_leads_raw_state ON leads_raw (state);
CREATE INDEX IF NOT EXISTS idx_leads_raw_cnae ON leads_raw (cnae);
