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

## Checkpoint FASE 3 — Blocos A–F: motor completo (2026-08-13) ✅
- **Bloco A (`fc0dd13`) — Eventos idempotentes + ARR em config:** `POST /events` com chave `eventId` (ON CONFLICT DO NOTHING), opt-out → suppression automática; `arrScheduleRate=55`/`arrCloseRate=20`/`arrTicketMonthly=1500` via config; `planDay` não muta contadores. Core 43/43 · API 22/22.
- **Bloco B (`428ce64`) — Pipeline persistente:** `LeadRepository` (psycopg, `save_run` + `upsert_leads` com ON CONFLICT atualizando `pipeline_run_id`), migration `008_pipeline_runs`, API `GET /leads` e `/leads/runs`. **Prova real:** CLI persistiu 74 leads + run lidos via API. Python 50/50 · API 23/23.
- **Bloco C (`366658b`) — Execução Temporal completa:** workflow `campaignRun` com suppression por lead, kill-switch, retries (1s·×2·5), eventos sent/delivered/read/replied; `GET /suppression/:cnpj`; clamp score≤100; mock `replied→read`. **Prova ao vivo:** 7 dispatched (lead-0 suppressido pulado), métricas 7/7/4/1, replyRate 25%, health 70.5. Python 50/50 · API 23/23 · core 44/44.
- **Bloco D (`9d08d7e`) — Dashboard ampliado:** abas Dashboard/Builder/Leads & Suppression, loading/erro, ARR parametrizado; build Vite OK.
- **Bloco E (`23086aa`) — Segurança:** `ApiKeyGuard` config-driven (`GROWTHOS_API_KEY`; prova 401 sem/errado, 200 com a chave), `AllExceptionsFilter` (erros estruturados), `GET /status` consolidado, validação de entrada. API 24/24.
- **Bloco F (`b16fabd`) — Conformidade + CI:** `test_conformance_health.py` (matriz TS/Python do canal health), CI ampliado (jobs ts-apps e web). Python 51/51; typechecks e build web verdes.
- **Regressão final (Bloco G):** build monorepo OK · core **44/44** · API **24/24** · Python **51/51** · typechecks verdes · smoke `GET /status` (health 70.5, suppressionCount 1, leads 44, contadores 7/7/4/1 persistidos após restart) · sem segredos no Git.
- **Persistência comprovada:** kill-switch/suppression/campanhas/contadores/eventos/leads/runs duráveis em Postgres; restart real validado (Bloco 1).
- **ITENS BLOCKED_EXTERNAL:** provedores reais (WhatsApp Business, e-mail, Cal.com, Maps, CNPJ) exigem credenciais reais e `GROWTHOS_MODE=approved` — **sem envios/coleta reais até autorização**; pipeline simulado + mocks entregues e testados.

## Checkpoint GAUNTLET LOOP V2 (2026-08-13) — hardening executado ✅ (CANDIDATE_DONE)
Backlog obrigatório da auditoria independente — cada item com reprodução, correção mínima, teste focal e evidência:

### Críticos
- **C1 — API→Temporal conectado ✅:** `POST /campaigns/:id/start` persiste status `active` e inicia o workflow via launcher (`TemporalWorkflowLauncher`, `@temporalio/client`). Executor puro `executeCampaignRun` no core (compartilhado entre Temporal e E2E determinístico). **Evidência real:** campanha `49b0f2d8` — l0 (supprimido) gerou 0 eventos; l1 `sent+delivered`; l2 `sent+delivered+read`; contadores/métricas refletem. **Fix de bug descoberto:** `PgCampaignStore` fazia double-parse de JSONB (`[object Object]`).
- **C2 — autenticação fail-open proibida ✅:** contrato de modos (`assertSafeBoot`): `approved` **sem** `GROWTHOS_API_KEY` → a API NÃO inicia (prova real: exit 1 com erro explícito). Guard exige a chave em `approved` em todas as rotas (401 sem/errada, 200 correta).

