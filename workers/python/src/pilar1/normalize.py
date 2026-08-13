"""Normalização e deduplicação de leads brutos (Pilar 1)."""
from __future__ import annotations

import difflib
import re

from ..models import RawLead


def normalize_phone(raw: str) -> str:
    digits = re.sub(r"\D", "", raw)
    if len(digits) == 10:  # DDD + 8 dígitos (fixo) — adiciona 9 quando inexistente? mantém como está
        return "55" + digits
    if len(digits) == 11:  # DDD + 9 dígitos (celular)
        return "55" + digits
    if len(digits) == 12 and digits.startswith("55"):
        return digits
    if len(digits) == 13 and digits.startswith("55"):
        return digits
    return "55" + digits


def normalize_cnpj(raw: str) -> str:
    return re.sub(r"\D", "", raw)


def _normalize_name(name: str) -> str:
    return re.sub(r"\s+", " ", name.strip().upper())


def normalize(raw: RawLead) -> RawLead:
    """Padroniza campos-chave in-place (retorna novo objeto)."""
    return RawLead(
        source=raw.source,
        company_name=_normalize_name(raw.company_name),
        cnpj=normalize_cnpj(raw.cnpj),
        cnae=re.sub(r"\D", "", raw.cnae),
        address=re.sub(r"\s+", " ", raw.address.strip()),
        city=raw.city.strip(),
        state=raw.state.strip().upper(),
        phone=normalize_phone(raw.phone),
        website=raw.website.strip() if raw.website else None,
        email=raw.email.strip().lower() if raw.email else None,
        capital=float(raw.capital or 0),
        porte=raw.porte.strip().upper(),
        rating=raw.rating,
        simulated=raw.simulated,
        raw_id=raw.raw_id,
    )


def deduplicate(leads: list[RawLead], threshold: float = 0.9) -> list[RawLead]:
    """Remove duplicatas: por CNPJ exato (autoritativo) e, na ausência de CNPJ,
    por nome fuzzy + estado. Nunca remove CNPJ distintos só por nome parecido."""
    by_cnpj: dict[str, RawLead] = {}
    kept: list[RawLead] = []
    for lead in leads:
        n = normalize(lead)
        if n.cnpj:
            if n.cnpj in by_cnpj:
                continue
            by_cnpj[n.cnpj] = n
            kept.append(n)
            continue
        # sem CNPJ: fallback conservador por nome fuzzy + estado
        dup = False
        for k in kept:
            if k.state != n.state:
                continue
            ratio = difflib.SequenceMatcher(None, n.company_name, k.company_name).ratio()
            if ratio >= threshold:
                dup = True
                break
        if not dup:
            kept.append(n)
    return kept
