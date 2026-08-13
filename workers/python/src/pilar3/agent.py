"""Agente de vendas (Pilar 3) — orquestra provider, tools, RAG e sanidade."""
from __future__ import annotations

from dataclasses import dataclass, field

from ..models import Qualification
from .providers.base import SalesProvider, MockSalesProvider
from .rag import KnowledgeBase
from .sanity import check_sanity, DEFAULT_BLOCKLIST
from .tools import ToolCall


@dataclass
class AgentContext:
    lead_cnpj: str
    segment: str = ""
    pain_signal: str | None = None
    icp_fit_score: float = 0.0


@dataclass
class AgentSession:
    """Estado da conversa por lead (fail-closed: trava em opt-out/escalada)."""

    objection_loops: int = 0
    opted_out: bool = False
    escalated: bool = False
    qualification: Qualification = field(default_factory=Qualification)


@dataclass
class AgentDecision:
    reply: str | None
    tool_calls: list[ToolCall] = field(default_factory=list)
    escalate: bool = False
    escalate_reason: str | None = None
    blocked: bool = False
    optout: bool = False
    tool_results: list[dict] = field(default_factory=list)


def _compose_from_rag(kb: KnowledgeBase, collection: str, query: str) -> str:
    chunks = kb.retrieve(collection, query)
    if not chunks:
        return "Vou verificar essa informação com o time e retorno para você."
    c = chunks[0]
    if not c.verified and c.prices:
        return "Vou verificar essa informação com o time e retorno para você."
    return c.text


class SalesAgent:
    def __init__(
        self,
        kb: KnowledgeBase | None = None,
        provider: SalesProvider | None = None,
        blocklist: list[str] | None = None,
        max_objection_loops: int = 2,
    ) -> None:
        self.kb = kb or KnowledgeBase()
        self.provider = provider or MockSalesProvider()
        self.blocklist = blocklist or DEFAULT_BLOCKLIST
        self.max_objection_loops = max_objection_loops

    def handle(self, message: str, ctx: AgentContext, session: AgentSession) -> AgentDecision:
        if session.opted_out:
            return AgentDecision(reply=None, optout=True)
        if session.escalated:
            return AgentDecision(reply=None, escalate=True, escalate_reason=session.escalated)

        direct, calls = self.provider.plan(message)
        decision = AgentDecision(reply=direct, tool_calls=calls)

        for call in calls:
            result = self._execute_tool(call, ctx, session)
            decision.tool_results.append(result)
            if call.name == "registrar_opt_out":
                session.opted_out = True
                decision.optout = True
                decision.reply = "Entendido! Seu contato foi removido da nossa lista."
                return decision
            if call.name == "escalar_para_humano":
                session.escalated = call.arguments.get("motivo", "nao_informado")
                decision.escalate = True
                decision.escalate_reason = session.escalated
                decision.reply = "Sem problema! Vou conectar você com um especialista para cuidar disso."
                return decision
            if call.name == "agendar_reuniao":
                decision.reply = (
                    "Ótimo! Vou preparar os horários disponíveis e te enviar o link de agendamento em instantes."
                )
            elif call.name == "consultar_produto":
                collection = call.arguments.get("colecao", "persona_produto")
                query = call.arguments.get("pergunta", message)
                if collection == "objecoes":
                    # loop de objeção: máximo N ciclos antes de escalar (S4/S6)
                    session.objection_loops += 1
                    if session.objection_loops > self.max_objection_loops:
                        session.escalated = "objecao_em_loop"
                        decision.escalate = True
                        decision.escalate_reason = "objecao_em_loop"
                        decision.reply = "Entendi. Vou conectar você com um especialista para avaliar seu caso."
                        return decision
                composed = _compose_from_rag(self.kb, collection, query)
                if "verificar essa informação" in composed:
                    session.escalated = "duvida_sem_base"
                    decision.escalate = True
                    decision.escalate_reason = "duvida_sem_base"
                decision.reply = composed

        # guarda de sanidade pós-LLM (anti-alucinação)
        if decision.reply:
            check = check_sanity(decision.reply, self.blocklist, self.kb.verified_prices())
            if not check.passed:
                decision.blocked = True
                decision.reply = (
                    "Vou verificar essa informação com o time e retorno para você."
                )
                if session.objection_loops < 1:
                    session.escalated = "duvida_sem_base"
                    decision.escalate = True
                    decision.escalate_reason = "duvida_sem_base"

        return decision

    def _execute_tool(self, call: ToolCall, ctx: AgentContext, session: AgentSession) -> dict:
        name = call.name
        args = call.arguments
        if name == "qualificar_lead":
            session.qualification = Qualification(
                pain=args.get("dor", ""),
                budget_range=args.get("faixa_orcamento", "nao_informado"),
                urgency=args.get("urgencia", "sem_timeline"),
                decision_role=args.get("papel_decisao", "nao_informado"),
            )
            return {"ok": True, "qualification": args}
        if name == "consultar_produto":
            chunks = self.kb.retrieve(args.get("colecao", "persona_produto"), args.get("pergunta", ""))
            return {"ok": True, "chunks": [c.text for c in chunks], "found": bool(chunks)}
        if name == "agendar_reuniao":
            return {"ok": True, "slots": ["2026-08-14T10:00:00", "2026-08-14T14:00:00", "2026-08-15T09:00:00"]}
        if name == "escalar_para_humano":
            return {"ok": True, "motivo": args.get("motivo")}
        if name == "registrar_opt_out":
            return {"ok": True, "motivo": args.get("motivo")}
        return {"ok": False, "error": "tool_desconhecida"}
