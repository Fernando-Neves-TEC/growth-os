# Growth OS — Arquitetura

## Visão
Sistema distribuído, orientado a eventos, de prospecção ativa com **intervenção humana zero até a reunião qualificada**, operando em **modo design/simulação** (fail-closed).

```mermaid
flowchart TB
    subgraph P1["Pilar 1 — Extração (Python)"]
        A1["Maps + CNPJ collectors (mock)"]
        A2["Normalização/Dedup"]
        A3["Enriquecimento (WhatsApp/E-mail)"]
        A4["Filtro preditivo + Scoring"]
    end
    subgraph P2["Pilar 2 — Orquestração (TS core)"]
        B1["Builder/validateWorkflow"]
        B2["ConversationStateMachine"]
        B3["Sequencer (warm-up/jitter/hand-off)"]
    end
    subgraph P3["Pilar 3 — Agente (Python)"]
        C1["SalesAgent + Tool Calling"]
        C2["RAG (pgvector em produção)"]
        C3["Sanidade anti-alucinação"]
        C4["Qualificação + Agenda (mock)"]
    end
    subgraph P4["Pilar 4 — Observabilidade (TS+Python)"]
        D1["funnelMetrics / ARR"]
        D2["channelHealth"]
        D3["KillSwitch / Alertas"]
    end
    P1 --> P2
    P2 --> P3
    P2 --> P4
    P3 --> P4
```

## Decisões técnicas
- **Stack:** NestJS (API) + Temporal/BullMQ (longa duração) · Python (workers) · PostgreSQL + pgvector · React.
- **Domínio em TS puro** (`@growthos/core`) — testável sem infra; NestJS/Temporal são adapters finos.
- **Mocks isolados:** coletores, canais e agenda são providers mock; provedores reais trocam pelo mesmo contrato.
- **Fail-closed:** config valida limites; compliance bloqueia opt-out/volume; kill-switch pausa campanhas.

## Repositório
```
packages/core/          domínio TS (config, pilar2, pilar4, s9) — CommonJS
workers/python/         workers: pilar1, pilar3, pilar4, simulation
apps/api/               API NestJS (campaigns, health, metrics) sobre o core
apps/temporal-worker/   worker Temporal + workflow campaignRun (atividades mock)
apps/web/               dashboard React (builder + métricas + saúde)
migrations/             SQL (pgvector)
scripts/load-test.mjs   teste de carga simulado
```

## Roadmap de evolução
1. **Fase 2 (entregue):** API NestJS + worker Temporal (workflow executado no Temporal local) + dashboard React — integrados sobre o core validado.
2. **Fase 3:** persistência real (PostgreSQL/pgvector) na API e worker; provedores reais (WhatsApp Business, e-mail verificado, Cal.com) — **somente** com `GROWTHOS_MODE=approved`.
3. **Fase 4:** builder drag-and-drop completo no dashboard + multi-tenant.
