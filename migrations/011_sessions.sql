-- S2 · Sessões de operador mantidas pelo servidor (cookie HttpOnly).
-- token_hash = sha256(token bruto) — o token bruto só existe no cookie do cliente.
CREATE TABLE IF NOT EXISTS sessions (
    id            UUID PRIMARY KEY,
    operator_id   UUID NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
    token_hash    TEXT NOT NULL,
    csrf_token    TEXT NOT NULL,
    expires_at    TIMESTAMPTZ NOT NULL,
    ip            TEXT,
    user_agent    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at    TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sessions_token_hash ON sessions (token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_operator ON sessions (operator_id);
