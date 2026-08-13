# Growth OS — Runbook Operacional

**Modo:** design/simulação · **Regra de parada:** nenhuma ação real sem `GROWTHOS_MODE=approved` e autorização explícita.

## 1. Subir o ambiente

```bash
docker compose up -d          # postgres+pgvector, redis, temporal, temporal-ui
cp .env.example .env          # ajuste conforme necessário
npm install
npm run build                 # compila @growthos/core
npm test                      # testes TS (core)
docker build -t growthos-workers workers/python
docker run --rm -v "$PWD/workers/python:/app" growthos-workers   # testes Python
```

## 2. Validar o pipeline (prova de execução)

```bash
# Relatório E2E simulado (225+ leads → funil → ARR)
docker run --rm -v "$PWD/workers/python:/app" -w /app python:3.12-slim \
  sh -c "pip install -q pytest && python -m src.simulation.e2e"

# Teste de carga (sequenciador + kill-switch)
node scripts/load-test.mjs
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

## 4. Kill-switch (emergência)

- **Automático:** rejeição > 5% ou score < 60 → campanha **pausa sozinha** (fail-closed).
- **Manual:** `KillSwitch.pause("motivo")` no serviço de campanhas.
- **Retomada:** sempre manual e deliberada (`resume()`), nunca automática.

## 5. Conformidade (não negociável)

- `SuppressionList` (opt-out) é consultada **antes** de cada envio.
- Opt-out processado com prioridade; nunca reenviar.
- Sem dados sensíveis; minimização; auditoria por turno.
- Envios só em janela comercial local; volume controlado por warm-up.

## 6. Logs e observabilidade

- Logs estruturados (JSON) em `createLogger`.
- Eventos de funil alimentam `funnelMetrics` → ARR projetado.
- Alertas (`evaluateAlerts`) escalam info → warning → critical.
