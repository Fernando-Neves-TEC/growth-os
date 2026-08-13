# Growth OS — Motor de Prospecção Autônoma

Sistema de **prospecção ativa, extração de leads e funil de conversão autônomo** com **intervenção humana zero até a reunião qualificada**.

Baseado nos documentos de estratégia e especificação:
- `../GrowthOS-Estudo/GROWTH-OS-ESTRATEGIA.md`
- `../GrowthOS-Estudo/GROWTH-OS-ESPECIFICACAO-TECNICA.md`
- `../GrowthOS-Estudo/GROWTH-OS-PILAR3-BLUEPRINT-AGENTE.md`

## Pilares

| Pilar | Módulo | Localização |
|---|---|---|
| 1 | Extração Inteligente (Maps/CNPJ, enriquecimento, filtro preditivo, scoring) | `workers/python/src/pilar1` |
| 2 | Orquestrador de Fluxos (builder, state machine, sequenciador anti-ban, hand-off) | `packages/core/src/pilar2` + `apps/api` |
| 3 | IA Conversacional (agente LLM + tool calling, RAG, qualificação, agendamento) | `workers/python/src/pilar3` |
| 4 | Observabilidade (métricas, saúde do canal, alertas, kill-switch) | `packages/core/src/pilar4` + `workers/python/src/pilar4` |

## Stack (implementada)
- **NestJS** (API REST) + **Temporal** (orquestração de longa duração) + **React/Vite** (dashboard)
- **Python** (workers de extração/IA + pipeline persistente)
- **PostgreSQL + pgvector** (dados + RAG) · **Redis** (cache/warm-up)
- Monorepo npm workspaces: `packages/core` (domínio TS, CommonJS) · `apps/api` · `apps/temporal-worker` · `apps/web`

## Estado (ENTREGUE — Fase 1 a Fase 3)
- **S0–S9 (Fase 1):** domínio TS + workers Python + infra validada (GATE aprovado, commit `6d7549c`/`662e013`).
- **Fase 2:** API NestJS + worker Temporal (workflow real) + dashboard React (commit `453a142` + `8ca41cb`).
- **Fase 3:** persistência durável, eventos idempotentes, pipeline persistente, execução Temporal com suppression/kill-switch/retries, dashboard ampliado, segurança (API key), conformidade TS/Python e CI (commits `6498e92` → `b16fabd`).
- **Provas reais:** restart com kill-switch/suppression duráveis · workflow Temporal executado (7 disparos, lead suppressido pulado) · 44 leads persistidos + run via API · health 70.5 · regressão final verde (core 44 · API 24 · Python 51).

## Sprints
Ver `docs/SPRINTS.md` para o mapeamento sprint → artefatos → status.

## ⚠️ Modo de operação
Este repositório opera em **modo design/simulação** (`GROWTHOS_MODE=simulation`). Nenhum disparo real, coleta real ou agendamento real é executado sem autorização explícita (`GROWTHOS_MODE=approved`). Toda integração externa usa **providers mock** e **kill-switch fail-closed**.

## Subir o ambiente
```bash
docker compose up -d            # postgres+pgvector (5433), redis (6379), temporal (7233) + UI (8080)
cp .env.example .env
npm install
npm run build                   # compila core + api + worker + web
npm run migrate --workspace=@growthos/api   # aplica migrations 001–008
npm test                        # testes dos workspaces TS (core 44 + api 24)
npm run dev --workspace=@growthos/api       # API em http://localhost:3000
npm run dev --workspace=@growthos/web       # dashboard em http://localhost:5173
```

## Endpoints principais
`GET /status` · `GET/POST /suppression` (+`/:cnpj`) · `GET/POST /campaigns` · `POST /campaigns/:id/plan-day|simulate-turn` · `GET /channels/health|kill-switch` · `POST /channels/pause|resume` · `GET /metrics/funnel` · `POST /events` · `GET /leads` · `GET /leads/runs`.
Autenticação opcional por `GROWTHOS_API_KEY` (header `X-Api-Key`) quando configurada.

## Variáveis de ambiente
`GROWTHOS_MODE` (simulation|approved) · `GROWTHOS_DB_URL` (padrão `postgresql://growthos:growthos@localhost:5433/growthos`) · `GROWTHOS_API_KEY` · `ARR_SCHEDULE_RATE` (55) · `ARR_CLOSE_RATE` (20) · `ARR_TICKET_MONTHLY` (1500) · `TEMPORAL_ADDRESS` (localhost:7233) · `GROWTHOS_API_URL` (http://localhost:3000).

## Documentação
- `docs/ARCHITECTURE.md` — arquitetura final.
- `docs/RUNBOOK.md` — operação, endpoints, Temporal e dashboard.
- `docs/SPRINTS.md` — rastreamento completo (S0–S9, Fase 2, Fase 3 Blocos 1+A–F).
- Estudo/estratégia/especificação/blueprint em `../GrowthOS-Estudo/`.
