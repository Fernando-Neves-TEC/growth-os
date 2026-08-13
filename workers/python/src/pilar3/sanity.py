"""Guarda de sanidade anti-alucinação (Pilar 3) — camada pós-LLM.

Bloqueia frases da lista negra e valores monetários não verificados na base
antes do envio da resposta.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

MONEY_RE = re.compile(r"R\$\s?\d[\d.]*(?:,\d{1,2})?")

DEFAULT_BLOCKLIST = ["garantido", "resultado certo", "aprovação garantida", "te garanto", "100% garantido"]


@dataclass
class SanityCheck:
    passed: bool
    blocked_phrases: list[str] = field(default_factory=list)
    unverified_prices: list[str] = field(default_factory=list)


def check_sanity(
    reply: str,
    blocklist: list[str] | None = None,
    verified_prices: set[str] | None = None,
) -> SanityCheck:
    low = reply.lower()
    blocked = [p for p in (blocklist or DEFAULT_BLOCKLIST) if p.lower() in low]
    prices_found = MONEY_RE.findall(reply)

    unverified: list[str] = []
    if verified_prices is not None:
        # normaliza para comparar apenas dígitos
        norm = {re.sub(r"\D", "", p) for p in verified_prices}
        for p in prices_found:
            if re.sub(r"\D", "", p) not in norm:
                unverified.append(p)

    passed = not blocked and not unverified
    return SanityCheck(passed=passed, blocked_phrases=blocked, unverified_prices=unverified)
