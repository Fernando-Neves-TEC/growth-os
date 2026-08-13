-- FKs relevantes (médios) — integridade referencial do pipeline e invariantes do funil.
-- leads_enriched.pipeline_run_id → pipeline_runs(run_id)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM leads_enriched le
        LEFT JOIN pipeline_runs pr ON le.pipeline_run_id = pr.run_id
        WHERE le.pipeline_run_id IS NOT NULL AND pr.run_id IS NULL
    ) THEN
        RAISE EXCEPTION 'existem leads_enriched órfãos de pipeline_runs — limpe antes de aplicar a FK';
    END IF;
END $$;

ALTER TABLE leads_enriched
    ADD CONSTRAINT fk_leads_pipeline_run
    FOREIGN KEY (pipeline_run_id)
    REFERENCES pipeline_runs(run_id)
    ON DELETE SET NULL;

-- Invariantes do funil (contadores não-negativos) — reforço no schema.
ALTER TABLE funnel_counters
    ADD CONSTRAINT ck_funnel_non_negative CHECK (
        sent >= 0 AND delivered >= 0 AND read >= 0 AND replied >= 0 AND
        qualified >= 0 AND scheduled >= 0 AND closed >= 0 AND rejected >= 0
    );
