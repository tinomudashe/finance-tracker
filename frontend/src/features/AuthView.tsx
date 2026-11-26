import React, { useState } from "react";
import { api } from "../api/client";
import { buildDiceBearDataUri, DICEBEAR_STYLES } from "../components/Avatar";
import { Icon } from "../components/Icons";
import type { User } from "../types";

export function AuthView({ onAuth }: { onAuth: (u: User) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("daniel.brooks@gmail.com");
  const [password, setPassword] = useState("Password123!");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarStyle, setAvatarStyle] = useState("notionists");
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
          : await api.register(
              email,
              password,
              fullName || "New User",
              username || undefined,
              avatarStyle,
              fullName || username || email
            );
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

  const previewSeed = fullName || username || email || "FinanceTrace";

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
          <span className="sf-head-icon">
            <Icon name="accounts" />
          </span>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "var(--font-display)" }}>
              FinanceTrace
            </div>
            <div className="muted" style={{ fontSize: 12.5 }}>
              Private Institutional & Personal Ledger
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
              <div className="field">
                <label>Choose Avatar Style (DiceBear)</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
                  {DICEBEAR_STYLES.slice(0, 6).map((s) => {
                    const uri = buildDiceBearDataUri({
                      styleId: s.id,
                      seed: previewSeed,
                      bg: "0052ff",
                      size: 72,
                    });
                    const active = avatarStyle === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        title={s.label}
                        onClick={() => setAvatarStyle(s.id)}
                        style={{
                          padding: 5,
                          borderRadius: "var(--r-sm)",
                          border: active ? "2px solid var(--blue)" : "1px solid var(--border)",
                          background: "var(--surface-2)",
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        <img
                          src={uri}
                          alt={s.label}
                          style={{ width: 36, height: 36, borderRadius: 6, display: "block" }}
                        />
                      </button>
                    );
                  })}
                </div>
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
            <Icon name="check" /> {busy ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
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
