"""Conformidade TS/Python — canal health.

A matriz abaixo é o CONTRATO compartilhado entre packages/core (TS) e
workers/python (espelho). Qualquer mudança num lado exige atualizar a matriz.
Cobertura: no_data, healthy, warning, critical (rejeição e score), clamp.
"""
from src.pilar4.health import channel_health

# (delivered, sent, rejected, read_rate, reply_rate, channel_min, rej_max, status, score, kill_switch)
MATRIX = [
    (0, 0, 0, 0, 0, 60, 5, "no_data", None, False),
    (100, 100, 0, 70, 40, 60, 5, "healthy", 77.5, False),
    (90, 100, 12, 60, 20, 60, 5, "critical", 64.6, True),   # rejeição > limite
    (10, 100, 0, 10, 5, 60, 5, "critical", 26.8, True),      # score < mínimo
    (100, 100, 0, 50, 10, 60, 5, "warning", 65.0, False),    # faixa de warning
    (100, 100, 0, 100, 500, 60, 5, "healthy", 100.0, False), # clamp em 100
]


def test_conformidade_canal_health_com_contrato_ts():
    for delivered, sent, rejected, read_rate, reply_rate, ch_min, rej_max, status, score, kill in MATRIX:
        h = channel_health(
            delivered=delivered,
            sent=sent,
            rejected=rejected,
            read_rate=read_rate,
            reply_rate=reply_rate,
            channel_min=ch_min,
            rejection_rate_max=rej_max,
        )
        assert h["status"] == status, (sent, h["status"], status)
        assert h["score"] == score, (sent, h["score"], score)
        assert h["kill_switch"] is kill, (sent, h["kill_switch"], kill)
