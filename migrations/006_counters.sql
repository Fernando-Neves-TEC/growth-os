-- F3 · Contadores do funil + amostra de saúde do canal (durável)
CREATE TABLE IF NOT EXISTS funnel_counters (
    id         INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    sent       INT NOT NULL DEFAULT 0,
    delivered  INT NOT NULL DEFAULT 0,
    read       INT NOT NULL DEFAULT 0,
    replied    INT NOT NULL DEFAULT 0,
    qualified  INT NOT NULL DEFAULT 0,
    scheduled  INT NOT NULL DEFAULT 0,
    closed     INT NOT NULL DEFAULT 0,
    rejected   INT NOT NULL DEFAULT 0,
    read_rate  NUMERIC(5,1) NOT NULL DEFAULT 0,
    reply_rate NUMERIC(5,1) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO funnel_counters (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;
