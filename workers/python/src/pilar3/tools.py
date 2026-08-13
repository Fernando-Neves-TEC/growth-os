"""Definição das ferramentas (tool calling) do agente (Pilar 3)."""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class ToolCall:
    name: str
    arguments: dict = field(default_factory=dict)


TOOL_SCHEMAS: list[dict] = [
    {
        "name": "consultar_produto",
        "description": "Consulta a base oficial para obter produto, preços, condições e disponibilidade.",
        "parameters": {
            "type": "object",
            "properties": {
                "pergunta": {"type": "string"},
                "colecao": {"type": "string", "enum": ["precos_condicoes", "faq_tecnico", "politicas", "persona_produto"]},
            },
            "required": ["pergunta", "colecao"],
        },
    },
    {
        "name": "qualificar_lead",
        "description": "Registra a qualificação coletada no chat.",
        "parameters": {
            "type": "object",
            "properties": {
                "dor": {"type": "string"},
                "faixa_orcamento": {"type": "string", "enum": ["<500", "500-1500", "1500-5000", ">5000", "nao_informado"]},
                "urgencia": {"type": "string", "enum": ["imediata", "30_dias", "90_dias", "sem_timeline"]},
                "papel_decisao": {"type": "string", "enum": ["decisor", "influenciador", "usuario", "nao_informado"]},
            },
            "required": ["dor", "faixa_orcamento", "urgencia", "papel_decisao"],
        },
    },
    {
        "name": "agendar_reuniao",
        "description": "Lista slots reais e agenda reunião na agenda do executivo.",
        "parameters": {
            "type": "object",
            "properties": {
                "data_preferida": {"type": "string"},
                "fuso": {"type": "string"},
                "resumo": {"type": "string"},
            },
            "required": ["fuso", "resumo"],
        },
    },
    {
        "name": "escalar_para_humano",
        "description": "Transfere a conversa para um vendedor humano com contexto.",
        "parameters": {
            "type": "object",
            "properties": {
                "motivo": {"type": "string", "enum": ["pedido_humano", "negociacao", "duvida_sem_base", "enterprise", "reclamacao"]},
                "contexto": {"type": "string"},
            },
            "required": ["motivo", "contexto"],
        },
    },
    {
        "name": "registrar_opt_out",
        "description": "Registra descadastro/opt-out (LGPD) e interrompe a conversa.",
        "parameters": {
            "type": "object",
            "properties": {
                "motivo": {"type": "string", "enum": ["sem_interesse", "solicitado", "outro"]},
            },
            "required": ["motivo"],
        },
    },
]

TOOL_BY_NAME: dict[str, dict] = {t["name"]: t for t in TOOL_SCHEMAS}
