"""Filtragem preditiva (Pilar 1) — elimina desqualificados na raiz.

Critérios: CNAE (nicho), região/UF, capital social mínimo, porte.
Regra de ouro: o filtro trabalha antes do primeiro custo de envio.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from ..models import RawLead


@dataclass
class FilterResult:
    kept: list[RawLead] = field(default_factory=list)
    rejected: list[tuple[RawLead, str]] = field(default_factory=list)

    @property
    def rejection_rate(self) -> float:
        total = len(self.kept) + len(self.rejected)
        return (len(self.rejected) / total) if total else 0.0


def _in_allowlist(value: str, allowlist: list[str]) -> bool:
    return value.strip() in {x.strip() for x in allowlist}


def predictive_filter(
    leads: list[RawLead],
    cnae_allowlist: list[str],
    region_allowlist: list[str],
    min_capital: float,
    allowed_portes: list[str] | None = None,
) -> FilterResult:
    """Aplica regras de ICP. Um lead reprovado sai com o motivo (rastreabilidade)."""
    result = FilterResult()
    allowed = {p.upper() for p in (allowed_portes or [])}
    for lead in leads:
        n = lead
        if cnae_allowlist and not _in_allowlist(n.cnae, cnae_allowlist):
            result.rejected.append((n, f"cnae_fora_icp:{n.cnae}"))
            continue
        if region_allowlist and not _in_allowlist(n.state, region_allowlist):
            result.rejected.append((n, f"regiao_fora_icp:{n.state}"))
            continue
        if min_capital > 0 and (n.capital or 0) < min_capital:
            result.rejected.append((n, f"capital_abaixo:{n.capital:.0f}"))
            continue
        if allowed and n.porte.upper() not in allowed:
            result.rejected.append((n, f"porte_fora_icp:{n.porte}"))
            continue
        result.kept.append(n)
    return result
