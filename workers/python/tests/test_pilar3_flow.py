"""Cenários fictícios T1 (fluxo feliz) e T3 (loop de objeção) — Pilar 3."""
from src.models import Qualification
from src.pilar3.agent import AgentContext, AgentSession, SalesAgent
from src.pilar3.calendar import MockCalendarProvider
from src.pilar3.handoff import build_handoff_payload
from src.pilar3.qualify import qualification_score, should_schedule


def test_t1_fluxo_feliz_qualifica_e_agenda():
    # 1. lead demonstra dor específica + qualificação completa
    q = Qualification(
        pain="Perdemos 20% dos no-shows e o custo de aquisição está alto",
        budget_range="1500-5000",
        urgency="imediata",
        decision_role="decisor",
    )
    assert should_schedule(q, threshold=70)

    # 2. agenda direto no calendário (sem atrito)
    cal = MockCalendarProvider()
    slots = cal.list_slots(__import__("datetime").datetime(2026, 8, 14, 0, 0), __import__("datetime").datetime(2026, 8, 15, 0, 0))
    assert slots
    booking = cal.book(slots[0], "Reunião Growth OS", "lead@empresa.com")
    assert booking.ok

    # 3. hand-off com contexto completo para o executivo
    payload = build_handoff_payload("12345678000190", "whatsapp", q, "qualificação concluída", "agendamento", booking)
    assert payload["slots_sugeridos"]
    assert payload["qualificacao"]["score"] == qualification_score(q)


def test_t3_objecao_em_loop_escala():
    agent = SalesAgent(max_objection_loops=2)
    s = AgentSession()
    ctx = AgentContext(lead_cnpj="12345678000190")
    # 3 objeções seguidas → ultrapassa o limite → escala
    for i in range(3):
        d = agent.handle("isso está caro para nós", ctx, s)
        assert d.escalate is False or i == 2  # só escala na 3ª
    assert s.objection_loops > 2
    assert s.escalated == "objecao_em_loop"


def test_t3_objecao_abaixo_do_limite_nao_escala():
    agent = SalesAgent(max_objection_loops=2)
    s = AgentSession()
    ctx = AgentContext(lead_cnpj="12345678000190")
    d = agent.handle("isso está caro para nós", ctx, s)
    assert d.escalate is False
    assert s.objection_loops == 1
