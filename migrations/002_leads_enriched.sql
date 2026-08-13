-- S2 · Pilar 1 — leads enriquecidos/qualificados + tabela de conhecimento do agente (RAG)
CREATE TABLE IF NOT EXISTS leads_enriched (
    id                 BIGSERIAL PRIMARY KEY,
    cnpj               TEXT UNIQUE,
    company_name       TEXT,
    cnae               TEXT,
    city               TEXT,
    state              TEXT,
    address            TEXT,
    phone              TEXT,
    whatsapp           TEXT,
    whatsapp_verified  BOOLEAN DEFAULT FALSE,
    email              TEXT,
    email_verified     BOOLEAN DEFAULT FALSE,
    website            TEXT,
    capital            NUMERIC(14,2) DEFAULT 0,
    porte              TEXT,
    rating             NUMERIC(3,1),
    icp_fit_score      NUMERIC(5,2) DEFAULT 0,
    source             TEXT,
    legal_basis        TEXT,
    opted_out          BOOLEAN DEFAULT FALSE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_enriched_state ON leads_enriched (state);
CREATE INDEX IF NOT EXISTS idx_leads_enriched_cnae ON leads_enriched (cnae);
CREATE INDEX IF NOT EXISTS idx_leads_enriched_score ON leads_enriched (icp_fit_score DESC);