### Altos
- **H1 — evento+contador atômicos ✅:** `PgEventStore.apply` roda INSERT evento + efeito (contador/optout) em **transação** com `FOR UPDATE` no `funnel_counters`; teste `events.atomic.integration.test.ts` (normal, duplicado, falha→ROLLBACK sem evento órfão, concorrência→1 efeito).
- **H2 — taxas >100% ✅:** causa raiz — invariantes do funil (`assertFunnelInvariant`, core) rejeitam eventos fora de ordem com **422** (`FUNNEL_INVARIANT`); mock de envio corrigido (replied implica read). Clamp mantido só como defesa.
- **H3 — 404 ✅:** `ParseUUIDPipe(errorHttpStatusCode=404)` + `NotFoundException` (teste: UUID inválido/inexistente → 404, não 500).
- **H4 — validação estruturada ✅:** `ZodValidationPipe` aplicado em campaigns/events/suppression/health/leads (400 com `errors`); eliminados guards manuais dispersos.
- **H5 — kill-switch durante execução ✅:** executor verifica kill-switch **antes de cada lead** (ponto seguro de interrupção). **Prova real:** campanha 300 leads, pausa após 2s → `dispatched:2, paused:true`, resto NÃO enviado; kill-switch persiste; **resume manual** + re-run → `dispatched:300` idempotente (kb0 não duplicado).
- **H6 — rate limiting + payload + CORS ✅:** `@nestjs/throttler` (env `GROWTHOS_RATE_LIMIT_*`; 429 testado), payload limit (`GROWTHOS_BODY_LIMIT`; 413 testado), CORS por ambiente (`GROWTHOS_CORS_ORIGINS`; approved sem allowlist bloqueia).
- **H7 — dashboard com API key ✅:** cliente web envia `X-Api-Key` (`VITE_API_KEY`/`setApiKey`); teste `apps/web/src/api.test.ts`.

### Médios
- CNPJ validado (checksum) em suppression e optout ✅ · FK `leads_enriched→pipeline_runs` (migration `009_fks.sql`, sem órfãos) + CHECK não-negativo nos contadores ✅ · lifecycle: create→`draft`, start→`active` ✅ · `leads_raw` documentado como **PLANEJADO** (staging crua; pipeline atual grava direto em `leads_enriched`) · idempotência de envio: eventos idempotentes por `eventId`; adaptador real deve ser idempotente (documentado) · runner de migrations com **advisory lock + transação por arquivo** ✅ · CORS testado ✅ · CI com **Postgres services** e `GROWTHOS_DB_TEST_REQUIRED=1` (integração nunca pula silenciosamente) ✅ · conformidade TS/Python **cruzada real** via `scripts/health-reference.mjs` (referência do core) ✅.

### Regressão final
Build monorepo OK · **core 59/59 · API 62/62 · web 3/3 · Python 51/51** (com banco + referência TS) · migrations 001–009 idempotentes · Git limpo.

## Checkpoint GAUNTLET SECURITY MAINTENANCE (2026-08-13) — S2 + S10 ✅ (CANDIDATE_DONE)
Auditoria independente de segurança com dois achados, tratados sem propor alternativa à decisão arquitetural imutável.

### S2 — CRÍTICO: `VITE_API_KEY` expunha a credencial administrativa no navegador
- **Reprodução:** build com `VITE_API_KEY=CANARY_SECRET_DO_NOT_SHIP_84721` → canary presente em `apps/web/dist/assets/*.js` (**S2_REPRODUCED**).
- **Causa:** o frontend carregava a API key administrativa via `import.meta.env.VITE_API_KEY` e enviava `X-Api-Key`.
- **Decisão arquitetural imutável:** dois domínios — **operador humano** (login individual, sessão servidor-side, autorização) ≠ **máquina-a-máquina** (`X-Api-Key`/ApiKeyGuard). Nunca misturar.
- **Implementação:**
  - Identidade: tabela `operators` (email único, `password_hash` **argon2id**, role, active) — migration `010`.
  - Sessão: tabela `sessions` (token_hash=sha256, csrf_token, expiração, revogação) — migration `011`; cookie `HttpOnly`/`SameSite=Lax`/`Secure`(approved); persistente (restart provado).
  - Bootstrap: CLI local `npm run admin:create` (senha via prompt oculto; nunca imprime; rejeita duplicado; não exposto por HTTP).
  - Endpoints: `POST /auth/login` · `GET /auth/me` · `POST /auth/logout` · CSRF por sessão em mutações.
  - Autorização: `AuthGuard` global com matriz por rota (`@Public`/`@Human`/`@Shared`/`@M2M`; padrão `human` fail-closed). Chave M2M **não** concede acesso humano.
  - Frontend: `VITE_API_KEY`/`setApiKey` **removidos**; fluxo login→dashboard→logout; `X-CSRF-Token` em mutações; `credentials: include`.
  - Worker (M2M): envia `X-Api-Key` quando configurada.
  - **Prova de bundle:** canary NÃO está no dist (script `scripts/check-bundle-secret.mjs` + passo no CI web).

