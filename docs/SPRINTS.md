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

## Checkpoint do GATE INFRA S0–S9 (2026-08-13) — APROVADO ✅
- **S0–S9 formalmente encerrados** sobre o commit de código `6d7549c`.
- **Fix de infra (causas comprovadas) isolado no commit dedicado `662e013`** — apenas `docker-compose.yml`:
  - `temporalio/ui:2.24` → `2.53.2` e `temporalio/auto-setup:1.24` → `1.29.7` (tags válidas no Docker Hub).
  - `DB=postgresql` → `DB=postgres12_pgx` (driver válido na imagem 1.29.7).
  - Removida `DYNAMIC_CONFIG_FILE_PATH` apontando para arquivo inexistente na imagem.
- **Infra validada (subida real):**
  - PostgreSQL 16.14 (healthy) + **pgvector 0.8.6**; migrations `leads_raw`/`leads_enriched` criadas no initdb.
  - Redis (healthy) — `PING`/`PONG` + read/write `SET/GET`.
  - Temporal — porta gRPC 7233 aceitando conexão; namespace `default` criado; worker/serviços iniciados; UI em 8080 (HTTP 200).
- **Regressão final verde:** build TypeScript OK · **41/41 testes TS** · **48/48 testes Python** (via Docker).
- **Git pós-gate:** árvore limpa; diff e index vazios.
- **Próxima ação:** **Fase 2 — API NestJS + worker Temporal + dashboard React** integrados sobre esta base validada.

## Checkpoint FASE 2 (2026-08-13) — entregue ✅
- **API NestJS** (`apps/api`): módulos campaigns (builder/validação, plan-day com warm-up, state machine), health (saúde/kill-switch), metrics (funil/ARR). Build OK · **12/12 testes** (unit + e2e supertest) · boot real validado.
- **Worker Temporal** (`apps/temporal-worker`): workflow `campaignRun` (usa `validateWorkflow` do core) + activities mock. Build OK · **workflow executado no Temporal local** (Docker): `workflowValid: true`, `dispatched: 8`.
- **Dashboard React** (`apps/web`): HealthPanel (saúde/kill-switch/ARR) + CampaignBuilder (JSON → criar campanha → simular turno). **Build de produção Vite OK**.
- **Ajuste de base:** `@growthos/core` convertido para **CommonJS** para compatibilidade com NestJS/Temporal (consumidores CJS); workspaces ampliados para `apps/*`.
- **Melhoria de lógica:** guarda "sem dados" no `channelHealth` — canal sem envios (`sent=0`) nunca autopausa (kill-switch fail-safe).
- **Regressão Fase 2:** build monorepo OK · core **42/42** · API **12/12** · Python **49/49**.
- **Infra:** Temporal (Docker) operacional para integração real do worker.

## Checkpoint FASE 3 — Bloco 1: Persistência durável (2026-08-13) ✅
- **Prioridade da auditoria atendida:** kill-switch e suppression agora **duráveis em PostgreSQL** — sobrevivem a restart (prova real feita).
- **Camada de persistência** (`apps/api/src/persistence`): interfaces + impls PostgreSQL (`pg`) + impls em memória para testes; `DbModule` (pool) e `PersistenceModule` (global).
- **Migrations novas:** `003_kill_switch_state`, `004_suppression`, `005_campaigns`, `006_funnel_counters`; **runner** `npm run migrate --workspace=@growthos/api` (aplicado: 001–006).
- **Store em memória removido**; serviços (campaigns/health/metrics) agora assíncronos sobre stores duráveis.
- **Rota nova:** `GET/POST /suppression` (opt-out durável); `ingest()` morto removido.
- **Provas:** teste de integração `db.integration.test.ts` (kill-switch/suppression sobrevivem a nova instância de store) + prova via API com restart real.
- **Correção de ambiente:** porta do Postgres do Docker em **5433** (conflito com Postgres local do Windows na 5432).
- **Regressão:** build monorepo OK · core **42/42** · API **15/15** · Python **49/49**.
- **Pendências F3 (próximos blocos):** ingestão real de eventos do funil; `planDay`/eventos idempotentes; ARR em configuração; contrato canônico TS/Python.

## Convenções
- Todo artefato segue o contrato de saída dos documentos de estudo.
- Fail-closed: qualquer violação de conformidade interrompe o pipeline.
- Providers externos (WhatsApp, e-mail, agenda, Maps, CNPJ) são **mock** em simulation.
