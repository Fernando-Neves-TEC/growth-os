# Growth OS — Rastreamento de Sprints

Modo: **design/simulação** · Stack aprovada: NestJS + Temporal/BullMQ · Python · PostgreSQL/pgvector · React

Legenda: ✅ implementado · 🟡 parcial · ⬜ pendente

| Sprint | Foco | Artefatos | Status |
|---|---|---|---|
| S0 | Fundação do monorepo + infra | README, workspaces, docker-compose (pgvector/redis/temporal), config validadora fail-closed, logger, erros, CI | ✅ |
| S1 | Pilar 1 — Coleta (Maps/CNPJ) + normalização/dedup | `workers/python/src/pilar1` — collectors mock, normalização, dedup; migração `leads_raw` | ✅ |
| S2 | Pilar 1 — Enriquecimento + filtro preditivo + scoring | enrichment (mock), validação de e-mail, filtro porte/capital/geo/CNAE, scoring | ✅ |
| S3 | Pilar 2 — Builder + state machine | `packages/core/src/pilar2` — schema de workflow, validação, engine de máquina de estados | ✅ |
| S4 | Pilar 2 — Sequenciador multicanal + anti-ban + hand-off | jitter, warm-up, janela comercial, retry/backoff, hand-off condicional | ✅ |
| S5 | Pilar 3 — Agente LLM + RAG + anti-alucinação | tool calling, guarda de sanidade, sistema de prompt, testes T2/T5 | ✅ |
| S6 | Pilar 3 — Qualificação + agendamento + opt-out | scoring de qualificação, agendador (mock Cal.com), hand-off payload, opt-out, testes T1/T3/T4 | ✅ |
| S7 | Pilar 4 — Observabilidade + kill-switch | health score, alertas, auto-pause | ✅ |
| S8 | Integração E2E simulada | pipeline 225 leads → funil → relatório de ARR (script simulado) | ✅ |
| S9 | Hardening + docs + runbook | segurança, compliance, testes de carga, RUNBOOK.md, docs finais | ✅ |

## Decisões aprovadas (checkpoint 2026-08-12)
- **Stack:** NestJS + Temporal/BullMQ · Python · PostgreSQL + pgvector · React.
- **Limites de volume:** 50–100 disparos/dia/canal no smoke test; ICP estrito via CNAE/Região.
- **Sprint S0:** aprovada em **modo design/simulação** — nenhum disparo real até testes unitários/integração em sandbox.
- **Regra de parada:** nenhuma integração externa real sem autorização explícita (`GROWTHOS_MODE=approved`).

## Convenções
- Todo artefato segue o contrato de saída dos documentos de estudo.
- Fail-closed: qualquer violação de conformidade interrompe o pipeline.
- Providers externos (WhatsApp, e-mail, agenda, Maps, CNPJ) são **mock** em simulation.
