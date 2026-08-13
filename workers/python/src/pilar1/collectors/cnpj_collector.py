"""Coletor mock da base oficial de CNPJ/CNAE (Cadastro Nacional).

Retorna metadados cadastrais sintéticos para o CNPJ fornecido.
"""
from __future__ import annotations

import hashlib
import random

from ...models import RawLead
from .base import LeadCollector

_PORTES = ["ME", "EPP", "MP", "DEMAIS"]


class CnpjCollector(LeadCollector):
    name = "cnpj_cnae"

    def collect(self, query: str, region: str, limit: int = 100) -> list[RawLead]:
        seed = int(hashlib.sha256(f"cnpj|{query}|{region}".encode()).hexdigest(), 16) & 0xFFFFFFFF
        rng = random.Random(seed)
        out: list[RawLead] = []
        for i in range(limit):
            porte = _PORTES[i % len(_PORTES)]
            mobile = i % 3 == 0
            phone = (
                f"11{rng.randint(900000000, 999999999)}"  # celular
                if mobile
                else f"11{rng.randint(30000000, 39999999)}"  # fixo
            )
            out.append(
                RawLead(
                    source="cnpj_cnae",
                    company_name=f"EMPRESA {query.upper()} {i:03d} LTDA",
                    cnpj=f"{rng.randint(10,99)}.{rng.randint(100,999)}.{rng.randint(100,999)}/{rng.randint(1000,9999)}-{rng.randint(10,99)}",
                    cnae="6911701" if i % 3 else "7020400",
                    address=f"Av. Comercial {i}",
                    city=f"{region}-capital",
                    state=region,
                    phone=phone,
                    website=None,
                    email=None,
                    capital=float(rng.randint(5, 2000)) * 1000.0,
                    porte=porte,
                    rating=None,
                    simulated=True,
                    raw_id=f"cnpj-{region}-{i}",
                )
            )
        return out
