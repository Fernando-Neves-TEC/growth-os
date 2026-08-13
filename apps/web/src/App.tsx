import { useEffect, useState } from "react";
import { api, setCsrfToken, type Operator } from "./api";
import { CampaignBuilder } from "./components/CampaignBuilder";
import { HealthPanel } from "./components/HealthPanel";
import { LeadsPanel } from "./components/LeadsPanel";

type AuthState =
  | { status: "loading" }
  | { status: "anon" }
  | { status: "ok"; operator: Operator };

export function App() {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });
  const [tab, setTab] = useState<"dashboard" | "builder" | "leads">("dashboard");

  useEffect(() => {
    api.auth.me().then((m) => {
      if (m) {
        setCsrfToken(m.csrfToken);
        setAuth({ status: "ok", operator: m.operator });
      } else {
        setAuth({ status: "anon" });
      }
    });
  }, []);

  async function onLogin(email: string, password: string): Promise<void> {
    const r = await api.auth.login(email, password);
    setCsrfToken(r.csrfToken);
    setAuth({ status: "ok", operator: r.operator });
  }

  async function onLogout(): Promise<void> {
    try {
      await api.auth.logout();
    } catch {
      // sessão já inválida — segue para a tela de login
    }
    setCsrfToken("");
    setAuth({ status: "anon" });
  }

  if (auth.status === "loading") {
    return <main style={{ maxWidth: 900, margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>Carregando…</main>;
  }

  if (auth.status === "anon") {
    return <Login onLogin={onLogin} />;
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Growth OS — Fase 3 (design/simulação)</h1>
        <div>
          <span style={{ marginRight: 8 }}>{auth.operator.email}</span>
          <button onClick={onLogout}>Sair</button>
        </div>
      </div>
      <nav>
        <button onClick={() => setTab("dashboard")}>Dashboard</button>
        <button onClick={() => setTab("builder")}>Builder</button>
        <button onClick={() => setTab("leads")}>Leads & Suppression</button>
      </nav>
      {tab === "dashboard" ? <HealthPanel /> : tab === "builder" ? <CampaignBuilder /> : <LeadsPanel />}
    </main>
  );
}

function Login({ onLogin }: { onLogin: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onLogin(email, password);
    } catch (err) {
      setError(err instanceof Error ? "credenciais inválidas" : "erro ao entrar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 360, margin: "48px auto", fontFamily: "system-ui, sans-serif" }}>
      <h1>Growth OS</h1>
      <form onSubmit={submit}>
        <div style={{ marginBottom: 8 }}>
          <label>E-mail</label>
          <br />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
        </div>
        <div style={{ marginBottom: 8 }}>
          <label>Senha</label>
          <br />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </div>
        {error && <p style={{ color: "red" }}>{error}</p>}
        <button type="submit" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
      </form>
    </main>
  );
}
