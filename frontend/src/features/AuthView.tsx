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
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
          <img
            src="/logo.svg"
            alt="FinanceTrace"
            style={{ width: 60, height: 60, borderRadius: 12, display: "block" }}
          />
        </div>

        <div className="seg" style={{ marginBottom: 22 }}>
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

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
                  {DICEBEAR_STYLES.slice(0, 6).map((s) => {
                    const uri = buildDiceBearDataUri({
                      styleId: s.id,
                      seed: previewSeed,
                      bg: "0352ff",
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
                          padding: 6,
                          borderRadius: "var(--r-sm)",
                          border: active ? "2px solid var(--blue-600)" : "1px solid var(--border)",
                          background: "var(--surface-2)",
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        <img
                          src={uri}
                          alt={s.label}
                          style={{ width: 38, height: 38, borderRadius: "50%", display: "block" }}
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
          <button
            className="btn btn--primary"
            type="submit"
            disabled={busy}
            style={{ width: "100%", maxWidth: 340, margin: "8px auto 0", height: 46 }}
          >
            {busy ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <div
          style={{
            marginTop: 22,
            paddingTop: 16,
            borderTop: "1px solid var(--line)",
            textAlign: "center",
          }}
        >
          <button
            type="button"
            className="btn btn--ghost"
            style={{ width: "100%", maxWidth: 340 }}
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
