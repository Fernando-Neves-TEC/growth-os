from src.models import RawLead
from src.pilar1.filter import predictive_filter


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
        capital=100000.0,
        porte="EPP",
    )
    base.update(kw)
    return RawLead(**base)


CNAE = ["6911701"]
REGIONS = ["SP", "RJ"]


def test_aceita_lead_dentro_do_icp():
    res = predictive_filter([_mk()], CNAE, REGIONS, min_capital=50000)
    assert len(res.kept) == 1
    assert res.rejection_rate == 0.0


def test_rejeita_cnae_fora_do_icp():
    res = predictive_filter([_mk(cnae="9499500")], CNAE, REGIONS, min_capital=50000)
    assert res.kept == []
    assert res.rejected[0][1].startswith("cnae_fora_icp")


def test_rejeita_regiao_fora_do_icp():
    res = predictive_filter([_mk(state="RS")], CNAE, REGIONS, min_capital=50000)
    assert res.kept == []
    assert res.rejected[0][1].startswith("regiao_fora_icp")


def test_rejeita_capital_abaixo_do_minimo():
    res = predictive_filter([_mk(capital=10000)], CNAE, REGIONS, min_capital=50000)
    assert res.rejected[0][1].startswith("capital_abaixo")


def test_rejeita_porte_fora_do_icp():
    res = predictive_filter([_mk(porte="DEMAIS")], CNAE, REGIONS, min_capital=0, allowed_portes=["ME", "EPP"])
    assert res.rejected[0][1].startswith("porte_fora_icp")


def test_elimina_desqualificados_na_raiz():
    leads = [_mk(), _mk(cnae="9999999"), _mk(state="RS"), _mk(capital=1000), _mk(porte="DEMAIS")]
    res = predictive_filter(leads, CNAE, REGIONS, min_capital=50000, allowed_portes=["ME", "EPP"])
    assert len(res.kept) == 1
    assert res.rejection_rate > 0.5  # maioria descartada antes do envio
