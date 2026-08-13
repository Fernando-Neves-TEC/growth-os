/** Helper de teste: monta o AppModule com stores em memória (incluindo auth), cria operador e loga. */
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { AppModule } from "../src/app.module.js";
import { configureApp } from "../src/app.setup.js";
import { AuthService } from "../src/auth/auth.service.js";
import {
  MemoryOperatorsStore,
  MemorySecurityAuditStore,
  MemorySessionStore,
  OPERATORS_STORE,
  SECURITY_AUDIT_STORE,
  SESSION_STORE,
  type SecurityAuditStore,
  type SessionStore,
} from "../src/auth/stores.js";
import { WORKFLOW_LAUNCHER } from "../src/campaigns/workflow-launcher.js";
import {
  CAMPAIGN_STORE,
  COUNTER_STORE,
  EVENT_STORE,
  KILL_SWITCH_STORE,
  LEAD_STORE,
  MemoryCampaignStore,
  MemoryCounterStore,
  MemoryEventStore,
  MemoryKillSwitchStore,
  MemoryLeadStore,
  MemorySuppressionStore,
  SUPPRESSION_STORE,
} from "../src/persistence/stores.js";

export const TEST_ADMIN_EMAIL = "admin@test.local";
export const TEST_ADMIN_PASSWORD = "SenhaTeste123!";

export interface AuthedTest {
  app: INestApplication;
  agent: ReturnType<typeof request.agent>;
  csrf: string;
  audit: SecurityAuditStore;
  sessions: SessionStore;
}

export async function createAuthedTest(extraEnv: Record<string, string> = {}): Promise<AuthedTest> {
  process.env.GROWTHOS_MODE = "simulation";
  process.env.GROWTHOS_RATE_LIMIT_MAX = "100000";
  process.env.GROWTHOS_BODY_LIMIT = "4kb";
  for (const [k, v] of Object.entries(extraEnv)) process.env[k] = v;

  const counterStore = new MemoryCounterStore();
  const suppressionStore = new MemorySuppressionStore();
  const operators = new MemoryOperatorsStore();
  const sessions = new MemorySessionStore();
  const audit = new MemorySecurityAuditStore();

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(KILL_SWITCH_STORE).useValue(new MemoryKillSwitchStore())
    .overrideProvider(SUPPRESSION_STORE).useValue(suppressionStore)
    .overrideProvider(CAMPAIGN_STORE).useValue(new MemoryCampaignStore())
    .overrideProvider(COUNTER_STORE).useValue(counterStore)
    .overrideProvider(EVENT_STORE).useValue(new MemoryEventStore({ counters: counterStore, suppression: suppressionStore }))
    .overrideProvider(LEAD_STORE).useValue(new MemoryLeadStore())
    .overrideProvider(OPERATORS_STORE).useValue(operators)
    .overrideProvider(SESSION_STORE).useValue(sessions)
    .overrideProvider(SECURITY_AUDIT_STORE).useValue(audit)
    .overrideProvider(WORKFLOW_LAUNCHER).useValue({ launch: async () => ({ workflowId: "fake" }) })
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();

  const authService = moduleRef.get(AuthService);
  await authService.createOperator(TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);

  const agent = request.agent(app.getHttpServer());
  const login = await agent
    .post("/auth/login")
    .send({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD })
    .expect(201);

  return { app, agent, csrf: login.body.csrfToken, audit, sessions };
}
