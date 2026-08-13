import { z } from "zod";
import { ConfigValidationError } from "./errors.js";

/** Modos de operação. `approved` é o único que permite ação externa real — nunca setado por padrão. */
export const MODES = ["design", "simulation", "approved"] as const;
export type GrowthMode = (typeof MODES)[number];

const int = (v: string | undefined, d: number) => {
  const n = Number(v ?? d);
  return Number.isFinite(n) ? Math.trunc(n) : d;
};

const float = (v: string | undefined, d: number) => {
  const n = Number(v ?? d);
  return Number.isFinite(n) ? n : d;
};

const envSchema = z.object({
  mode: z.enum(MODES).default("simulation"),
  leadMaxVolumePerDay: z.number().int().min(1).max(500).default(100),
  icpCnaeAllowlist: z.array(z.string()).default(["6911701", "8610101", "7020400"]),
  icpRegionAllowlist: z.array(z.string()).default(["SP", "RJ", "MG"]),
  icpMinCapital: z.number().min(0).default(50000),
  sequencerJitterMinMs: z.number().min(0).default(15000),
  sequencerJitterMaxMs: z.number().min(0).default(45000),
  sequencerWarmupDay1: z.number().min(1).default(10),
  sequencerWarmupStep: z.number().min(0).default(5),
  sequencerWarmupCeiling: z.number().min(1).default(100),
  sequencerBusinessHoursStart: z.number().min(0).max(23).default(9),
  sequencerBusinessHoursEnd: z.number().min(0).max(24).default(18),
  sequencerMaxObjectionLoops: z.number().int().min(1).max(5).default(2),
  agentProvider: z.string().default("mock"),
  agentMaxMessageChars: z.number().int().min(50).default(250),
  agentQualifyThreshold: z.number().min(0).max(100).default(70),
  agentSanityBlocklist: z.array(z.string()).default(["garantido", "resultado certo", "aprovação garantida", "te garanto"]),
  agentMaxSanityBlocks: z.number().int().min(1).max(5).default(2),
  healthChannelMin: z.number().min(0).max(100).default(60),
  healthRejectionRateMax: z.number().min(0).max(100).default(5),
  calendarProvider: z.string().default("mock"),
  calendarBusinessHoursStart: z.number().min(0).max(23).default(9),
  calendarBusinessHoursEnd: z.number().min(0).max(24).default(18),
  arrScheduleRate: z.number().min(0).max(100).default(55),
  arrCloseRate: z.number().min(0).max(100).default(20),
  arrTicketMonthly: z.number().min(0).default(1500),
});

export type GrowthConfig = z.infer<typeof envSchema>;

/**
 * Carrega e valida a configuração a partir do ambiente.
 * Lança `ConfigValidationError` em valores inválidos — comportamento fail-closed.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): GrowthConfig {
  const parsed = envSchema.safeParse({
    mode: env.GROWTHOS_MODE,
    leadMaxVolumePerDay: int(env.LEAD_MAX_VOLUME_PER_DAY, 100),
    icpCnaeAllowlist: env.ICP_CNAE_ALLOWLIST?.split(",").map((s) => s.trim()).filter(Boolean) ?? undefined,
    icpRegionAllowlist: env.ICP_REGION_ALLOWLIST?.split(",").map((s) => s.trim()).filter(Boolean) ?? undefined,
    icpMinCapital: float(env.ICP_MIN_CAPITAL, 50000),
    sequencerJitterMinMs: int(env.SEQUENCER_JITTER_MIN_MS, 15000),
    sequencerJitterMaxMs: int(env.SEQUENCER_JITTER_MAX_MS, 45000),
    sequencerWarmupDay1: int(env.SEQUENCER_WARMUP_DAY1, 10),
    sequencerWarmupStep: int(env.SEQUENCER_WARMUP_STEP, 5),
    sequencerWarmupCeiling: int(env.SEQUENCER_WARMUP_CEILING, 100),
    sequencerBusinessHoursStart: int(env.SEQUENCER_BUSINESS_HOURS_START, 9),
    sequencerBusinessHoursEnd: int(env.SEQUENCER_BUSINESS_HOURS_END, 18),
    sequencerMaxObjectionLoops: int(env.SEQUENCER_MAX_OBJECTION_LOOPS, 2),
    agentProvider: env.AGENT_PROVIDER ?? "mock",
    agentMaxMessageChars: int(env.AGENT_MAX_MESSAGE_CHARS, 250),
    agentQualifyThreshold: float(env.AGENT_QUALIFY_THRESHOLD, 70),
    agentSanityBlocklist: env.AGENT_SANITY_BLOCKLIST?.split(",").map((s) => s.trim()).filter(Boolean) ?? undefined,
    agentMaxSanityBlocks: int(env.AGENT_MAX_SANITY_BLOCKS, 2),
    healthChannelMin: float(env.HEALTH_CHANNEL_MIN, 60),
    healthRejectionRateMax: float(env.HEALTH_REJECTION_RATE_MAX, 5),
    arrScheduleRate: float(env.ARR_SCHEDULE_RATE, 55),
    arrCloseRate: float(env.ARR_CLOSE_RATE, 20),
    arrTicketMonthly: float(env.ARR_TICKET_MONTHLY, 1500),
    calendarProvider: env.CALENDAR_PROVIDER ?? "mock",
    calendarBusinessHoursStart: int(env.CALENDAR_BUSINESS_HOURS_START, 9),
    calendarBusinessHoursEnd: int(env.CALENDAR_BUSINESS_HOURS_END, 18),
  });

  if (!parsed.success) {
    throw new ConfigValidationError(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  }
  return parsed.data;
}
