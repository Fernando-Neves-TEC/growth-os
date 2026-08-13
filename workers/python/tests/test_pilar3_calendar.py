from datetime import datetime

from src.pilar3.calendar import MockCalendarProvider


def test_slots_apenas_em_horario_comercial():
    cal = MockCalendarProvider(start_hour=9, end_hour=18)
    start = datetime(2026, 8, 14, 0, 0)
    end = datetime(2026, 8, 15, 0, 0)
    slots = cal.list_slots(start, end)
    assert slots
    for s in slots:
        hour = datetime.fromisoformat(s).hour
        assert 9 <= hour < 18


def test_booking_gera_link_e_evento():
    cal = MockCalendarProvider()
    res = cal.book("2026-08-14T10:00:00", "Reunião Growth OS", "lead@empresa.com")
    assert res.ok
    assert res.event_id
    assert "https://cal.mock/" in (res.invite_link or "")


def test_handoff_payload_tem_contexto_completo():
    from src.models import Qualification
    from src.pilar3.handoff import build_handoff_payload

    q = Qualification(pain="no-show alto", budget_range="1500-5000", urgency="imediata", decision_role="decisor")
    payload = build_handoff_payload("12345678000190", "whatsapp", q, "resumo", "agendamento")
    assert payload["lead_cnpj"] == "12345678000190"
    assert payload["intencao_detectada"] == "agendamento"
    assert payload["qualificacao"]["faixa_orcamento"] == "1500-5000"
