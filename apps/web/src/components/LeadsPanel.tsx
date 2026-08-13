import { useCallback, useEffect, useState } from "react";
import { api, type PipelineRun, type SuppressionEntry } from "../api";

function useAsync<T>(fn: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fn());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [fn]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { data, loading, error, refresh };
}

export function LeadsPanel() {
  const leads = useAsync(() => api.leads.list(20));
  const runs = useAsync(() => api.leads.runs(10));
  const suppression = useAsync(() => api.suppression.list());
  const [cnpj, setCnpj] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const addSuppression = async () => {
    try {
      await api.suppression.add(cnpj);
      setCnpj("");
      setMsg("adicionado à suppression");
      await suppression.refresh();
    } catch (e) {
      setMsg(`erro: ${(e as Error).message}`);
    }
  };

  const status = (s: { loading: boolean; error: string | null }) =>
    s.loading ? "carregando…" : s.error ? `erro: ${s.error}` : null;

  return (
    <section>
      <h2>Leads (pipeline persistido)</h2>
      {status(leads) && <p>⚠️ {status(leads)}</p>}
      {leads.data && (
        <>
          <p>
            Total: <strong>{leads.data.total}</strong>
          </p>
          <ul>
            {leads.data.items.slice(0, 10).map((l) => (
              <li key={l.cnpj}>
                {l.companyName} · {l.state} · ICP {l.icpFitScore} · {l.source}
              </li>
            ))}
          </ul>
        </>
      )}

      <h3>Runs do pipeline (rastreabilidade)</h3>
      {status(runs) && <p>⚠️ {status(runs)}</p>}
      {runs.data && (
        <ul>
          {(runs.data as PipelineRun[]).slice(0, 5).map((r) => (
            <li key={r.runId}>
              {r.runId.slice(0, 12)}… · {r.region} · coletados {r.collected} · qualificados {r.qualified}
            </li>
          ))}
        </ul>
      )}

      <h3>Suppression (opt-out durável)</h3>
      {status(suppression) && <p>⚠️ {status(suppression)}</p>}
      <div>
        <input value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="CNPJ" />
        <button onClick={() => void addSuppression()}>Adicionar à suppression</button>
        {msg && <p>{msg}</p>}
      </div>
      {suppression.data && (
        <ul>
          {(suppression.data as SuppressionEntry[]).slice(0, 10).map((s) => (
            <li key={s.cnpj}>
              {s.cnpj} {s.reason ? `(${s.reason})` : ""}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
