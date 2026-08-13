"""Provider de LLM (Pilar 3).

`SalesProvider` é a interface; `MockSalesProvider` implementa um classificador
determinístico para simulação (o mesmo contrato serve a um LLM real).
"""
from __future__ import annotations

from abc import ABC, abstractmethod

from ..tools import ToolCall


class SalesProvider(ABC):
    """Decide, para a última mensagem do lead, a próxima ação do agente."""

    @abstractmethod
    def plan(self, message: str) -> tuple[str, list[ToolCall]]:
        """Retorna (resposta_direta | "", tool_calls)."""
        raise NotImplementedError


class MockSalesProvider(SalesProvider):
    """Classificador determinístico baseado em palavras-chave (simulação)."""

    def plan(self, message: str) -> tuple[str, list[ToolCall]]:
        m = message.lower()

        if any(k in m for k in ["sair da lista", "remover", "opt-out", "descadastrar", "não quero mais"]):
            return "", [ToolCall("registrar_opt_out", {"motivo": "solicitado"})]

        if any(k in m for k in ["falar com", "atendente", "pessoa real", "vendedor humano"]):
            return "", [ToolCall("escalar_para_humano", {"motivo": "pedido_humano", "contexto": m})]

        if any(k in m for k in ["preço", "preco", "valor", "quanto custa", "plano pro", "planos"]):
            return "", [ToolCall("consultar_produto", {"pergunta": m, "colecao": "precos_condicoes"})]

        if any(k in m for k in ["garant", "resultado certo", "vou vender mais"]):
            return (
                "Não prometemos resultados — mas posso te mostrar casos verificados de clientes do seu setor.",
                [],
            )

        if any(k in m for k in ["agendar", "reunião", "reuniao", "conversa", "marcar"]):
            return "", [ToolCall("agendar_reuniao", {"fuso": "America/Sao_Paulo", "resumo": m})]

        if any(k in m for k in ["caro", "custo", "não tenho orçamento", "sem verba"]):
            return "", [ToolCall("consultar_produto", {"pergunta": m, "colecao": "objecoes"})]

        if any(k in m for k in ["como funciona", "o que é", "produto", "para quem", "vantagens"]):
            return "", [ToolCall("consultar_produto", {"pergunta": m, "colecao": "persona_produto"})]

        if any(k in m for k in ["como é a integração", "api", "dados", "segurança"]):
            return "", [ToolCall("consultar_produto", {"pergunta": m, "colecao": "faq_tecnico"})]

        return "Entendi. Posso te ajudar se você me contar qual é o principal desafio hoje?", []
