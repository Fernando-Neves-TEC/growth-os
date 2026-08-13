"""Conformidade TS/Python — canal health (VALIDAÇÃO CRUZADA REAL).

A matriz é o CONTRATO compartilhado entre packages/core (TS) e workers/python.
Quando GROWTHOS_TS_REF_FILE aponta para a saída de `scripts/health-reference.mjs`
(node → channelHealth do core), o teste compara a saída do Python com a referência
REAL do TypeScript — não apenas contra uma matriz copiada.
Cobertura: no_data, healthy, warning, critical (rejeição e score), clamp.
"""
import json
import os

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


def _ts_reference():
    path = os.environ.get("GROWTHOS_TS_REF_FILE", "")
    if not path or not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def test_conformidade_canal_health_com_contrato_ts():
    ts_ref = _ts_reference()
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

        # Validação cruzada com a referência REAL do TS (quando disponível — CI).
        if ts_ref is not None:
            match = next(
                (
                    m
                    for m in ts_ref
                    if m["sent"] == sent
                    and m["readRate"] == read_rate
                    and m["replyRate"] == reply_rate
                ),
                None,
            )
            assert match is not None, f"linha da matriz não encontrada na referência TS (sent={sent})"
            assert h["status"] == match["result"]["status"], (sent, h["status"], match["result"]["status"])
            assert h["score"] == match["result"]["score"], (sent, h["score"], match["result"]["score"])
            assert h["kill_switch"] is match["result"]["killSwitch"], (sent, h["kill_switch"])
