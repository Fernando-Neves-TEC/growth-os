"""Teste da simulação E2E (S8) — prova o pipeline ponta a ponta em modo simulação."""
from src.simulation.e2e import run_simulation


def test_e2e_pipeline_completo():
    report = run_simulation(limit=225, seed=42)

    # Pilar 1: 225 coletados, filtro eliminou desqualificados, restam qualificados
    assert report["pilar1"]["collected"] == 450  # 225 Maps + 225 CNPJ
    assert report["pilar1"]["qualified"] > 0
    assert report["pilar1"]["rejected"] > 0  # filtro preditivo atuou

    # Pilar 2: envios respeitam volume (apenas leads com whatsapp válido)
    assert report["funnel"]["sent"] > 0
    assert report["funnel"]["rejected"] == 0  # sem rejeição em simulação saudável

    # Pilar 3: agente sem alucinação (zero bloqueios de sanidade)
    assert report["agent_blocks"] == 0

    # Pilar 4: ARR projetado próximo do âncora (2 clientes → ~R$ 35,6k)
    assert report["arr_projected"] > 20_000
    assert report["health"]["status"] == "healthy"
    assert report["health"]["kill_switch"] is False

    # Coerência: funil fechado ≈ 2 clientes
    assert 1 <= report["funnel"]["closed"] <= 4
