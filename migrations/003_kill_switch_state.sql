-- F3 · Estado durável do kill-switch (sobrevive a restart — fail-closed)
CREATE TABLE IF NOT EXISTS kill_switch_state (
    id         INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    paused     BOOLEAN NOT NULL DEFAULT FALSE,
    reason     TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO kill_switch_state (id, paused, reason) VALUES (1, FALSE, NULL)
ON CONFLICT (id) DO NOTHING;