### S10 — MÉDIO: observabilidade de segurança
- `SecurityAuditService` emite eventos estruturados (`AUTH_LOGIN_SUCCESS/FAILURE`, `AUTH_LOGOUT`, `AUTH_SESSION_INVALID`, `AUTHORIZATION_DENIED`, `RATE_LIMIT_HIT`) com metadados seguros (request_id, ip, path, user_agent, actor).
- Persistência append-only em `security_audit_events` (migration `012`), gerada **somente pelo servidor**; consulta `GET /security/audit` (humano).
- **Redação garantida por construção e testada** (nenhum valor de senha/API key/session/CSRF/connection string em evento).
- `SECURITY EVENT DETECTION: IMPLEMENTED` · `EXTERNAL ALERT DELIVERY: BLOCKED_EXTERNAL` (adapter `SecurityAuditSink` no-op preparado; sem serviço externo conectado).

### Testes (S2+S10 + adversariais)
Login (sucesso/inexistente/senha errada/inativo/vazio/email inválido) · sessão (me 401/200, cookie adulterado, logout, logout repetido, session fixation) · CSRF (403 sem token) · autorização (humana sem sessão 401; M2M em approved sem chave 401; chave não concede rota humana) · brute force login → 429 · RATE_LIMIT_HIT persistido · redação de eventos · persistência de sessão/auditoria em Postgres (restart).

### Regressão
Build monorepo OK · typecheck OK · **core 59/59 · API 86/86 · web 5/5 · Python 51/51** · migrations 001–012 idempotentes · smoke real (login→me→admin→logout→401) · restart (sessão sobrevive).

---

## GAUNTLET SECURITY CLOSURE — fechamento das ressalvas da auditoria independente (SECURITY_AUDIT_PASS_WITH_RESERVATIONS)

### ALTO — brute force no login
- **Reprodução:** config padrão (global 1000/min), 7 logins errados consecutivos → **7×401, sem 429** (ALTO_REPRODUCED).
- **Fix:** `@Throttle({ default: { limit: 5, ttl: 60_000 } })` em `POST /auth/login` (mecanismo oficial `@nestjs/throttler`; **independente** do global). `throttle.e2e.test.ts` deixa de depender do global; novo `login-rate.e2e.test.ts` roda sob config PADRÃO.
- **Prova real:** 5×401 → **6ª e 7ª = 429**; `RATE_LIMIT_HIT` persistido no Postgres (ip/path/user_agent; metadata `{}` — sem segredos).
- **Adversarial:** 4 erradas + 1 correta → 201 (não bloqueia legítimo); `X-Forwarded-For` forjado **não** ignora o contador (throttler usa IP do socket).

### MÉDIO — CORS fail-closed em simulação
- **Antes (live):** `Origin: http://evil.example` → **refletido** (`origin:true`).
- **Fix:** `corsOptions()` — simulação autoriza apenas **origens LOCAIS** (`localhost:5173`/`127.0.0.1:5173`, `credentials:true`); `approved` sem allowlist continua bloqueando; `GROWTHOS_CORS_ORIGINS` tem precedência. Nunca wildcard/reflexo arbitrário.
- **Depois (live):** `evil.example`/`localhost:9999` → **sem header**; `localhost:5173`/`127.0.0.1:5173` → refletidos. `cors.e2e.test.ts` (4 cenários: sim/allowlist/approved±allowlist).

### Baixos
- **A — FK auditoria:** migration `013` adiciona `security_audit_events.actor_operator_id → operators(id) ON DELETE SET NULL` (determinístico: órfãos→NULL antes; **histórico sobrevive** à remoção; prova real de enforcement). Idempotente.
- **B — last_seen_at:** `touch(id)` amortizado (`last_seen_at < now()-1min`) chamado no `resolveSession`; impl pg + memory; teste de integração prova o update.
- **Revoke-all:** `revokeAllSessions(operatorId)` (pg + memory) + `AuthService.revokeAllSessions(email)` (audita `AUTH_LOGOUT`/`reason=revoke_all`) + CLI `npm run admin:revoke-sessions --workspace=@growthos/api <email>` (**sem endpoint HTTP**). Prova real: login 201 → revoke → `/auth/me` **401** → evento no banco.

