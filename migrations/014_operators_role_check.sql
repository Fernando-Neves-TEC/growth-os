-- HARDENING F-10 (RBAC): nesta fase existe SOMENTE o papel 'admin' (sem RBAC implementado).
-- CHECK impõe o único papel suportado para evitar estado ambíguo no banco.
-- Revisar quando houver requisito de produto para papéis adicionais (viewer/operator).
ALTER TABLE operators
    ADD CONSTRAINT ck_operators_role CHECK (role = 'admin');
