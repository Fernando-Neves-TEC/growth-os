from src.pilar1.collectors.cnpj_collector import CnpjCollector
from src.pilar1.collectors.maps_collector import MapsCollector
from src.pilar1.pipeline import IcpRules, run_pipeline


def test_pipeline_completo_produz_leads_qualificados():
    icp = IcpRules(
        cnae_allowlist=["6911701", "7020400", "8610101"],
        region_allowlist=["SP", "RJ", "MG"],
        min_capital=50000,
        allowed_portes=["ME", "EPP", "MP"],
    )
    res = run_pipeline(
        collectors=[MapsCollector(), CnpjCollector()],
        query="consultoria",
        region="SP",
        limit=100,
        icp=icp,
    )
    assert res.collected == 200
    assert res.deduplicated <= res.collected
    assert res.qualified_count > 0
    # ordenado por score desc
    scores = [l.icp_fit_score for l in res.qualified]
    assert scores == sorted(scores, reverse=True)
    # enriquecimento aplicado
    assert all(l.email_verified or not l.email for l in res.qualified)
    assert any(l.whatsapp_verified for l in res.qualified)
