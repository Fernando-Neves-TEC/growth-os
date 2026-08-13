"""Qualificação de leads no chat (Pilar 3) — score de 0..100.

Pesos: dor 35 · orçamento 25 · urgência 20 · decisor 20.
Score >= threshold → pronto para agendar.
"""
from __future__ import annotations

import re

from ..models import Qualification

BUDGET_SCORE = {"nao_informado": 0.0, "<500": 5.0, "500-1500": 15.0, "1500-5000": 25.0, ">5000": 25.0}
URGENCY_SCORE = {"sem_timeline": 0.0, "90_dias": 10.0, "30_dias": 18.0, "imediata": 20.0}
DECISION_SCORE = {"nao_informado": 0.0, "usuario": 8.0, "influenciador": 14.0, "decisor": 20.0}


def _pain_score(pain: str) -> float:
    """Dor específica e mensurável pontua mais (35 pts máx)."""
    if not pain or not pain.strip():
        return 0.0
    text = pain.lower()
    score = 10.0  # dor presente
    if len(pain.strip()) >= 20:
        score += 10.0  # dor descrita
    if re.search(r"\d+%|por cento|R\$", text):
        score += 10.0  # dor mensurável
    if any(k in text for k in ["perdendo", "no-show", "retenção", "leads", "fechar", "custo"]):
        score += 5.0  # vocabulário de dor de negócio
    return min(score, 35.0)


def qualification_score(q: Qualification) -> float:
    pain = _pain_score(q.pain)
    budget = BUDGET_SCORE.get(q.budget_range, 0.0)
    urgency = URGENCY_SCORE.get(q.urgency, 0.0)
    decision = DECISION_SCORE.get(q.decision_role, 0.0)
    return round(pain + budget + urgency + decision, 1)


def should_schedule(q: Qualification, threshold: float = 70.0) -> bool:
    """Score >= threshold → gatilho de agendamento (Pilar 3)."""
    return qualification_score(q) >= threshold
