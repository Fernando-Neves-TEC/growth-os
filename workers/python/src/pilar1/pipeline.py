"""Pipeline de Pilar 1: coletar → normalizar/dedup → filtrar → pontuar → enriquecer."""
from __future__ import annotations

from dataclasses import dataclass, field

from ..models import EnrichedLead
from .collectors.base import LeadCollector
from .enrich import enrich
from .filter import predictive_filter
from .normalize import deduplicate
from .score import icp_score


@dataclass
class IcpRules:
    cnae_allowlist: list[str]
    region_allowlist: list[str]
    min_capital: float
    allowed_portes: list[str] | None = None


@dataclass
class PipelineResult:
    qualified: list[EnrichedLead] = field(default_factory=list)
    collected: int = 0
    deduplicated: int = 0
    rejected: int = 0
    rejection_reasons: dict[str, int] = field(default_factory=dict)

    @property
    def qualified_count(self) -> int:
        return len(self.qualified)


def run_pipeline(
    collectors: list[LeadCollector],
    query: str,
    region: str,
    limit: int,
    icp: IcpRules,
) -> PipelineResult:
    result = PipelineResult()

    raw: list = []
    for c in collectors:
        raw.extend(c.collect(query, region, limit))
    result.collected = len(raw)

    deduped = deduplicate(raw)
    result.deduplicated = len(deduped)

    filt = predictive_filter(
        deduped,
        cnae_allowlist=icp.cnae_allowlist,
        region_allowlist=icp.region_allowlist,
        min_capital=icp.min_capital,
        allowed_portes=icp.allowed_portes,
    )
    result.rejected = len(filt.rejected)
    for _, reason in filt.rejected:
        result.rejection_reasons[reason] = result.rejection_reasons.get(reason, 0) + 1

    scored: list[EnrichedLead] = []
    for lead in filt.kept:
        e = enrich(lead)
        e.icp_fit_score = icp_score(lead, icp.cnae_allowlist, icp.region_allowlist, icp.min_capital)
        scored.append(e)

    scored.sort(key=lambda l: l.icp_fit_score, reverse=True)
    result.qualified = scored
    return result
