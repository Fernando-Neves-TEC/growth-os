"""Persistência do pipeline de leads (Pilar 1 → PostgreSQL).

Adapters reais para a camada de dados; nenhuma ação comercial real.
URL padrão aponta para o Postgres do compose (localhost:5433); em container,
use GROWTHOS_DB_URL com host.docker.internal.
"""
from __future__ import annotations

import os
from typing import Any

try:
    import psycopg
except ImportError:  # pragma: no cover
    psycopg = None  # type: ignore

DB_URL = os.environ.get(
    "GROWTHOS_DB_URL",
    "postgresql://growthos:growthos@localhost:5433/growthos",
)


class LeadRepository:
    def __init__(self, url: str | None = None) -> None:
        self.url = url or DB_URL
        if psycopg is None:
            raise RuntimeError("psycopg não instalado — rode com requirements.txt")

    def _connect(self):
        return psycopg.connect(self.url)

    def save_run(
        self,
        run_id: str,
        query: str,
        region: str,
        collected: int,
        deduplicated: int,
        rejected: int,
        qualified: int,
    ) -> None:
        with self._connect() as conn:
            conn.execute(
                """INSERT INTO pipeline_runs (run_id, query, region, collected, deduplicated, rejected, qualified)
                   VALUES (%s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT (run_id) DO NOTHING""",
                (run_id, query, region, collected, deduplicated, rejected, qualified),
            )

    def upsert_leads(self, leads: list[Any], run_id: str) -> int:
        n = 0
        with self._connect() as conn:
            for lead in leads:
                conn.execute(
                    """INSERT INTO leads_enriched
                       (cnpj, company_name, cnae, city, state, address, phone, whatsapp, whatsapp_verified,
                        email, email_verified, website, capital, porte, rating, icp_fit_score, source,
                        legal_basis, pipeline_run_id)
                       VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                       ON CONFLICT (cnpj) DO UPDATE SET
                         icp_fit_score = EXCLUDED.icp_fit_score,
                         processed_at = now()""",
                    (
                        lead.cnpj,
                        lead.company_name,
                        lead.cnae,
                        lead.city,
                        lead.state,
                        lead.address,
                        lead.phone,
                        lead.whatsapp,
                        lead.whatsapp_verified,
                        lead.email,
                        lead.email_verified,
                        lead.website,
                        lead.capital,
                        lead.porte,
                        lead.rating,
                        lead.icp_fit_score,
                        lead.source,
                        lead.legal_basis,
                        run_id,
                    ),
                )
                n += 1
        return n


def persist_pipeline(result: Any, run_id: str, query: str, region: str, repo: LeadRepository | None = None) -> dict:
    """Persiste um PipelineResult e devolve estatísticas de rastreabilidade."""
    repo = repo or LeadRepository()
    repo.save_run(
        run_id,
        query,
        region,
        result.collected,
        result.deduplicated,
        result.rejected,
        result.qualified_count,
    )
    inserted = repo.upsert_leads(result.qualified, run_id)
    return {
        "run_id": run_id,
        "collected": result.collected,
        "deduplicated": result.deduplicated,
        "rejected": result.rejected,
        "qualified": result.qualified_count,
        "leads_persisted": inserted,
    }
