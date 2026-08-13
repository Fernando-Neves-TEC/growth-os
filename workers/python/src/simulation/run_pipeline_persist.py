"""Pipeline persistente — CLI: roda o pipeline Pilar 1 e grava no PostgreSQL.

Uso (a partir do host):  python -m src.simulation.run_pipeline_persist --limit 225 --region SP
Em container, defina GROWTHOS_DB_URL=postgresql://growthos:growthos@host.docker.internal:5433/growthos
"""
from __future__ import annotations

import argparse
import json
import uuid

from ..pilar1.collectors.cnpj_collector import CnpjCollector
from ..pilar1.collectors.maps_collector import MapsCollector
from ..pilar1.pipeline import IcpRules, run_pipeline
from ..pipeline.repo import persist_pipeline


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=100)
    parser.add_argument("--region", default="SP")
    parser.add_argument("--query", default="consultoria")
    args = parser.parse_args()

    icp = IcpRules(
        cnae_allowlist=["6911701", "7020400", "8610101"],
        region_allowlist=["SP", "RJ", "MG"],
        min_capital=50000,
        allowed_portes=["ME", "EPP", "MP"],
    )
    result = run_pipeline(
        collectors=[MapsCollector(), CnpjCollector()],
        query=args.query,
        region=args.region,
        limit=args.limit,
        icp=icp,
    )
    run_id = f"run-{uuid.uuid4()}"
    stats = persist_pipeline(result, run_id, args.query, args.region)
    print(json.dumps(stats, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
