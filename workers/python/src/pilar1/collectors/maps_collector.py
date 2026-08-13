"""Coletor mock de Google Maps (dados públicos geolocalizados).

Em simulation não há scraping real: gera amostras sintéticas determinísticas
(seed = hash da consulta+região) para validar o pipeline ponta a ponta.
"""
from __future__ import annotations

import hashlib
import random

from ...models import RawLead
from .base import LeadCollector

_CNAE_POOL = [
    ("6911701", "Escritório de contabilidade", 60000.0, "EPP"),
    ("8610101", "Atividades de atendimento hospitalar", 150000.0, "MP"),
    ("7020400", "Atividades de consultoria em gestão empresarial", 80000.0, "EPP"),
    ("9499500", "Outras atividades associativas", 20000.0, "ME"),
]

_PHONES = ["1198", "1133", "1127", "2198", "2133", "3198", "3133", "4198"]


class MapsCollector(LeadCollector):
    name = "google_maps"

    def collect(self, query: str, region: str, limit: int = 100) -> list[RawLead]:
        seed = int(hashlib.sha256(f"{query}|{region}".encode()).hexdigest(), 16) & 0xFFFFFFFF
        rng = random.Random(seed)
        out: list[RawLead] = []
        for i in range(limit):
            cnae, cnae_desc, capital, porte = _CNAE_POOL[i % len(_CNAE_POOL)]
            city = f"{region}-cidade-{i % 5}"
            mobile = i % 2 == 0
            phone = (
                f"11{rng.randint(900000000, 999999999)}"  # celular (11 dígitos)
                if mobile
                else f"11{rng.randint(30000000, 39999999)}"  # fixo (10 dígitos)
            )
            out.append(
                RawLead(
                    source="google_maps",
                    company_name=f"{query} {cnae_desc.split()[0]} {i:03d}",
                    cnpj=f"{rng.randint(10,99)}.{rng.randint(100,999)}.{rng.randint(100,999)}/{rng.randint(1000,9999)}-{rng.randint(10,99)}",
                    cnae=cnae,
                    address=f"Rua {i}, {100 + i}",
                    city=city,
                    state=region,
                    phone=phone,
                    website=f"https://exemplo{i}.com.br",
                    email=f"contato{i}@exemplo.com.br",
                    capital=capital,
                    porte=porte,
                    rating=round(rng.uniform(3.0, 5.0), 1),
                    simulated=True,
                    raw_id=f"maps-{region}-{i}",
                )
            )
        return out
