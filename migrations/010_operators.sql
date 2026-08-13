-- S2 · Operadores humanos (identidade persistente) — senha NUNCA em claro (password_hash argon2id).
CREATE TABLE IF NOT EXISTS operators (
    id            UUID PRIMARY KEY,
    email         TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'admin',
    active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_operators_email ON operators (lower(email));
