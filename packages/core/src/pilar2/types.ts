/** Tipos do Pilar 2 — builder de fluxos e máquina de estados. */

export const NODE_TYPES = ["send", "condition", "wait", "handoff", "optout", "end"] as const;
export type NodeType = (typeof NODE_TYPES)[number];

export const CHANNELS = ["whatsapp", "email"] as const;
export type Channel = (typeof CHANNELS)[number];

export const INTENTS = ["interest", "objection", "no_interest", "optout", "schedule", "human", "none"] as const;
export type Intent = (typeof INTENTS)[number];

export interface SendConfig {
  channel: Channel;
  body: string;
}

export interface WaitConfig {
  ms: number;
}

export interface ConditionConfig {
  /** mapa intenção -> próximo nodeId */
  branches: Partial<Record<Intent, string>>;
  default?: string;
}

export interface HandoffConfig {
  reason: string;
}

export interface WorkflowNode {
  id: string;
  type: NodeType;
  config?: Record<string, unknown>;
}

export interface WorkflowEdge {
  from: string;
  to: string;
  /** rótulo opcional (intenção) para edges de condition */
  on?: string;
}

export interface Workflow {
  id: string;
  version: number;
  name: string;
  entry: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export type WorkflowEventType = "start" | "reply";

export interface ConversationEvent {
  type: WorkflowEventType;
  intent?: Intent;
}

export type NodeAction =
  | { type: "send"; nodeId: string; channel: Channel; body: string }
  | { type: "wait"; nodeId: string; ms: number }
  | { type: "handoff"; nodeId: string; reason: string }
  | { type: "optout"; nodeId: string }
  | { type: "noop"; nodeId: string };

export interface StepResult {
  actions: NodeAction[];
  nextNode: string | null;
  terminal: boolean;
}
