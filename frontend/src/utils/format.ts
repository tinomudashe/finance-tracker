import type { Preferences } from "../types";

const CURRENCY_SYMBOL: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
};

export function toNum(v: string | number | null | undefined): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : parseFloat(v) || 0;
}

export function fmtMoney(
  raw: string | number,
  opts: { sign?: boolean; cents?: boolean; currency?: string } = {}
): string {
  const { sign = false, cents = true, currency = "USD" } = opts;
  const n = toNum(raw);
  const neg = n < 0;
  const abs = Math.abs(n);
  const sym = CURRENCY_SYMBOL[currency] || "$";
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
  const core = sym + formatted;
  if (sign) return (neg ? "−" : "+") + core;
  return (neg ? "−" : "") + core;
}

export function fmtK(raw: string | number, currency = "USD"): string {
  const n = toNum(raw);
  const sym = CURRENCY_SYMBOL[currency] || "$";
  const abs = Math.abs(n);
  if (abs >= 1000) {
    return sym + (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "k";
  }
  return sym + n.toFixed(0);
}

export function fmtDate(iso: string): string {
  const d = new Date(iso.includes("T") ? iso : iso + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function userInitials(name?: string | null, email?: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
  }
  return (email?.[0] || "U").toUpperCase();
}

export const LABELS: Record<Preferences["language"], Record<string, string>> = {
  en: {
    dashboard: "Dashboard",
    transactions: "Transactions",
    accounts: "Accounts",
    budgets: "Budgets",
    reports: "Reports",
    settings: "Settings",
    addTransaction: "Add Transaction",
    welcomeBack: "Welcome back",
  },
  pl: {
    dashboard: "Pulpit",
    transactions: "Transakcje",
    accounts: "Konta",
    budgets: "Budżety",
    reports: "Raporty",
    settings: "Ustawienia",
    addTransaction: "Dodaj transakcję",
    welcomeBack: "Witaj ponownie",
  },
  fr: {
    dashboard: "Tableau de bord",
    transactions: "Transactions",
    accounts: "Comptes",
    budgets: "Budgets",
    reports: "Rapports",
    settings: "Paramètres",
    addTransaction: "Ajouter une transaction",
    welcomeBack: "Bon retour",
  },
};
