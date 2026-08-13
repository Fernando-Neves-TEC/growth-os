/** Erros tipados do domínio — base para comportamento fail-closed. */

export class GrowthError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class ConfigValidationError extends GrowthError {
  constructor(message: string) {
    super(message, "CONFIG_INVALID");
  }
}

export class ComplianceError extends GrowthError {
  constructor(message: string) {
    super(message, "COMPLIANCE_VIOLATION");
  }
}

export class ChannelUnhealthyError extends GrowthError {
  constructor(message: string) {
    super(message, "CHANNEL_UNHEALTHY");
  }
}

export class AgentBlockedError extends GrowthError {
  constructor(message: string) {
    super(message, "AGENT_BLOCKED");
  }
}
