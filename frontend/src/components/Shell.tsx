import React, { useEffect } from "react";
import type { Preferences, RouteId, User } from "../types";
import { LABELS, userInitials } from "../utils/format";
import { Icon } from "./Icons";

export function HeaderBar({
  user,
  searchQuery,
  onSearchChange,
  onBell,
  hasAlerts,
  onCycleLanguage,
  onGoSettings,
  onLogout,
}: {
  user: User;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onBell: () => void;
  hasAlerts: boolean;
  onCycleLanguage: () => void;
  onGoSettings: () => void;
  onLogout: () => void;
}) {
  const lang = (user.preferences?.language || "en").toUpperCase();
  return (
    <header className="sf-global">
      <button className="sf-waffle" title="FinanceTrace App Launcher">
        <span className="grid3">
          {Array.from({ length: 9 }).map((_, i) => (
            <i key={i} />
          ))}
        </span>
      </button>
      <div className="sf-brand">
        <b>FinanceTrace</b>
        <span>Personal Banking</span>
      </div>
      <div className="sf-search">
        <Icon name="search" />
        <input
          placeholder="Search transactions and categories…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <div className="sf-global__right">
        <button className="lang-pill" title="Switch language" onClick={onCycleLanguage}>
          <Icon name="globe" /> {lang}
        </button>
        <button className="icon-btn" title="Notifications" onClick={onBell}>
          <Icon name="bell" />
          {hasAlerts && <span className="dot" />}
        </button>
        <button className="icon-btn" title="Settings" onClick={onGoSettings}>
          <Icon name="settings" />
        </button>
        <button className="icon-btn" title="Sign out" onClick={onLogout}>
          <Icon name="logout" />
        </button>
        <div className="avatar" style={{ marginLeft: 4 }} title={user.full_name || user.email}>
          {userInitials(user.full_name, user.email)}
        </div>
      </div>
    </header>
  );
}

export function TopNav({
  route,
  go,
  language = "en",
}: {
  route: RouteId;
  go: (r: RouteId) => void;
  language?: Preferences["language"];
}) {
  const t = LABELS[language] || LABELS.en;
  const items: { id: RouteId; label: string; icon: string }[] = [
    { id: "dashboard", label: t.dashboard, icon: "dashboard" },
    { id: "transactions", label: t.transactions, icon: "transactions" },
    { id: "accounts", label: t.accounts, icon: "accounts" },
    { id: "budgets", label: t.budgets, icon: "budgets" },
    { id: "reports", label: t.reports, icon: "reports" },
    { id: "settings", label: t.settings, icon: "settings" },
  ];

  return (
    <nav className="sf-nav">
      <div className="sf-appname">
        <span className="sf-appicon">
          <Icon name="trendUp" />
        </span>
        <b>Personal Banking</b>
      </div>
      {items.map((n) => (
        <button
          key={n.id}
          className={"nav-item" + (route === n.id ? " active" : "")}
          onClick={() => go(n.id)}
        >
          <Icon name={n.icon} />
          <span>{n.label}</span>
        </button>
      ))}
    </nav>
  );
}

export function Badge({ label, color }: { label: string; color?: string }) {
  return (
    <span className="badge" style={{ background: "var(--surface-3)", color: "var(--ink-2)" }}>
      <span className="swatch" style={{ background: color || "var(--blue)" }} />
      {label}
    </span>
  );
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  width,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div
        className="modal"
        style={width ? { maxWidth: width } : undefined}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div
      className="overlay"
      style={{ background: "rgba(11,23,42,0.38)", placeItems: "stretch", padding: 0 }}
      onMouseDown={onClose}
    >
      <div className="drawer" onMouseDown={(e) => e.stopPropagation()}>
        <div className="drawer__head">
          <h3 style={{ fontSize: 17 }}>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <div className="drawer__body">{children}</div>
        {footer && <div className="drawer__foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Toast({ msg }: { msg: string }) {
  return (
    <div className="toast">
      <Icon name="checkCircle" />
      {msg}
    </div>
  );
}
