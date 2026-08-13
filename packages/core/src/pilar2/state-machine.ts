/** Motor de máquina de estados conversacional (S3). */
import type { ConversationEvent, Intent, NodeAction, StepResult, Workflow, WorkflowNode } from "./types.js";

const MAX_STEPS_PER_TURN = 50;

export class ConversationStateMachine {
  constructor(private readonly wf: Workflow) {}

  private edgesFrom(id: string, intent?: Intent): string | null {
    const candidates = this.wf.edges.filter((e) => e.from === id);
    if (intent) {
      const match = candidates.find((e) => e.on === intent);
      if (match) return match.to;
    }
    const plain = candidates.find((e) => !e.on);
    return plain?.to ?? candidates[0]?.to ?? null;
  }

  /** Processa um evento (start ou reply) e devolve as ações a executar. */
  step(event: ConversationEvent, current: string | null): StepResult {
    const actions: NodeAction[] = [];
    let nodeId: string | null = event.type === "start" ? this.wf.entry : current;
    if (!nodeId) return { actions, nextNode: null, terminal: true };

    const visited = new Set<string>();
    let iterations = 0;

    while (nodeId && !visited.has(nodeId) && iterations < MAX_STEPS_PER_TURN) {
      visited.add(nodeId);
      iterations++;
      const node = this.wf.nodes.find((n) => n.id === nodeId);
      if (!node) return { actions, nextNode: null, terminal: true };

      const consumed = this.consume(node, event, actions);
      if (consumed.terminal) return { actions, nextNode: null, terminal: true };
      if (consumed.pause) return { actions, nextNode: consumed.next ?? nodeId, terminal: false };

      nodeId = consumed.next ?? this.edgesFrom(nodeId, event.intent);
    }

    return { actions, nextNode: nodeId, terminal: nodeId === null };
  }

  private consume(
    node: WorkflowNode,
    event: ConversationEvent,
    actions: NodeAction[],
  ): { terminal: boolean; pause: boolean; next?: string | null } {
    switch (node.type) {
      case "send": {
        const c = node.config as { channel: "whatsapp" | "email"; body: string };
        actions.push({ type: "send", nodeId: node.id, channel: c.channel, body: c.body });
        // send pausa o turno: aguarda a próxima resposta do lead.
        // O próximo nó a avaliar é o alvo da aresta (ex.: condition).
        return { terminal: false, pause: true, next: this.edgesFrom(node.id) };
      }
      case "wait": {
        const c = node.config as { ms: number };
        actions.push({ type: "wait", nodeId: node.id, ms: c.ms });
        return { terminal: false, pause: true, next: this.edgesFrom(node.id) };
      }
      case "condition": {
        const c = node.config as { branches?: Record<string, string>; default?: string };
        const intent: Intent | undefined = event.intent;
        const target = (intent && c.branches?.[intent]) || c.default || null;
        return { terminal: false, pause: false, next: target };
      }
      case "handoff": {
        const c = node.config as { reason?: string };
        actions.push({ type: "handoff", nodeId: node.id, reason: c?.reason ?? "nao_informado" });
        return { terminal: true, pause: false };
      }
      case "optout":
        actions.push({ type: "optout", nodeId: node.id });
        return { terminal: true, pause: false };
      case "end":
        return { terminal: true, pause: false };
      default:
        actions.push({ type: "noop", nodeId: node.id });
        return { terminal: false, pause: false };
    }
  }
}
