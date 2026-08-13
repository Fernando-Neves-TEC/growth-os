"""Simulação E2E (S8) — pipeline completo Growth OS em modo simulação.

Fluxo: Pilar 1 (coleta→dedup→filtro→score→enriquecimento)
       → Pilar 2 (sequenciamento com warm-up)
       → Pilar 3 (agente + qualificação + agendamento)
       → Pilar 4 (métricas, saúde do canal, ARR projetado).

Nenhum canal real é acionado: canais são simulados com probabilidades do
funil âncora (225 → 2 clientes → ARR ~R$ 35.6k).
"""
from __future__ import annotations

import json
import random

from ..models import Qualification
from ..pilar1.collectors.cnpj_collector import CnpjCollector
from ..pilar1.collectors.maps_collector import MapsCollector
from ..pilar1.pipeline import IcpRules, run_pipeline
from ..pilar3.agent import AgentContext, AgentSession, SalesAgent
from ..pilar3.qualify import should_schedule
from ..pilar4.health import channel_health
from ..pilar4.metrics import arr_projected, funnel_metrics

# Probabilidades do funil âncora (conservadoras)
READ_PROB = 0.53      # 120/225
REPLY_PROB = 0.375    # 45/120
QUALIFY_PROB = 0.40   # 18/45
SCHEDULE_PROB = 0.55  # 10/18
CLOSE_PROB = 0.20     # 2/10

TICKET_MONTHLY = 1500.0

ICP = IcpRules(
    cnae_allowlist=["6911701", "7020400", "8610101"],
    region_allowlist=["SP", "RJ", "MG"],
    min_capital=50000,
    allowed_portes=["ME", "EPP", "MP"],
)


def run_simulation(limit: int = 225, seed: int = 42) -> dict:
    rng = random.Random(seed)

    # ---- Pilar 1: extração, normalização, filtro preditivo, scoring ----
    pipeline = run_pipeline(
        collectors=[MapsCollector(), CnpjCollector()],
        query="consultoria",
        region="SP",
        limit=limit,
        icp=ICP,
    )
    qualified = pipeline.qualified

    # ---- Pilar 2/3: simulação de envio e conversa ----
    counters = {"sent": 0, "delivered": 0, "read": 0, "replied": 0, "qualified": 0, "scheduled": 0, "closed": 0, "rejected": 0}
    agent = SalesAgent()
    agent_blocks = 0
    scheduled_slots: list[str] = []

    for lead in qualified:
        if not lead.whatsapp_verified:
            continue
        counters["sent"] += 1
        counters["delivered"] += 1 if rng.random() < 1.0 else 0
        if rng.random() >= READ_PROB:
            continue
        counters["read"] += 1
        if rng.random() >= REPLY_PROB:
            continue
        counters["replied"] += 1

        # Pilar 3: agente conversa (sem alucinação em simulação)
        ctx = AgentContext(lead_cnpj=lead.cnpj, segment=lead.cnae, icp_fit_score=lead.icp_fit_score)
        session = AgentSession()
        decision = agent.handle("qual o valor do plano pro?", ctx, session)
        if decision.blocked:
            agent_blocks += 1

        if rng.random() < QUALIFY_PROB:
            counters["qualified"] += 1
            q = Qualification(
                pain="Perdemos 20% dos no-shows e o custo de aquisição está alto",
                budget_range="1500-5000",
                urgency="imediata",
                decision_role="decisor",
            )
            if should_schedule(q, threshold=70) and rng.random() < SCHEDULE_PROB:
                counters["scheduled"] += 1
                scheduled_slots.append(f"slot-{lead.cnpj[-6:]}")
                if rng.random() < CLOSE_PROB:
                    counters["closed"] += 1

    # ---- Pilar 4: métricas, saúde e ARR ----
    metrics = funnel_metrics(counters)
    health = channel_health(
        delivered=counters["delivered"],
        sent=counters["sent"],
        rejected=counters["rejected"],
        read_rate=metrics["read_rate"],
        reply_rate=metrics["reply_rate"],
    )
    arr = arr_projected(counters["qualified"], SCHEDULE_PROB * 100, CLOSE_PROB * 100, TICKET_MONTHLY)

    return {
        "pilar1": {
            "collected": pipeline.collected,
            "deduplicated": pipeline.deduplicated,
            "rejected": pipeline.rejected,
            "qualified": pipeline.qualified_count,
            "rejection_top": sorted(pipeline.rejection_reasons.items(), key=lambda x: -x[1])[:3],
        },
        "funnel": counters,
        "metrics": metrics,
        "health": health,
        "arr_projected": arr,
        "agent_blocks": agent_blocks,
        "scheduled_slots": scheduled_slots,
    }


def main() -> None:
    report = run_simulation()
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
