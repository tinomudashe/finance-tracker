import React from "react";
import { Dialog } from "@base-ui/react/dialog";
import { motion } from "motion/react";
import type { Preferences, RouteId, User } from "../types";
import { LABELS } from "../utils/format";
import { UserAvatar } from "./Avatar";
import { LanguageDropdown } from "./BaseControls";
import { Icon } from "./Icons";
import { MotionTooltip } from "./MotionPatterns";

export function HeaderBar({
  user,
  searchQuery,
  onSearchChange,
  onBell,
  hasAlerts,
  onSelectLanguage,
  onGoHome,
  onGoSettings,
  onLogout,
}: {
  user: User;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onBell: () => void;
  hasAlerts: boolean;
  onSelectLanguage: (lang: Preferences["language"]) => void;
  onGoHome: () => void;
  onGoSettings: () => void;
  onLogout: () => void;
}) {
  const lang = user.preferences?.language || "en";
  return (
    <header className="sf-global">
      <MotionTooltip content="Dashboard Home" side="bottom">
        <button type="button" className="brand-logo-btn" onClick={onGoHome} aria-label="Dashboard Home">
          <img src="/logo.svg" alt="FinanceTrace" className="brand-logo-img" />
        </button>
      </MotionTooltip>

      <div className="sf-search">
        <input
          placeholder="Search transactions and categories…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {searchQuery ? (
          <button
            type="button"
            className="sf-search__clear"
            onClick={() => onSearchChange("")}
            aria-label="Clear search"
          >
            <Icon name="close" />
          </button>
        ) : (
          <Icon name="search" />
        )}
      </div>

      <div className="sf-global__right">
        <MotionTooltip content="Notifications" side="bottom">
          <button className="icon-btn" onClick={onBell} aria-label="Notifications">
            <Icon name="bell" />
            {hasAlerts && <span className="dot" />}
          </button>
        </MotionTooltip>

        <LanguageDropdown language={lang} onSelectLanguage={onSelectLanguage} />

        <MotionTooltip content="Workspace Settings" side="bottom">
          <button className="icon-btn" onClick={onGoSettings} aria-label="Settings">
            <Icon name="settings" />
          </button>
        </MotionTooltip>

        <MotionTooltip content="Sign out" side="bottom">
          <button className="icon-btn" onClick={onLogout} aria-label="Sign out">
            <Icon name="logout" />
          </button>
        </MotionTooltip>

        <MotionTooltip content={`${user.full_name || user.email} — Customize Avatar`} side="bottom">
          <span>
            <UserAvatar user={user} size={42} onClick={onGoSettings} />
          </span>
        </MotionTooltip>
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
      {items.map((n) => {
        const active = route === n.id;
        return (
          <button
            key={n.id}
            className={"nav-item" + (active ? " active" : "")}
            onClick={() => go(n.id)}
          >
            <Icon name={n.icon} />
            <span>{n.label}</span>
            {active && (
              <motion.span
                layoutId="topnav-active-indicator"
                className="nav-item__indicator"
                transition={{ type: "spring", stiffness: 460, damping: 36 }}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}

export function Badge({ label, color }: { label: string; color?: string }) {
  return (
    <span className="badge">
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
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="overlay" />
        <div className="bui-dialog-viewport">
          <Dialog.Popup
            className="modal bui-dialog-popup"
            style={width ? { maxWidth: width } : undefined}
          >
            <div className="modal__head">
              <Dialog.Title className="modal__title">{title}</Dialog.Title>
              <Dialog.Close className="icon-btn" aria-label="Close">
                <Icon name="close" />
              </Dialog.Close>
            </div>
            <div className="modal__body">{children}</div>
            {footer && <div className="modal__foot">{footer}</div>}
          </Dialog.Popup>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
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
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="overlay" />
        <Dialog.Popup className="drawer bui-drawer-popup">
          <div className="drawer__head">
            <Dialog.Title style={{ fontSize: 17, fontWeight: 700 }}>{title}</Dialog.Title>
            <Dialog.Close className="icon-btn" aria-label="Close">
              <Icon name="close" />
            </Dialog.Close>
          </div>
          <div className="drawer__body">{children}</div>
          {footer && <div className="drawer__foot">{footer}</div>}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
