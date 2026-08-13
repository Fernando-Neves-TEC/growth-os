from src.models import RawLead
from src.pilar1.score import icp_score


def _mk(**kw) -> RawLead:
    base = dict(
        source="t",
        company_name="ACME LTDA",
        cnpj="12345678000190",
        cnae="6911701",
        address="Rua X",
        city="SP",
        state="SP",
        phone="5511912345678",
        capital=500000.0,
        porte="EPP",
        rating=4.5,
    )
    base.update(kw)
    return RawLead(**base)


def test_score_alto_para_icp_ideal():
    s = icp_score(_mk(), ["6911701"], ["SP"], min_capital=50000)
    # cnae 30 + regiao 20 + capital 22 + porte 15 + rating 7.5 = 94.5
    assert s == 94.5


def test_score_baixo_sem_cnae_e_sem_regiao():
    ideal = icp_score(_mk(), ["6911701"], ["SP"], min_capital=50000)
    s = icp_score(_mk(cnae="9999999", state="RS"), ["6911701"], ["SP"], min_capital=50000)
    # perder CNAE (30) + região (20) precisa derrubar o score em ao menos ~45 pts
    assert ideal - s >= 45
    assert s < 50


def test_score_nunca_ultrapassa_100():
    s = icp_score(_mk(capital=9_999_999, porte="EPP", rating=5.0), ["6911701"], ["SP"], 0)
    assert s <= 100.0


def test_capital_baixo_reduz_score():
    baixo = icp_score(_mk(capital=1000), ["6911701"], ["SP"], 0)
    alto = icp_score(_mk(capital=1_000_000), ["6911701"], ["SP"], 0)
    assert baixo < alto
