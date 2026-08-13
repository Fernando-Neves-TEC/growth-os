"""Enriquecimento de leads (Pilar 1).

Em simulation: WhatsApp derivado do telefone e e-mail verificado por sintaxe/domínio.
Em produção autorizada, troca-se por provedores reais mantendo o mesmo contrato.
"""
from __future__ import annotations

import re

from ..models import EnrichedLead, RawLead
from .normalize import normalize, normalize_phone

_EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")
_BLOCKED_DOMAINS = {"example.com", "teste.com", "invalid.com"}


def validate_email(email: str | None) -> tuple[str | None, bool]:
    if not email:
        return None, False
    email = email.strip().lower()
    if not _EMAIL_RE.match(email):
        return None, False
    domain = email.rsplit("@", 1)[-1]
    if domain in _BLOCKED_DOMAINS or "." not in domain:
        return None, False
    return email, True


def _whatsapp_from_phone(phone: str) -> tuple[str | None, bool]:
    """WhatsApp corporativo (mock): válido quando há celular (DDD+9 dígitos)."""
    digits = re.sub(r"\D", "", phone)
    if len(digits) == 13 and digits.startswith("55"):  # 55 + DDD + 9 dígitos
        return digits, True
    return None, False


def enrich(raw: RawLead) -> EnrichedLead:
    """Converte lead bruto normalizado em EnrichedLead com contatos verificados."""
    n = normalize(raw)
    email, email_ok = validate_email(n.email)
    whatsapp, whatsapp_ok = _whatsapp_from_phone(n.phone)
    return EnrichedLead(
        company_name=n.company_name,
        cnpj=n.cnpj,
        cnae=n.cnae,
        city=n.city,
        state=n.state,
        address=n.address,
        phone=n.phone,
        whatsapp=whatsapp,
        whatsapp_verified=whatsapp_ok,
        email=email,
        email_verified=email_ok,
        website=n.website,
        capital=n.capital,
        porte=n.porte,
        rating=n.rating,
        source=n.source,
        legal_basis="interesse_legitimo_simulado",
    )
