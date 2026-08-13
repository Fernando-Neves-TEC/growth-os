"""Agenda (Pilar 3) — provider mock de Cal.com / Google Calendar.

Contrato: listar slots reais e reservar. Em simulation não há integração real.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timedelta


@dataclass
class BookingResult:
    ok: bool
    event_id: str | None = None
    invite_link: str | None = None
    error: str | None = None


class CalendarProvider(ABC):
    @abstractmethod
    def list_slots(self, start: datetime, end: datetime, duration_min: int = 30) -> list[str]:
        raise NotImplementedError

    @abstractmethod
    def book(self, slot: str, summary: str, attendee: str) -> BookingResult:
        raise NotImplementedError


class MockCalendarProvider(CalendarProvider):
    """Slots em horário comercial (09h-18h), passo de 30min."""

    def __init__(self, start_hour: int = 9, end_hour: int = 18) -> None:
        self.start_hour = start_hour
        self.end_hour = end_hour

    def list_slots(self, start: datetime, end: datetime, duration_min: int = 30) -> list[str]:
        slots: list[str] = []
        cursor = start.replace(minute=0, second=0, microsecond=0)
        step = timedelta(minutes=30)
        while cursor < end:
            if self.start_hour <= cursor.hour < self.end_hour:
                slots.append(cursor.isoformat())
            cursor += step
        return slots

    def book(self, slot: str, summary: str, attendee: str) -> BookingResult:
        return BookingResult(
            ok=True,
            event_id=f"evt-{abs(hash(slot)) & 0xFFFFFF:06x}",
            invite_link=f"https://cal.mock/growthos/{abs(hash(slot)) & 0xFFFFFF:06x}",
        )
