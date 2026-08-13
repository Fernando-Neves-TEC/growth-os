/** Gera a referência TS do channelHealth (packages/core) para a conformidade Python.
 *  Uso (após build do core): node scripts/health-reference.mjs > /tmp/ts-ref.json
 *  A validação cruzada real em CI compara a saída do Python com este arquivo. */
import { channelHealth } from "@growthos/core";

const MATRIX = [
  { delivered: 0, sent: 0, rejected: 0, readRate: 0, replyRate: 0, channelMin: 60, rejectionRateMax: 5 },
  { delivered: 100, sent: 100, rejected: 0, readRate: 70, replyRate: 40, channelMin: 60, rejectionRateMax: 5 },
  { delivered: 90, sent: 100, rejected: 12, readRate: 60, replyRate: 20, channelMin: 60, rejectionRateMax: 5 },
  { delivered: 10, sent: 100, rejected: 0, readRate: 10, replyRate: 5, channelMin: 60, rejectionRateMax: 5 },
  { delivered: 100, sent: 100, rejected: 0, readRate: 50, replyRate: 10, channelMin: 60, rejectionRateMax: 5 },
  { delivered: 100, sent: 100, rejected: 0, readRate: 100, replyRate: 500, channelMin: 60, rejectionRateMax: 5 },
];

const out = MATRIX.map((m) => ({ ...m, result: channelHealth(m) }));
process.stdout.write(JSON.stringify(out, null, 2));
