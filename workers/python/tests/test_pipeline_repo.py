"""Persistência do pipeline de leads — testes (integração, pula sem banco)."""
import os

import pytest

from src.pipeline.repo import LeadRepository, persist_pipeline
from src.pilar1.collectors.cnpj_collector import CnpjCollector
from src.pilar1.collectors.maps_collector import MapsCollector
from src.pilar1.pipeline import IcpRules, run_pipeline

DB_URL = os.environ.get("GROWTHOS_DB_URL", "postgresql://growthos:growthos@host.docker.internal:5433/growthos")


def _db_ok() -> bool:
    try:
        repo = LeadRepository(DB_URL)
        with repo._connect() as conn:
            conn.execute("SELECT 1")
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _db_ok(), reason="Postgres indisponível (integração ignorada)")


def test_persist_pipeline_grava_run_e_leads():
    repo = LeadRepository(DB_URL)
    icp = IcpRules(
        cnae_allowlist=["6911701", "7020400", "8610101"],
        region_allowlist=["SP", "RJ", "MG"],
        min_capital=50000,
        allowed_portes=["ME", "EPP", "MP"],
    )
    result = run_pipeline([MapsCollector(), CnpjCollector()], "consultoria", "SP", limit=20, icp=icp)
    stats = persist_pipeline(result, "run-test-001", "consultoria", "SP", repo)
    assert stats["qualified"] > 0
    assert stats["leads_persisted"] == stats["qualified"]

    with repo._connect() as conn:
        row = conn.execute("SELECT qualified FROM pipeline_runs WHERE run_id=%s", ("run-test-001",)).fetchone()
        assert row is not None and row[0] == stats["qualified"]
        n = conn.execute("SELECT count(*) FROM leads_enriched WHERE pipeline_run_id=%s", ("run-test-001",)).fetchone()[0]
        assert n == stats["qualified"]
        # limpeza
        conn.execute("DELETE FROM leads_enriched WHERE pipeline_run_id=%s", ("run-test-001",))
        conn.execute("DELETE FROM pipeline_runs WHERE run_id=%s", ("run-test-001",))
