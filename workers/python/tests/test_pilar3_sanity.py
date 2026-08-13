from src.pilar3.sanity import check_sanity, DEFAULT_BLOCKLIST


def test_bloqueia_frase_de_garantia():
    r = check_sanity("Te garanto que você vai ter resultado certo!", DEFAULT_BLOCKLIST)
    assert not r.passed
    assert len(r.blocked_phrases) >= 1


def test_aceita_resposta_legitima():
    r = check_sanity("Podemos agendar uma conversa para quinta-feira?", DEFAULT_BLOCKLIST)
    assert r.passed


def test_bloqueia_valor_nao_verificado_na_base():
    r = check_sanity("O plano custa R$ 999.", verified_prices={"R$ 1.500"})
    assert not r.passed
    assert r.unverified_prices == ["R$ 999."]


def test_aceita_valor_verificado_na_base():
    r = check_sanity("O plano Pro custa R$ 1.500 por mês.", verified_prices={"R$ 1.500"})
    assert r.passed


def test_nao_promete_retorno():
    r = check_sanity("Você vai vender 300% a mais, é garantido!", DEFAULT_BLOCKLIST)
    assert not r.passed
