-- S10 · Auditoria de segurança (append-only; gerado SOMENTE pelo servidor).
-- Metadados apropriados; NUNCA senha, API key, session token, CSRF ou connection string.
CREATE TABLE IF NOT EXISTS security_audit_events (
    id                BIGSERIAL PRIMARY KEY,
    occurred_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    event             TEXT NOT NULL,
    request_id        TEXT,
    actor_operator_id UUID,
    ip                TEXT,
    path              TEXT,
    user_agent        TEXT,
    metadata          JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_security_audit_event_time ON security_audit_events (occurred_at);
CREATE INDEX IF NOT EXISTS idx_security_audit_event_name ON security_audit_events (event);