### Regressão (pós-closure)
Build OK · typecheck OK · **core 59/59 · API 96/96 (12 files) · web 5/5 · Python 51/51** · migrations 001–013 idempotentes · smoke real completo (throttle 429 + `RATE_LIMIT_HIT` + CORS fail-closed + login→me→CSRF→logout→401 + revoke-all CLI→401).
`EXTERNAL ALERT DELIVERY: BLOCKED_EXTERNAL` mantido (sem serviço externo conectado). Verdict **CANDIDATE_DONE** (DONE reservado ao auditor independente).

## SECURITY HARDENING FINAL — fechamento dos resíduos antes do Final Verifier

### F-01 — Timing oracle no login (BAIXO → equalizado)
- **Antes:** inexistente ~12ms vs senha errada ~60ms (oráculo por tempo). **Depois:** verify Argon2id dummy (hash em memória, senha aleatória) para inexistente. Provado ao vivo (3 rodadas, janela limpa): média **70ms existente vs 63ms inexistente** (diferença ~7ms = ruído). Não é constant-time; é **equalização de timing**. Rate limit 5/min intacto (429s observados).

### F-07 — Comparação de API key timing-safe
- `crypto.timingSafeEqual` + falha segura em comprimento diferente. Provado: ausente 401 · correta 200 · errada 401 · comprimento diferente 401.

### F-02 — Email sem teto (audit metadata)
- `z.string().email().max(254)`. Provado: válido ≤254 → fluxo; >254 → 400; 5000 → 400; rejeitado NUNCA chega ao AuthService/auditoria.

### F-09 — Kill-switch no health público
- `/channels/health` público passa a expor **só saúde operacional** (projeção `publicStatus` — score/status/rejectionRate/reasons); `GET /channels/kill-switch` (shared) mantém o estado administrativo. Web `Health` type atualizado; testes e2e atualizados.

### F-11/F-14 — Higiene de resposta
- 429 → `{"message":"muitas requisições"}` (sem `ThrottlerException` no cliente) · `X-Powered-By` desabilitado. Provado ao vivo.

### F-03 — CORS ACAC sem ACAO
- Comportamento da lib `cors` (benigno; browser bloqueia sem ACAO). Verificado não-explorável → **documentado**, sem workaround frágil.

### F-10 — RBAC
- Não há RBAC além de `admin` único. Migration `014` (`CHECK (role='admin')`) + validação no `createOperator`. Documentado como fase atual.

### S28 — Dependency audit
- `npm audit` runtime: **0 CRITICAL, 2 HIGH** (`multer`/`@nestjs/platform-express`) — **não alcançáveis** (zero endpoints multipart; body JSON-only) e correção = major upgrade Nest → **BLOCKED_DECISION** (sem upgrade arbitrário). Dev: vitest (CRITICAL), vite (HIGH) — não embarcados.

### Topologia / trust proxy / multi-instance (F-04/F-05)
- `CURRENT: single-instance direct · trust proxy disabled · in-memory throttle acceptable`.
- `BEFORE PROXY/LB: proxy confiável (ranges/hops) + validar req.ip + storage compartilhado`.
- `BEFORE MULTI-INSTANCE: storage de rate limit compartilhado obrigatório`. **NÃO se declara MULTI_INSTANCE_SAFE.**

### Testes e regressão
- Novo `hardening.e2e.test.ts` (9 testes) + `app.e2e` atualizado (health sem killSwitch). Suíte API **105/105** · core 59/59 · web 5/5 · Python 51/51 · migrations 001–014 · bundle proof · secret scan · `git diff --check` limpo. `EXTERNAL ALERT DELIVERY: BLOCKED_EXTERNAL` mantido. Verdict **CANDIDATE_DONE** (DONE reservado ao Final Verifier).

## Convenções
- Todo artefato segue o contrato de saída dos documentos de estudo.
- Fail-closed: qualquer violação de conformidade interrompe o pipeline.
- Providers externos (WhatsApp, e-mail, agenda, Maps, CNPJ) são **mock** em simulation.
