/** Testes do cliente HTTP do dashboard (S2 — nunca envia API key administrativa; usa sessão + CSRF). */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, setCsrfToken } from "./api.js";

describe("api client (dashboard)", () => {
  const origFetch = globalThis.fetch;
  const fetchMock = vi.fn();

  beforeEach(() => {
    setCsrfToken("");
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
    vi.clearAllMocks();
  });

  it("S2: NUNCA envia X-Api-Key (credencial administrativa não chega ao navegador)", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: 1 }) } as Response);
    await api.metrics();
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>)["X-Api-Key"]).toBeUndefined();
    expect(String((init as RequestInit).credentials)).toBe("include");
  });

  it("S2: mutação autenticada envia X-CSRF-Token quando a sessão fornece o token", async () => {
    setCsrfToken("csrf-abc");
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: 1 }) } as Response);
    await api.pause();
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>)["X-CSRF-Token"]).toBe("csrf-abc");
  });

  it("S2: GET não envia CSRF", async () => {
    setCsrfToken("csrf-abc");
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: 1 }) } as Response);
    await api.metrics();
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>)["X-CSRF-Token"]).toBeUndefined();
  });

  it("S2: auth.me retorna null em 401 (tela de login)", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ statusCode: 401 }) } as Response);
    expect(await api.auth.me()).toBeNull();
  });

  it("propaga erro estruturado em resposta não-ok", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ message: "erro" }) } as Response);
    await expect(api.health()).rejects.toThrow();
  });
});
