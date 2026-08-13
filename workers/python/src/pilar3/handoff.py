"""Hand-off payload para o humano (Pilar 3) — contexto completo, sem retrabalho."""
from __future__ import annotations

from ..models import Qualification
from .calendar import BookingResult
from .qualify import qualification_score


def build_handoff_payload(
    lead_cnpj: str,
    channel: str,
    qualification: Qualification,
    resume: str,
    intent: str,
    booking: BookingResult | None = None,
) -> dict:
    return {
        "lead_cnpj": lead_cnpj,
        "canal": channel,
        "qualificacao": {
            "dor": qualification.pain,
            "faixa_orcamento": qualification.budget_range,
            "urgencia": qualification.urgency,
            "papel_decisao": qualification.decision_role,
            "score": qualification_score(qualification),
        },
        "resumo_conversa": resume,
        "intencao_detectada": intent,
        "slots_sugeridos": [booking.invite_link] if booking and booking.ok else [],
    }
