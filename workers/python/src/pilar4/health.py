"""Saúde do canal e kill-switch (Pilar 4 — Python). Fail-closed."""
from __future__ import annotations


def channel_health(
    delivered: int,
    sent: int,
    rejected: int,
    read_rate: float,
    reply_rate: float,
    channel_min: float = 60.0,
    rejection_rate_max: float = 5.0,
) -> dict:
    # Sem dados de envio: nunca autopausa uma campanha nova (fail-safe).
    if sent <= 0:
        return {"score": 0.0, "status": "healthy", "rejection_rate": 0.0, "kill_switch": False, "reasons": ["sem_dados"]}

    delivery = _pct(delivered, sent)
    rejection = _pct(rejected, sent)
    score = (delivery / 100) * 30 + (read_rate / 100) * 25 + (reply_rate / 100) * 25 + max(0.0, 1 - rejection / 100) * 20
    score = round(score, 1)

    reasons: list[str] = []
    if rejection > rejection_rate_max:
        status = "critical"
        reasons.append(f"rejeicao_acima_do_limite:{rejection:.1f}%")
    elif score < channel_min:
        status = "critical"
        reasons.append(f"score_abaixo_do_minimo:{score:.1f}")
    elif score < channel_min + 10:
        status = "warning"
        reasons.append(f"score_proximo_do_minimo:{score:.1f}")
    else:
        status = "healthy"

    return {
        "score": score,
        "status": status,
        "rejection_rate": round(rejection, 1),
        "kill_switch": status == "critical",
        "reasons": reasons,
    }


def _pct(a: int, b: int) -> float:
    return (a / b * 100.0) if b > 0 else 0.0
