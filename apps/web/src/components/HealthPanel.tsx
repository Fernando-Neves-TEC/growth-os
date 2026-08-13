import { useCallback, useEffect, useState } from "react";
import { api, type FunnelMetrics, type Health } from "../api";

export function HealthPanel() {
  const [health, setHealth] = useState<Health | null>(null);
  const [ks, setKs] = useState<{ paused: boolean; reason: string | null }>({ paused: false, reason: null });
  const [metrics, setMetrics] = useState<FunnelMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [h, k, m] = await Promise.all([api.health(), api.killSwitch(), api.metrics()]);
      setHealth(h);
      setKs(k);
      setMetrics(m);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 5000);
    return () => clearInterval(t);
  }, [refresh]);

  if (loading && !health) return <p>carregando…</p>;
  if (error) return <p>⚠️ erro ao consultar a API: {error}</p>;

  return (
    <section>
      <h2>Saúde do canal</h2>
      <p>
        Status: <strong>{health?.status}</strong> · score {health?.score ?? "n/d"}/100 · rejeição {health?.rejectionRate}%
        {health?.killSwitch ? " ⛔ kill-switch ATIVO" : ""}
      </p>
      {health?.reasons?.map((r) => <p key={r}>· {r}</p>)}
      <p>
        Kill-switch: {ks.paused ? "pausado" : "ativo"} {ks.reason ? `(${ks.reason})` : ""}{" "}
        <button onClick={() => (ks.paused ? void api.resume().then(refresh) : void api.pause().then(refresh))}>
          {ks.paused ? "Retomar" : "Pausar"}
        </button>
      </p>
      <h3>Funil / ARR projetado</h3>
      {metrics && (
        <>
          <ul>
            <li>Enviados: {metrics.counters.sent} · Lidos: {metrics.counters.read} · Respondidos: {metrics.counters.replied}</li>
            <li>Qualificados: {metrics.counters.qualified} · Agendados: {metrics.counters.scheduled} · Fechados: {metrics.counters.closed}</li>
            <li>
              ARR projetado: <strong>R$ {metrics.arr_projected.toLocaleString("pt-BR")}</strong>{" "}
              <small>
                (ticket {metrics.arr_params.ticketMonthly} · agendamento {metrics.arr_params.scheduleRate}% · fechamento{" "}
                {metrics.arr_params.closeRate}%)
              </small>
            </li>
          </ul>
        </>
      )}
    </section>
  );
}
