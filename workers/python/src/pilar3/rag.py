"""Base de conhecimento (RAG) do agente (Pilar 3).

Em simulation: base em memória com recuperação por score de palavras-chave.
Em produção autorizada: embeddings em pgvector com o mesmo contrato.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class KnowledgeChunk:
    id: str
    collection: str
    text: str
    keywords: list[str] = field(default_factory=list)
    verified: bool = False
    prices: list[str] = field(default_factory=list)


DEFAULT_COLLECTIONS: dict[str, list[KnowledgeChunk]] = {
    "persona_produto": [
        KnowledgeChunk(
            id="pers-1",
            collection="persona_produto",
            text="O Growth OS automatiza prospecção B2B: capta leads qualificados, conduz conversa e agenda reuniões com o time comercial.",
            keywords=["o que", "produto", "faz", "como funciona", "para quem"],
        ),
    ],
    "precos_condicoes": [
        KnowledgeChunk(
            id="preco-1",
            collection="precos_condicoes",
            text="O plano Pro custa R$ 1.500 por mês, com contrato mensal e onboarding incluso.",
            keywords=["preço", "valor", "plano", "custa", "quanto"],
            verified=True,
            prices=["R$ 1.500"],
        ),
        KnowledgeChunk(
            id="preco-2",
            collection="precos_condicoes",
            text="O plano Enterprise é negociado sob medida pela equipe comercial.",
            keywords=["enterprise", "empresarial", "sob medida"],
            verified=True,
        ),
    ],
    "objecoes": [
        KnowledgeChunk(
            id="obj-1",
            collection="objecoes",
            text="Sobre custo: o plano Pro de R$ 1.500 substitui meses de prospecção manual e já inclui onboarding.",
            keywords=["caro", "custo", "preço alto", "investimento"],
            verified=True,
            prices=["R$ 1.500"],
        ),
        KnowledgeChunk(
            id="obj-2",
            collection="objecoes",
            text="Sobre tempo: a implantação leva até 5 dias úteis, conforme a política oficial.",
            keywords=["tempo", "demora", "implantação", "prazo"],
            verified=True,
        ),
    ],
    "casos_sucesso": [
        KnowledgeChunk(
            id="case-1",
            collection="casos_sucesso",
            text="Uma contabilidade de médio porte reduziu em 40% o custo de aquisição de clientes após 3 meses de uso.",
            keywords=["caso", "sucesso", "resultado", "clientes", "contabilidade"],
            verified=True,
        ),
    ],
    "faq_tecnico": [
        KnowledgeChunk(
            id="faq-1",
            collection="faq_tecnico",
            text="A integração usa APIs oficiais de mensageria e agenda com limites de volume seguros.",
            keywords=["api", "integração", "segurança", "dados"],
        ),
    ],
    "politicas": [
        KnowledgeChunk(
            id="pol-1",
            collection="politicas",
            text="Garantias: não prometemos resultados financeiros; o SLA de suporte é de 1 dia útil.",
            keywords=["garantia", "sla", "contrato", "política", "cancelamento"],
            verified=True,
        ),
    ],
}


class KnowledgeBase:
    """Recuperador RAG em memória (mock determinístico)."""

    def __init__(self, collections: dict[str, list[KnowledgeChunk]] | None = None) -> None:
        self._collections = collections if collections is not None else DEFAULT_COLLECTIONS

    def retrieve(self, collection: str, query: str, top_k: int = 1) -> list[KnowledgeChunk]:
        chunks = self._collections.get(collection, [])
        q = query.lower()
        scored: list[tuple[float, KnowledgeChunk]] = []
        for c in chunks:
            score = sum(1 for kw in c.keywords if kw in q)
            if any(w in q for w in c.text.lower().split()):
                score += 0.5
            scored.append((score, c))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [c for _, c in scored[:top_k] if _ > 0]

    def has(self, collection: str) -> bool:
        return collection in self._collections and bool(self._collections[collection])

    def verified_prices(self) -> set[str]:
        out: set[str] = set()
        for chunks in self._collections.values():
            for c in chunks:
                if c.verified:
                    out.update(c.prices)
        return out
