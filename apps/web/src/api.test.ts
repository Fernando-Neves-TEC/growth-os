/** Testes do cliente HTTP do dashboard (H7 — API key não quebra o front). */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, setApiKey } from "./api.js";

describe("api client (dashboard)", () => {
  const origFetch = globalThis.fetch;
  const fetchMock = vi.fn();

  beforeEach(() => {
    setApiKey("");
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
    vi.clearAllMocks();
  });

  it("envia X-Api-Key quando a chave está configurada (H7)", async () => {
    setApiKey("secret-key");
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: 1 }) } as Response);
    await api.metrics();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/metrics/funnel");
    expect((init.headers as Record<string, string>)["X-Api-Key"]).toBe("secret-key");
  });

  it("não envia header sem chave", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: 1 }) } as Response);
    await api.metrics();
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>)["X-Api-Key"]).toBeUndefined();
  });

  it("propaga erro estruturado em resposta não-ok", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ message: "api key inválida" }) } as Response);
    await expect(api.health()).rejects.toThrow();
  });
});
