"""Modelos de domínio compartilhados dos workers Python."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class RawLead:
    """Lead bruto, como sai dos coletores (Pilar 1)."""

    source: str
    company_name: str
    cnpj: str
    cnae: str
    address: str
    city: str
    state: str
    phone: str
    website: str | None = None
    email: str | None = None
    capital: float = 0.0
    porte: str = ""
    rating: float | None = None
    simulated: bool = False
    raw_id: str | None = None


@dataclass
class EnrichedLead:
    """Lead normalizado + enriquecido + filtrado + pontuado."""

    company_name: str
    cnpj: str
    cnae: str
    city: str
    state: str
    address: str
    phone: str
    whatsapp: str | None = None
    whatsapp_verified: bool = False
    email: str | None = None
    email_verified: bool = False
    website: str | None = None
    capital: float = 0.0
    porte: str = ""
    rating: float | None = None
    icp_fit_score: float = 0.0
    source: str = ""
    legal_basis: str = "interesse_legitimo_simulado"
    opted_out: bool = False
    meta: dict = field(default_factory=dict)


@dataclass
class ContactAttempt:
    """Registro de envio (Pilar 2)."""

    lead_cnpj: str
    channel: str
    body: str
    status: str  # sent | delivered | read | replied | rejected | blocked
    sent_at: datetime
    read_at: datetime | None = None
    replied_at: datetime | None = None


@dataclass
class ConversationTurn:
    """Turno da conversa (Pilar 3)."""

    lead_cnpj: str
    role: str  # agent | lead
    content: str
    tool_calls: list[dict] = field(default_factory=list)
    at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class Qualification:
    """Qualificação capturada no chat (Pilar 3)."""

    pain: str = ""
    budget_range: str = "nao_informado"
    urgency: str = "sem_timeline"
    decision_role: str = "nao_informado"
    score: float = 0.0
