-- GAUNTLET SECURITY CLOSURE — Baixo A: FK em security_audit_events.actor_operator_id.
-- ON DELETE SET NULL (NUNCA CASCADE): o histórico de auditoria sobrevive à remoção do operador
-- (sessões usam CASCADE, mas auditoria é append-only e deve ser preservada).
-- Determinístico: órfãos (operador já removido) viram NULL antes de criar a FK.
UPDATE security_audit_events
   SET actor_operator_id = NULL
 WHERE actor_operator_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM operators o WHERE o.id = security_audit_events.actor_operator_id);

ALTER TABLE security_audit_events
    ADD CONSTRAINT fk_security_audit_actor_operator
    FOREIGN KEY (actor_operator_id) REFERENCES operators(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_security_audit_actor ON security_audit_events (actor_operator_id);
