# Growth OS — Runbook Operacional

**Modo:** design/simulação · **Regra de parada:** nenhuma ação real sem `GROWTHOS_MODE=approved` e autorização explícita.

## 1. Subir o ambiente

```bash
docker compose up -d          # postgres+pgvector (5433), redis (6379), temporal (7233) + UI (8080)
cp .env.example .env          # ajuste conforme necessário
npm install
npm run build                 # compila core + api + worker + web
npm run migrate --workspace=@growthos/api   # aplica migrations 001–008 (idempotentes)
npm test                      # testes TS (core 44 + api 24)

# API + dashboard
npm run dev --workspace=@growthos/api       # http://localhost:3000 (modo simulation)
npm run dev --workspace=@growthos/web       # http://localhost:5173

# Testes Python (via Docker)
docker build -t growthos-workers workers/python
docker run --rm --add-host=host.docker.internal:host-gateway \
  -e "GROWTHOS_DB_URL=postgresql://growthos:growthos@host.docker.internal:5433/growthos" \
  -v "$PWD/workers/python:/app" growthos-workers
```

## 2. Validar o pipeline (prova de execução)

```bash
# Relatório E2E simulado (450 coletados → funil → ARR ~R$33,6k)
docker run --rm -v "$PWD/workers/python:/app" -w /app python:3.12-slim \
  sh -c "pip install -q pytest && python -m src.simulation.e2e"

# Pipeline persistente (grava leads + run no Postgres e expõe via API)
docker run --rm --add-host=host.docker.internal:host-gateway \
  -e "GROWTHOS_DB_URL=postgresql://growthos:growthos@host.docker.internal:5433/growthos" \
  -v "$PWD/workers/python:/app" -w /app growthos-workers \
  python -m src.simulation.run_pipeline_persist

# Teste de carga (sequenciador + kill-switch)
node scripts/load-test.mjs

# Workflow Temporal (worker + disparo real de campanha)
npm run dev --workspace=@growthos/temporal-worker   # registra activities + workflow
node apps/temporal-worker/dist/start.js             # dispara workflow (7 disparos; lead-0 suppressido)
```

## 3. Fluxo de operação

| Etapa | Ação | Gate |
|---|---|---|
| 1 | Definir ICP (CNAE/região/capital) em `.env` | Limites de volume ≤ 100/dia/canal |
| 2 | Executar pipeline Pilar 1 (coleta/filtro/score) | Rejeição de desqualificados na raiz |
| 3 | Revisar workflow no builder (JSON) | `validateWorkflow` passa |
| 4 | Planejar envios (warm-up progressivo) | Dentro da janela comercial + jitter |
| 5 | Agente conversa e qualifica | Sanidade anti-alucinação passa |
| 6 | Agendamento → hand-off humano | Qualificação ≥ 70 |
| 7 | Monitorar dashboard | Saúde do canal ≥ 60; rejeição ≤ 5% |

## 4. API — endpoints (localhost:3000)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/status` | Modo, uptime, kill-switch, contadores, saúde, suppression, leads |
| GET/POST | `/suppression` · `/suppression/:cnpj` | Lista/consulta/adiciona opt-out (CNPJ, contains) |
| GET/POST | `/campaigns` · `/campaigns/:id` | Lista/cria/consulta campanhas |
| POST | `/campaigns/:id/plan-day` · `/simulate-turn` | Planeja envios (sem mutar contadores) / simula turno (state machine) |
| GET | `/channels/health` · `/channels/kill-switch` | Saúde do canal (no_data/healthy/warning/critical, score≤100) / estado do kill-switch |
| POST | `/channels/pause` · `/resume` | Pausa (fail-closed) / retoma manualmente |
| GET | `/metrics/funnel` | Contadores + taxas + ARR projetado (parâmetros via config) |
| POST | `/events` | Ingestão idempotente (chave `eventId`; `optout` → suppression) |
| GET | `/leads` · `/leads/runs` | Leads persistidos + runs do pipeline |

Autenticação: se `GROWTHOS_API_KEY` estiver configurada, enviar header `X-Api-Key` (401 sem/errado).

## 4.1 Kill-switch (emergência)

- **Automático:** rejeição > 5% ou score < 60 → campanha **pausa sozinha** (fail-closed). Canal sem dados (`no_data`) **nunca** autopausa.
- **Manual:** `POST /channels/pause` com motivo; verificar `GET /channels/kill-switch`.
- **Retomada:** sempre manual e deliberada (`POST /channels/resume`), nunca automática.

## 4.2 Temporal — operação

- Workflow `campaignRun` (queue `growthos-campaign`); retries (1s · ×2 · 5 tentativas); idempotência por `eventId`.
- UI: http://localhost:8080 (inspecionar history, retries e erros por workflow).
- Workflow valida config antes de executar (`validationErrors` estruturados) e respeita kill-switch/suppression por lead.
- Estado sobrevive a restart do servidor Temporal (persistência real em Postgres do lado da API).

## 5. Conformidade (não negociável)

- `SuppressionList` (opt-out) é consultada **antes** de cada envio.
- Opt-out processado com prioridade; nunca reenviar.
- Sem dados sensíveis; minimização; auditoria por turno.
- Envios só em janela comercial local; volume controlado por warm-up.

## 6. Logs e observabilidade

- Logs estruturados (JSON) em `createLogger`; erros da API estruturados via `AllExceptionsFilter`.
- Eventos de funil alimentam `funnelMetrics` → ARR projetado (parâmetros `ARR_*` em config).
- Alertas (`evaluateAlerts`) escalam info → warning → critical.
- **`GET /status`** consolida: modo, uptime, kill-switch, contadores, saúde do canal, suppression e leads — usado como healthcheck e smoke test.
- Dashboard React (`apps/web`) consome a API real (abas Dashboard / Builder / Leads & Suppression) com estados de loading/erro.
