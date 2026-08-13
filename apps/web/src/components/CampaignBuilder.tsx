import { useCallback, useEffect, useState } from "react";
import { api, type Campaign } from "../api";

const DEFAULT_WORKFLOW = JSON.stringify(
  {
    id: "wf-web",
    version: 1,
    name: "funil web",
    entry: "s1",
    nodes: [
      { id: "s1", type: "send", config: { channel: "whatsapp", body: "Olá!" } },
      { id: "c1", type: "condition", config: { branches: { interest: "s2", optout: "out" }, default: "out" } },
      { id: "s2", type: "send", config: { channel: "email", body: "Detalhes." } },
      { id: "out", type: "optout" },
    ],
    edges: [
      { from: "s1", to: "c1" },
      { from: "c1", to: "s2", on: "interest" },
      { from: "c1", to: "out", on: "optout" },
    ],
  },
  null,
  2,
);

export function CampaignBuilder() {
  const [json, setJson] = useState(DEFAULT_WORKFLOW);
  const [name, setName] = useState("campanha web");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [output, setOutput] = useState<string>("");

  const refresh = useCallback(async () => {
    setCampaigns(await api.listCampaigns());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = async () => {
    try {
      const workflow = JSON.parse(json);
      const c = await api.createCampaign(name, workflow);
      setOutput(`✅ campanha criada: ${c.id}`);
      await refresh();
    } catch (e) {
      setOutput(`❌ ${(e as Error).message}`);
    }
  };

  const simulate = async (id: string) => {
    try {
      const r = await api.simulateTurn(id, { type: "start" }, null);
      setOutput(JSON.stringify(r, null, 2));
    } catch (e) {
      setOutput(`❌ ${(e as Error).message}`);
    }
  };

  return (
    <section>
      <h2>Builder de campanha</h2>
      <label>
        Nome <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <textarea value={json} onChange={(e) => setJson(e.target.value)} rows={18} style={{ width: "100%", fontFamily: "monospace" }} />
      <div>
        <button onClick={() => void create()}>Criar campanha</button>
      </div>
      <h3>Campanhas</h3>
      <ul>
        {campaigns.map((c) => (
          <li key={c.id}>
            {c.name} ({c.status}) <button onClick={() => void simulate(c.id)}>Simular turno</button>
          </li>
        ))}
      </ul>
      <pre>{output}</pre>
    </section>
  );
}
