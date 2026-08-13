from src.pilar4.health import channel_health
from src.pilar4.metrics import arr_projected, funnel_metrics


def test_funil_do_cenario_ancora():
    c = {"sent": 225, "delivered": 225, "read": 120, "replied": 45, "qualified": 18, "scheduled": 10, "closed": 2, "rejected": 0}
    m = funnel_metrics(c)
    assert m["delivery_rate"] == 100.0
    assert abs(m["reply_rate"] - 37.5) < 0.1
    assert abs(m["close_rate"] - 20.0) < 0.1


def test_arr_esperado_cenario_ancora():
    arr = arr_projected(18, 55.0, 20.0, 1500)
    assert abs(arr - 35640.0) < 1.0


def test_saude_do_canal_saudavel():
    h = channel_health(delivered=100, sent=100, rejected=0, read_rate=70, reply_rate=40)
    assert h["status"] == "healthy"
    assert h["kill_switch"] is False


def test_saude_sem_dados_nao_dispara_kill_switch():
    h = channel_health(delivered=0, sent=0, rejected=0, read_rate=0, reply_rate=0)
    assert h["status"] == "no_data"
    assert h["score"] is None
    assert h["kill_switch"] is False
    assert "sem_dados" in h["reasons"]


def test_rejeicao_dispara_kill_switch():
    h = channel_health(delivered=90, sent=100, rejected=12, read_rate=60, reply_rate=20, rejection_rate_max=5)
    assert h["status"] == "critical"
    assert h["kill_switch"] is True
