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

## Estado (ENTREGUE — Fase 1 a Fase 3 + GAUNTLET V2)
- **S0–S9 (Fase 1):** domínio TS + workers Python + infra validada (GATE aprovado).
- **Fase 2:** API NestJS + worker Temporal (workflow real) + dashboard React.
- **Fase 3:** persistência durável, eventos idempotentes, pipeline persistente, execução Temporal, dashboard, segurança, conformidade TS/Python e CI.
- **GAUNTLET V2 (hardening — ver `docs/SPRINTS.md`):**
  - **C1** API→Temporal conectado (`POST /campaigns/:id/start` inicia o workflow; prova real com suppression).
  - **C2** contrato de modos **fail-closed**: `approved` exige `GROWTHOS_API_KEY` (boot recusa sem chave; guard exige em todas as rotas).
  - **H1** eventos **atômicos** (evento+contador/optout em transação; 1 evento → 1 efeito; concorrência testada).
  - **H2** taxas >100% eliminadas pela **causa raiz** (invariantes do funil rejeitam eventos fora de ordem com 422) + mock corrigido.
  - **H3** 404 para recursos inexistentes (não 500) · **H4** validação HTTP estruturada (ZodValidationPipe).
  - **H5** kill-switch **durante a execução** (interrompe novos envios entre leads; prova real: 2/300 enviados, `paused:true`, resume manual + re-run idempotente).
  - **H6** rate limiting + payload limit + CORS por ambiente.
  - **GAUNTLET SECURITY MAINTENANCE (S2/S10):** autenticação **humana** (operadores + sessões servidor-side + cookie HttpOnly + CSRF) separada da credencial **M2M** (`X-Api-Key`); **`VITE_API_KEY` removido do frontend** (nunca mais a chave administrativa no bundle); auditoria de segurança estruturada (S10) persistida e consultável.
  - **Médios:** FK `leads_enriched→pipeline_runs` (migration 009), runner de migrations com lock/transação, conformidade TS/Python **cruzada real** (referência do core), CI com Postgres services (testes de integração nunca pulam silenciosamente), testes do cliente web.
- **Provas reais:** restart com kill-switch/suppression duráveis · workflow Temporal via produto (campanha `49b0f2d8`: l0 supprimido = 0 eventos) · kill-switch em tempo real (2/300, resume + re-run 300 idempotente) · boot fail-closed em `approved` sem chave · **S2**: canary de API key NÃO está no bundle · **S2**: login→sessão→ação administrativa→logout→401 · **S2**: sessão sobrevive a restart (Postgres) · **S10**: eventos de segurança persistidos e redigidos.

## Sprints
Ver `docs/SPRINTS.md` para o mapeamento sprint → artefatos → status.

## ⚠️ Autenticação (dois domínios, nunca misturar)
- **Humano** (dashboard/operador): `operators` (argon2id) + **sessão servidor-side** (cookie `HttpOnly`/`SameSite=Lax`, `Secure` em approved) + CSRF por sessão em mutações. Endpoints: `POST /auth/login` · `GET /auth/me` · `POST /auth/logout`.
- **Máquina-a-máquina (M2M)**: `X-Api-Key` (ApiKeyGuard) — integrações (ex.: worker Temporal). Rotas `shared` aceitam sessão OU chave.
- **Navegador**: **nunca** recebe a chave administrativa (`VITE_API_KEY` proibido e removido).
- Primeiro operador via **CLI local** (não exposto por HTTP): `npm run admin:create --workspace=@growthos/api <email>`.
- Matriz por rota: `public` (login/me/health) · `human` (admin do dashboard) · `shared` (worker) · `m2m` (chave). Padrão sem decorator = `human` (fail-closed).

## Subir o ambiente
```bash
docker compose up -d            # postgres+pgvector (5433), redis (6379), temporal (7233) + UI (8080)
cp .env.example .env
npm install
npm run build                   # compila core + api + worker + web
npm run migrate --workspace=@growthos/api   # aplica migrations 001–012 (idempotentes, com lock)
npm run admin:create --workspace=@growthos/api admin@clinica.local   # cria o primeiro operador (CLI local)
npm test                        # testes dos workspaces TS (core 59 + api 86 + web 5)
npm run dev --workspace=@growthos/api       # API em http://localhost:3000
npm run dev --workspace=@growthos/web       # dashboard em http://localhost:5173 (login humano)
```

## Endpoints principais
Auth: `POST /auth/login` · `GET /auth/me` · `POST /auth/logout` · `GET /security/audit` (humano).
Produto: `GET /status` · `GET/POST /suppression` (+`/:cnpj`) · `GET/POST /campaigns` (+`/:id`) · `POST /campaigns/:id/plan-day|simulate-turn|start` · `GET /channels/health|kill-switch` · `POST /channels/pause|resume` · `GET /metrics/funnel` · `POST /events` · `GET /leads` (+`/runs`).
Mutações com sessão exigem header `X-CSRF-Token`; integrações M2M usam `X-Api-Key` (obrigatória em `approved`).

## Variáveis de ambiente
`GROWTHOS_MODE` (simulation|approved) · `GROWTHOS_DB_URL` (padrão `postgresql://growthos:growthos@localhost:5433/growthos`) · `GROWTHOS_API_KEY` (M2M; obrigatória em approved) · `GROWTHOS_SESSION_TTL_MS` (padrão 8h) · `GROWTHOS_ADMIN_EMAIL`/`GROWTHOS_ADMIN_PASSWORD` (CLI `admin:create`) · `GROWTHOS_BODY_LIMIT` (100kb) · `GROWTHOS_RATE_LIMIT_TTL_MS`/`GROWTHOS_RATE_LIMIT_MAX` (60000/1000) · `GROWTHOS_CORS_ORIGINS` · `ARR_SCHEDULE_RATE` (55) · `ARR_CLOSE_RATE` (20) · `ARR_TICKET_MONTHLY` (1500) · `TEMPORAL_ADDRESS` (localhost:7233) · `GROWTHOS_API_URL` (http://localhost:3000) · `GROWTHOS_DB_TEST_REQUIRED` (CI: falha se banco ausente).

## Documentação
- `docs/ARCHITECTURE.md` — arquitetura final.
- `docs/RUNBOOK.md` — operação, endpoints, Temporal, kill-switch e dashboard.
- `docs/SPRINTS.md` — rastreamento completo (S0–S9, Fase 2, Fase 3 Blocos 1+A–F, GAUNTLET V2).
- Estudo/estratégia/especificação/blueprint em `../GrowthOS-Estudo/`.
