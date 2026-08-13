/** Validação de workflows do builder (S3) — fail-closed antes de executar. */
import { z } from "zod";
import { ok, fail, type Result } from "../s0/result.js";
import type { Workflow } from "./types.js";
import { NODE_TYPES } from "./types.js";

const nodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(NODE_TYPES),
  config: z.record(z.string(), z.unknown()).optional(),
});

const edgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  on: z.string().optional(),
});

const workflowSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  name: z.string().min(1),
  entry: z.string().min(1),
  nodes: z.array(nodeSchema).min(1),
  edges: z.array(edgeSchema),
});

export function validateWorkflow(input: unknown): Result<Workflow, string[]> {
  const parsed = workflowSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
  }
  const wf = parsed.data;
  const errors: string[] = [];

  const ids = new Set(wf.nodes.map((n) => n.id));
  if (ids.size !== wf.nodes.length) errors.push("node ids duplicados");
  if (!ids.has(wf.entry)) errors.push(`entry '${wf.entry}' não existe`);

  for (const n of wf.nodes) {
    if (n.type === "send") {
      const c = n.config as { channel?: string; body?: string };
      if (c?.channel !== "whatsapp" && c?.channel !== "email") errors.push(`send '${n.id}': channel inválido`);
      if (!c?.body?.trim()) errors.push(`send '${n.id}': body vazio`);
    }
    if (n.type === "wait") {
      const c = n.config as { ms?: number };
      if (typeof c?.ms !== "number" || c.ms < 0) errors.push(`wait '${n.id}': ms inválido`);
    }
    if (n.type === "condition") {
      const c = n.config as { branches?: Record<string, string>; default?: string };
      for (const target of Object.values(c?.branches ?? {})) {
        if (!ids.has(target)) errors.push(`condition '${n.id}': branch aponta para '${target}' inexistente`);
      }
      if (c?.default && !ids.has(c.default)) errors.push(`condition '${n.id}': default inexistente`);
    }
  }

  for (const e of wf.edges) {
    if (!ids.has(e.from)) errors.push(`edge de '${e.from}': origem inexistente`);
    if (!ids.has(e.to)) errors.push(`edge para '${e.to}': destino inexistente`);
  }

  const hasTerminal = wf.nodes.some((n) => n.type === "end" || n.type === "optout" || n.type === "handoff");
  if (!hasTerminal) errors.push("workflow sem nó terminal (end/optout/handoff)");

  return errors.length ? fail(errors) : ok(wf);
}
