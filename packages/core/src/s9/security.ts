/** Utilidades de segurança (S9) — rate limiting e sanitização. */

/** Token bucket simples para rate limiting de endpoints/APIs. */
export class TokenBucket {
  private tokens: number;
  private lastRefillMs: number;

  constructor(
    private readonly rate: number, // tokens por segundo
    private readonly capacity: number,
    private readonly now: () => number = Date.now,
  ) {
    this.tokens = capacity;
    this.lastRefillMs = now();
  }

  tryConsume(n = 1): boolean {
    this.refill();
    if (this.tokens >= n) {
      this.tokens -= n;
      return true;
    }
    return false;
  }

  private refill(): void {
    const nowMs = this.now();
    const elapsed = (nowMs - this.lastRefillMs) / 1000;
    if (elapsed > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.rate);
      this.lastRefillMs = nowMs;
    }
  }
}

/** Sanitiza texto: remove caracteres de controle e limita tamanho. */
export function sanitizeText(input: string, maxLength = 2000): string {
  // eslint-disable-next-line no-control-regex
  const cleaned = input.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  return cleaned.slice(0, maxLength);
}
