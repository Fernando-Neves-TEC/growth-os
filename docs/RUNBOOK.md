# Growth OS — Runbook Operacional

**Modo:** design/simulação · **Regra de parada:** nenhuma ação real sem `GROWTHOS_MODE=approved` e autorização explícita.

## 1. Subir o ambiente

```bash
docker compose up -d          # postgres+pgvector (5433), redis (6379), temporal (7233) + UI (8080)
cp .env.example .env          # ajuste conforme necessário
npm install
npm run build                 # compila core + api + worker + web
npm run migrate --workspace=@growthos/api   # aplica migrations 001–009 (idempotentes, com lock)
npm test                      # testes TS (core 59 + api 62 + web 3)

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

# Workflow Temporal (worker + disparo de campanha PELO PRODUTO)
npm run dev --workspace=@growthos/temporal-worker   # registra activities + workflow
# Criar e iniciar via API (não via start.js):
#   POST /campaigns  {name, workflow}
#   POST /campaigns/:id/start  {plans:[{leadId,cnpj?,channel,body}]} → inicia o workflow
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
| POST | `/campaigns/:id/start` | **Ativa a campanha** (status `active`) e inicia o workflow no Temporal |
| GET | `/channels/health` · `/channels/kill-switch` | Saúde do canal (no_data/healthy/warning/critical, score≤100) / estado do kill-switch |
| POST | `/channels/pause` · `/resume` | Pausa (fail-closed) / retoma manualmente |
| GET | `/metrics/funnel` | Contadores + taxas + ARR projetado (parâmetros via config) |
| POST | `/events` | Ingestão idempotente (chave `eventId`; `optout` → suppression) |
| GET | `/leads` · `/leads/runs` | Leads persistidos + runs do pipeline |

Autenticação: `GROWTHOS_API_KEY` (header `X-Api-Key`). Em `GROWTHOS_MODE=approved` a chave é **obrigatória** (a API não inicia sem ela) e exigida em todas as rotas.

## 4.0 Limites e CORS

- Payload: `GROWTHOS_BODY_LIMIT` (padrão `100kb`; excedido → 413).
- Rate limit por IP: `GROWTHOS_RATE_LIMIT_TTL_MS`/`GROWTHOS_RATE_LIMIT_MAX` (padrão `60000`/`1000`; excedido → 429).
- **Login:** limite ESPECÍFICO `POST /auth/login` = **5/min por IP** (independente do global; 5ª→401, **6ª→429**; evento `RATE_LIMIT_HIT` persistido; sem bypass por `X-Forwarded-For`).
- CORS: `GROWTHOS_CORS_ORIGINS` (allowlist; tem precedência). Em `approved` sem allowlist, origens externas são **bloqueadas** (fail-closed). Em `simulation`, apenas origens LOCAIS do dashboard (`localhost:5173`/`127.0.0.1:5173`) são autorizadas — origem arbitrária **não** é refletida.

## 4.1 Kill-switch (emergência, inclusive durante execução)

- **Automático:** rejeição > 5% ou score < 60 → campanha **pausa sozinha** (fail-closed). Canal sem dados (`no_data`) **nunca** autopausa.
- **Manual:** `POST /channels/pause` com motivo; verificar `GET /channels/kill-switch`.
- **Durante a execução:** o workflow consulta o kill-switch **antes de cada lead** (ponto seguro de interrupção) — ao pausar, os próximos leads NÃO são enviados; o workflow termina com `paused: true` e os resultados parciais.
- **Contrato de retomada (resume):** sempre manual e deliberada (`POST /channels/resume`), nunca automática. Após resume, **re-disparar a campanha** (`POST /campaigns/:id/start` com o plano restante) — os eventos já registrados são **idempotentes** (mesmo `eventId`), então não há re-envio. Prova real: 2/300 enviados com pause; após resume + re-run, `dispatched: 300` sem duplicar kb0/kb1.

## 4.2 Temporal — operação

- Workflow `campaignRun` (queue `growthos-campaign`); retries (1s · ×2 · 5 tentativas); idempotência por `eventId`.
- UI: http://localhost:8080 (inspecionar history, retries e erros por workflow).
- Workflow valida config antes de executar (`validationErrors` estruturados) e respeita kill-switch/suppression por lead.
- Estado sobrevive a restart do servidor Temporal (persistência real em Postgres do lado da API).

## 5. Autenticação humana (S2) — operação

- **Dois domínios:** operador humano (sessão) ≠ máquina (API key). O navegador **nunca** recebe a chave administrativa.
- **Primeiro operador (CLI local):** `npm run admin:create --workspace=@growthos/api admin@clinica.local` (senha via prompt oculto ou `GROWTHOS_ADMIN_PASSWORD`; nunca imprime senha/hash; rejeita duplicado; não exposto por HTTP).
- **Login:** `POST /auth/login {email, password}` → sessão em cookie `HttpOnly`/`SameSite=Lax`/`Secure`(approved) + `csrfToken`.
- **Mutações autenticadas por sessão** exigem header `X-CSRF-Token` (403 se ausente/errado).
- **Logout:** `POST /auth/logout` revoga a sessão (pós-logout tudo exige login).
- **Sessão persistente** em Postgres: sobrevive a restart; expiração `GROWTHOS_SESSION_TTL_MS` (padrão 8h); `last_seen_at` atualizado a cada uso (touch amortizado ≥1min).
- **Brute force:** limite ESPECÍFICO de login (5/min por IP) — 401 nas 5 primeiras tentativas erradas, **429 na 6ª**; evento `RATE_LIMIT_HIT` persistido (sem segredos).
- **Revoke-all (troca de senha/vazamento):** `npm run admin:revoke-sessions --workspace=@growthos/api <email>` revoga TODAS as sessões ativas do operador (sem endpoint HTTP; registra `AUTH_LOGOUT`/`reason=revoke_all`).
- **Auditoria (S10):** eventos persistidos em `security_audit_events` (FK `actor_operator_id` `ON DELETE SET NULL` — histórico sobrevive à remoção do operador); consultar `GET /security/audit` (operador humano). Detecção local **IMPLEMENTED**; entrega de alerta externo **BLOCKED_EXTERNAL** (sem serviço conectado).

## 6. Conformidade (não negociável)

- `SuppressionList` (opt-out) é consultada **antes** de cada envio.
- Opt-out processado com prioridade; nunca reenviar.
- Sem dados sensíveis; minimização; auditoria por turno.
- Envios só em janela comercial local; volume controlado por warm-up.

## 7. Logs e observabilidade

- Logs estruturados (JSON) em `createLogger`; erros da API estruturados via `AllExceptionsFilter`.
- Eventos de funil alimentam `funnelMetrics` → ARR projetado (parâmetros `ARR_*` em config).
- Alertas (`evaluateAlerts`) escalam info → warning → critical.
- **`GET /status`** consolida: modo, uptime, kill-switch, contadores, saúde do canal, suppression e leads — usado como healthcheck e smoke test.
- Dashboard React (`apps/web`) consome a API real (abas Dashboard / Builder / Leads & Suppression) com estados de loading/erro.
