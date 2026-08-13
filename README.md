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

## Stack (aprovada)
- **NestJS** (API) + **Temporal/BullMQ** (orquestração de longa duração)
- **Python** (workers de extração/IA)
- **PostgreSQL + pgvector** (dados + RAG)
- **React** (dashboard/builder)

## Sprints
Ver `docs/SPRINTS.md` para o mapeamento sprint → artefatos → status.

## ⚠️ Modo de operação
Este repositório opera em **modo design/simulação**. Nenhum disparo real, coleta real ou agendamento real é executado sem autorização explícita. Toda integração externa usa **providers mock** e **kill-switch fail-closed**.

## Subir o ambiente de infraestrutura
```bash
docker compose up -d          # postgres+pgvector, redis, temporal
cp .env.example .env
npm install                   # workspaces
npm test                      # testes dos pacotes
```
