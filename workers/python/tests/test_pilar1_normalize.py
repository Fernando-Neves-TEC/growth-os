from src.pilar1.normalize import deduplicate, normalize, normalize_cnpj, normalize_phone
from src.models import RawLead


def _mk(**kw) -> RawLead:
    base = dict(
        source="test",
        company_name="Acme LTDA",
        cnpj="12.345.678/0001-90",
        cnae="6911701",
        address="Rua X, 1",
        city="SP",
        state="sp",
        phone="(11) 91234-5678",
        capital=100000.0,
        porte="EPP",
    )
    base.update(kw)
    return RawLead(**base)


def test_normalize_phone_celular():
    assert normalize_phone("(11) 91234-5678") == "5511912345678"


def test_normalize_phone_fixo():
    assert normalize_phone("1131234567") == "551131234567"


def test_normalize_cnpj_remove_formatacao():
    assert normalize_cnpj("12.345.678/0001-90") == "12345678000190"


def test_normalize_padroniza_estado_e_nome():
    lead = normalize(_mk())
    assert lead.state == "SP"
    assert lead.company_name == "ACME LTDA"
    assert lead.phone == "5511912345678"


def test_deduplicate_por_cnpj():
    leads = [_mk(), _mk(cnpj="99.999.999/0001-00")]
    assert len(deduplicate(leads)) == 2
    assert len(deduplicate(leads + [_mk()])) == 2  # cnpj repetido


def test_deduplicate_mantem_cnpj_distintos_mesmo_nome_parecido():
    # CNPJ é autoritativo: nomes parecidos com CNPJ distintos NÃO são duplicados
    a = _mk(company_name="ACME LTDA", cnpj="11111111000111")
    b = _mk(company_name="ACME LTDA.", cnpj="22222222000122", state="SP")
    assert len(deduplicate([a, b])) == 2


def test_deduplicate_fuzzy_apenas_sem_cnpj():
    a = _mk(cnpj="", company_name="ACME LTDA")
    b = _mk(cnpj="", company_name="ACME LTDA.")
    assert len(deduplicate([a, b])) == 1
    c = _mk(cnpj="", company_name="ACME LTDA.", state="RJ")
    assert len(deduplicate([a, b, c])) == 2  # estado diferente não colide
