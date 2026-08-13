"""Métricas do funil e ARR projetado (Pilar 4 — Python)."""
from __future__ import annotations


def _pct(a: int, b: int) -> float:
    return (a / b * 100.0) if b > 0 else 0.0


def funnel_metrics(c: dict) -> dict:
    """c: sent, delivered, read, replied, qualified, scheduled, closed, rejected."""
    return {
        "delivery_rate": round(_pct(c.get("delivered", 0), c.get("sent", 0)), 1),
        "read_rate": round(_pct(c.get("read", 0), c.get("delivered", 0)), 1),
        "reply_rate": round(_pct(c.get("replied", 0), c.get("read", 0)), 1),
        "qualification_rate": round(_pct(c.get("qualified", 0), c.get("replied", 0)), 1),
        "schedule_rate": round(_pct(c.get("scheduled", 0), c.get("qualified", 0)), 1),
        "close_rate": round(_pct(c.get("closed", 0), c.get("scheduled", 0)), 1),
    }


def arr_projected(qualified: int, schedule_rate: float, close_rate: float, ticket_monthly: float) -> float:
    clients = qualified * (schedule_rate / 100.0) * (close_rate / 100.0)
    return round(clients * ticket_monthly * 12, 2)
