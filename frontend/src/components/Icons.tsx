import React from "react";

/**
 * Semantic mapping from FinanceTrace icon identifiers to official Flaticon UIcons
 * (@flaticon/flaticon-uicons Regular Rounded & Solid Rounded).
 */
export const FLATICON_CLASSES: Record<string, string> = {
  apps: "fi-rr-apps",
  dashboard: "fi-rr-apps",
  transactions: "fi-rr-receipt",
  accounts: "fi-rr-bank",
  budgets: "fi-rr-chart-pie-alt",
  reports: "fi-rr-stats",
  settings: "fi-rr-settings",
  wallet: "fi-rr-wallet",
  trendUp: "fi-rr-arrow-trend-up",
  trendDown: "fi-rr-arrow-trend-down",
  percent: "fi-rr-percentage",
  plus: "fi-rr-plus-small",
  search: "fi-rr-search",
  bell: "fi-rr-bell",
  globe: "fi-rr-globe",
  language: "fi-rr-language",
  close: "fi-rr-cross-small",
  edit: "fi-rr-pencil",
  copy: "fi-rr-duplicate",
  trash: "fi-rr-trash",
  arrowR: "fi-rr-arrow-small-right",
  check: "fi-rr-check",
  checkCircle: "fi-sr-check-circle",
  alert: "fi-rr-triangle-warning",
  download: "fi-rr-download",
  upload: "fi-rr-upload",
  user: "fi-rr-user",
  tag: "fi-rr-label",
  sliders: "fi-rr-settings-sliders",
  piggy: "fi-rr-piggy-bank",
  cash: "fi-rr-money-bill-wave",
  card: "fi-rr-credit-card",
  building: "fi-rr-bank",
  logout: "fi-rr-sign-out-alt",
  shopping: "fi-rr-shopping-bag",
  utensils: "fi-rr-utensils",
  car: "fi-rr-car-side",
  home: "fi-rr-home",
  bolt: "fi-rr-bolt",
  health: "fi-rr-stethoscope",
  film: "fi-rr-film",
  briefcase: "fi-rr-briefcase",
  shuffle: "fi-rr-shuffle",
  calendar: "fi-rr-calendar",
  chevronDown: "fi-rr-angle-small-down",
  chevronLeft: "fi-rr-angle-small-left",
  chevronRight: "fi-rr-angle-small-right",
  eye: "fi-rr-eye",
  eyeOff: "fi-rr-eye-crossed",
  csv: "fi-rr-file-spreadsheet",
  sparkles: "fi-rr-sparkles",
};

export const CATEGORY_ICON_OPTIONS: { id: string; label: string }[] = [
  { id: "tag", label: "Label" },
  { id: "wallet", label: "Wallet" },
  { id: "briefcase", label: "Work" },
  { id: "home", label: "Housing" },
  { id: "shopping", label: "Shopping" },
  { id: "utensils", label: "Dining" },
  { id: "car", label: "Transport" },
  { id: "bolt", label: "Utilities" },
  { id: "health", label: "Health" },
  { id: "film", label: "Media" },
  { id: "piggy", label: "Savings" },
  { id: "trendUp", label: "Growth" },
];

export const BLUE_BLACK_SWATCHES: { hex: string; label: string }[] = [
  { hex: "#0052ff", label: "Royal Blue" },
  { hex: "#2563eb", label: "Vibrant Blue" },
  { hex: "#3b82f6", label: "Steel Blue" },
  { hex: "#60a5fa", label: "Sky Blue" },
  { hex: "#003db3", label: "Cobalt" },
  { hex: "#00297a", label: "Vault Navy" },
  { hex: "#05070a", label: "Obsidian" },
  { hex: "#0b0f17", label: "Jet Black" },
  { hex: "#1e293b", label: "Charcoal" },
  { hex: "#334155", label: "Graphite" },
  { hex: "#475569", label: "Slate" },
  { hex: "#64748b", label: "Cool Steel" },
];

export function Icon({
  name,
  style,
  className,
}: {
  name: string;
  style?: React.CSSProperties;
  className?: string;
}) {
  const fiClass = FLATICON_CLASSES[name] || FLATICON_CLASSES.tag;
  const mergedClass = ["fi", fiClass, className].filter(Boolean).join(" ");
  return <i className={mergedClass} style={style} aria-hidden="true" />;
}
