from src.models import Qualification
from src.pilar3.qualify import qualification_score, should_schedule


def _q(**kw) -> Qualification:
    base = dict(pain="", budget_range="nao_informado", urgency="sem_timeline", decision_role="nao_informado")
    base.update(kw)
    return Qualification(**base)


def test_qualificacao_ideal_atinge_limiar_de_agendamento():
    q = _q(
        pain="Perdemos 20% dos no-shows e o custo de aquisição de clientes está alto",
        budget_range="1500-5000",
        urgency="imediata",
        decision_role="decisor",
    )
    score = qualification_score(q)
    assert score >= 70
    assert should_schedule(q, threshold=70)


def test_qualificacao_fraca_nao_agenda():
    q = _q(pain="", budget_range="<500", urgency="sem_timeline", decision_role="usuario")
    assert qualification_score(q) < 70
    assert should_schedule(q, threshold=70) is False


def test_dor_especifica_ganha_pontos():
    vaga = _q(pain="gostaria de mais clientes", budget_range="1500-5000", urgency="30_dias", decision_role="decisor")
    especifica = _q(
        pain="Perdemos 20% dos no-shows todo mês e isso custa R$ 8 mil",
        budget_range="1500-5000",
        urgency="30_dias",
        decision_role="decisor",
    )
    assert qualification_score(especifica) > qualification_score(vaga)


def test_score_limite_inferior():
    q = _q(pain="x" * 40, budget_range=">5000", urgency="imediata", decision_role="decisor")
    assert qualification_score(q) <= 100.0
