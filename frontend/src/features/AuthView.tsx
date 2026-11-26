import React, { useState } from "react";
import { api } from "../api/client";
import { Icon } from "../components/Icons";
import type { User } from "../types";

export function AuthView({ onAuth }: { onAuth: (u: User) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("daniel.brooks@gmail.com");
  const [password, setPassword] = useState("Password123!");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res =
        mode === "login"
          ? await api.login(email, password)
          : await api.register(email, password, fullName || "New User", username || undefined);
      onAuth(res.user);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  const handleDemo = async () => {
    setErr(null);
    setBusy(true);
    try {
      const res = await api.demoLogin();
      onAuth(res.user);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Demo login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <span className="sf-head-icon">
            <Icon name="trendUp" />
          </span>
          <div>
            <div style={{ fontSize: 19, fontWeight: 700 }}>FinanceTrace</div>
            <div className="muted" style={{ fontSize: 12.5 }}>
              Self-Hosted Personal Banking
            </div>
          </div>
        </div>

        <div className="seg" style={{ marginBottom: 20 }}>
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => {
              setMode("login");
              setErr(null);
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={mode === "register" ? "active" : ""}
            onClick={() => {
              setMode("register");
              setErr(null);
            }}
          >
            Create Account
          </button>
        </div>

        {err && <div className="error-banner">{err}</div>}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {mode === "register" && (
            <>
              <div className="field">
                <label htmlFor="fullName">Full name</label>
                <input
                  id="fullName"
                  className="input"
                  placeholder="Daniel Brooks"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="username">Username (optional)</label>
                <input
                  id="username"
                  className="input"
                  placeholder="danielbrooks"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </>
          )}
          <div className="field">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <button className="btn btn--primary" type="submit" disabled={busy} style={{ marginTop: 6 }}>
            {busy ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <div
          style={{
            marginTop: 18,
            paddingTop: 16,
            borderTop: "1px solid var(--line)",
            textAlign: "center",
          }}
        >
          <button
            type="button"
            className="btn btn--ghost"
            style={{ width: "100%" }}
            onClick={handleDemo}
            disabled={busy}
          >
            <Icon name="wallet" /> Explore Demo Workspace (Daniel Brooks)
          </button>
        </div>
      </div>
    </div>
  );
}
