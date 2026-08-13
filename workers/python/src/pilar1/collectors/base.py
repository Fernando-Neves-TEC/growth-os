"""Interface de coletor de leads."""
from __future__ import annotations

from abc import ABC, abstractmethod

from ...models import RawLead


class LeadCollector(ABC):
    """Contrato de coleta. Em simulation, retorna dados sintéticos determinísticos."""

    name: str = "base"

    @abstractmethod
    def collect(self, query: str, region: str, limit: int = 100) -> list[RawLead]:
        """Coleta até `limit` leads brutos para a consulta/região."""
        raise NotImplementedError
