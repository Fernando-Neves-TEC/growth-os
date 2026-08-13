from src.pilar3.rag import KnowledgeBase


def test_retrieval_retorna_chunk_de_preco():
    kb = KnowledgeBase()
    chunks = kb.retrieve("precos_condicoes", "qual o valor do plano pro?")
    assert chunks
    assert "R$ 1.500" in chunks[0].text
    assert chunks[0].verified


def test_retrieval_retorna_case_verificado():
    kb = KnowledgeBase()
    chunks = kb.retrieve("casos_sucesso", "algum caso de sucesso em contabilidade?")
    assert chunks
    assert chunks[0].verified


def test_retrieval_vazio_para_colecao_inexistente():
    kb = KnowledgeBase()
    assert kb.retrieve("nao_existe", "qualquer coisa") == []


def test_verified_prices_agrega_da_base():
    kb = KnowledgeBase()
    assert "R$ 1.500" in kb.verified_prices()
