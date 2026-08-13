"""Lead scoring — ICP fit score 0..100 (Pilar 1)."""
from __future__ import annotations

from ..models import EnrichedLead, RawLead


def _bucketed(value: float, bins: list[tuple[float, float, float]]) -> float:
    """Retorna a contribuição do primeiro bin com intervalo semi-aberto [lo, hi)."""
    for lo, hi, score in bins:
        if lo <= value < hi:
            return score
    return 0.0


_CAPITAL_BINS = [
    (0, 100_000, 5.0),
    (100_000, 500_000, 15.0),
    (500_000, 2_000_000, 22.0),
    (2_000_000, float("inf"), 25.0),
]

_PORTE_SCORE = {"ME": 10.0, "EPP": 15.0, "MP": 12.0, "DEMAIS": 8.0}


def icp_score(
    lead: RawLead | EnrichedLead,
    cnae_allowlist: list[str],
    region_allowlist: list[str],
    min_capital: float,
) -> float:
    """Pontua o fit do lead com o ICP (0..100). Não substitui o filtro; prioriza."""
    score = 0.0
    if lead.cnae in {x for x in cnae_allowlist}:
        score += 30.0
    if lead.state in {x for x in region_allowlist}:
        score += 20.0
    score += _bucketed(lead.capital or 0.0, _CAPITAL_BINS)
    score += _PORTE_SCORE.get(lead.porte.upper(), 0.0)
    if lead.rating is not None:
        score += max(0.0, (lead.rating - 3.0)) * 5.0  # bônus até 10 pts
    return round(min(score, 100.0), 1)
