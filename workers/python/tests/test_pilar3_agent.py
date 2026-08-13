from src.pilar3.agent import AgentContext, AgentSession, SalesAgent


def ctx():
    return AgentContext(lead_cnpj="12345678000190", segment="contabilidade")


def test_t5_recusa_garantia_sem_alucinacao():
    agent = SalesAgent()
    s = AgentSession()
    d = agent.handle("vocês garantem que vou vender mais?", ctx(), s)
    assert not d.blocked
    assert "Não prometemos resultados" in (d.reply or "")
    assert d.escalate is False


def test_t2_consulta_preco_na_base():
    agent = SalesAgent()
    s = AgentSession()
    d = agent.handle("qual o valor do plano pro?", ctx(), s)
    assert d.reply is not None
    assert "R$ 1.500" in d.reply  # preço fundamentado na base
    assert d.blocked is False


def test_t2_preco_sem_base_escala_em_vez_de_chutar():
    from src.pilar3.rag import KnowledgeBase
    from src.pilar3.rag import DEFAULT_COLLECTIONS

    # base sem coleção de preços → agente escala, nunca inventa valor
    kb = KnowledgeBase(collections={})
    agent = SalesAgent(kb=kb)
    s = AgentSession()
    d = agent.handle("qual o valor do plano pro?", ctx(), s)
    assert d.escalate is True
    assert "R$" not in (d.reply or "")
    assert "verificar" in (d.reply or "")


def test_agendamento_gera_tool_call_de_slots():
    agent = SalesAgent()
    s = AgentSession()
    d = agent.handle("quero agendar uma reunião", ctx(), s)
    names = [t.name for t in d.tool_calls]
    assert "agendar_reuniao" in names
    assert any("horários" in r.get("slots", []) or "horários" in (d.reply or "") for r in d.tool_results)


def test_opt_out_trava_conversa():
    agent = SalesAgent()
    s = AgentSession()
    d = agent.handle("quero sair da lista", ctx(), s)
    assert d.optout is True
    assert s.opted_out is True
    d2 = agent.handle("quero agendar", ctx(), s)
    assert d2.reply is None  # conversa travada


def test_pedido_humano_escala():
    agent = SalesAgent()
    s = AgentSession()
    d = agent.handle("quero falar com um humano", ctx(), s)
    assert d.escalate is True
    assert d.escalate_reason == "pedido_humano"
