import { describe, expect, it } from "vitest";
import { sanitizeText, TokenBucket } from "../../src/s9/security.js";

describe("security (S9)", () => {
  it("token bucket respeita capacidade", () => {
    let t = 0;
    const bucket = new TokenBucket(1, 3, () => t);
    expect(bucket.tryConsume()).toBe(true);
    expect(bucket.tryConsume()).toBe(true);
    expect(bucket.tryConsume()).toBe(true);
    expect(bucket.tryConsume()).toBe(false); // vazio
    t += 1000; // 1s → refill de 1 token
    expect(bucket.tryConsume()).toBe(true);
  });

  it("sanitiza caracteres de controle e limita tamanho", () => {
    const s = sanitizeText("a\u0000b\u001Fc   d", 5);
    expect(s.includes("\u0000")).toBe(false);
    expect(s.length).toBeLessThanOrEqual(5);
  });
});
