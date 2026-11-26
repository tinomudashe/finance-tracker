import { useMemo } from "react";
import { createAvatar, type Style } from "@dicebear/core";
import {
  adventurer,
  avataaars,
  bottts,
  identicon,
  initials,
  lorelei,
  micah,
  notionists,
  openPeeps,
  personas,
  rings,
  shapes,
} from "@dicebear/collection";
import type { User } from "../types";
import { Icon } from "./Icons";

export interface DiceBearStyleItem {
  id: string;
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  style: Style<any>;
}

export const DICEBEAR_STYLES: DiceBearStyleItem[] = [
  { id: "notionists", label: "Notionists", style: notionists },
  { id: "lorelei", label: "Lorelei", style: lorelei },
  { id: "micah", label: "Micah", style: micah },
  { id: "personas", label: "Personas", style: personas },
  { id: "open-peeps", label: "Open Peeps", style: openPeeps },
  { id: "adventurer", label: "Adventurer", style: adventurer },
  { id: "avataaars", label: "Avataaars", style: avataaars },
  { id: "bottts", label: "Bottts", style: bottts },
  { id: "identicon", label: "Identicon", style: identicon },
  { id: "shapes", label: "Shapes", style: shapes },
  { id: "rings", label: "Vault Rings", style: rings },
  { id: "initials", label: "Initials", style: initials },
];

export const AVATAR_BG_SWATCHES: { id: string; hex: string; label: string }[] = [
  { id: "0052ff", hex: "#0052ff", label: "Royal Blue" },
  { id: "00297a", hex: "#00297a", label: "Vault Navy" },
  { id: "3b82f6", hex: "#3b82f6", label: "Steel Blue" },
  { id: "05070a", hex: "#05070a", label: "Obsidian" },
  { id: "1e293b", hex: "#1e293b", label: "Charcoal" },
];

export function buildDiceBearDataUri({
  styleId = "notionists",
  seed = "FinanceTrace",
  bg = "0052ff",
  size = 96,
}: {
  styleId?: string;
  seed?: string;
  bg?: string;
  size?: number;
}): string {
  const found = DICEBEAR_STYLES.find((s) => s.id === styleId) || DICEBEAR_STYLES[0];
  const cleanBg = bg.replace(/^#/, "") || "0052ff";
  return createAvatar(found.style, {
    seed: seed.trim() || "FinanceTrace",
    size,
    backgroundColor: [cleanBg],
  }).toDataUri();
}

export function UserAvatar({
  user,
  size = 36,
  onClick,
  title,
}: {
  user: Pick<User, "full_name" | "email" | "preferences">;
  size?: number;
  onClick?: () => void;
  title?: string;
}) {
  const styleId = user.preferences?.avatar_style || "notionists";
  const seed = user.preferences?.avatar_seed || user.full_name || user.email || "User";
  const bg = user.preferences?.avatar_bg || "0052ff";

  const uri = useMemo(
    () => buildDiceBearDataUri({ styleId, seed, bg, size: size * 2 }),
    [styleId, seed, bg, size]
  );

  if (onClick) {
    return (
      <button
        type="button"
        className="avatar avatar--btn"
        style={{ width: size, height: size }}
        onClick={onClick}
        title={title || "Customize avatar"}
      >
        <img src={uri} alt={user.full_name || user.email} />
      </button>
    );
  }

  return (
    <div
      className="avatar"
      style={{ width: size, height: size }}
      title={title || user.full_name || user.email}
    >
      <img src={uri} alt={user.full_name || user.email} />
    </div>
  );
}

export function AvatarPicker({
  styleId,
  seed,
  bg,
  onChange,
}: {
  styleId: string;
  seed: string;
  bg: string;
  onChange: (next: { styleId: string; seed: string; bg: string }) => void;
}) {
  const randomizeSeed = () => {
    const token = `FT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    onChange({ styleId, seed: token, bg });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="between" style={{ flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>DiceBear Avatar Studio</div>
          <div className="muted" style={{ fontSize: 12.5 }}>
            Choose from 12 DiceBear styles and customize your seed or background shade.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {AVATAR_BG_SWATCHES.map((s) => (
            <button
              key={s.id}
              type="button"
              title={`Background: ${s.label}`}
              onClick={() => onChange({ styleId, seed, bg: s.id })}
              style={{
                width: 26,
                height: 26,
                borderRadius: 8,
                background: s.hex,
                border: bg === s.id ? "2px solid var(--ink)" : "1px solid var(--border-2)",
                outline: bg === s.id ? "2px solid var(--blue)" : "none",
              }}
            />
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div className="field" style={{ flex: 1, minWidth: 220 }}>
          <label>Avatar Seed</label>
          <input
            className="input"
            value={seed}
            placeholder="Type any name or phrase…"
            onChange={(e) => onChange({ styleId, seed: e.target.value, bg })}
          />
        </div>
        <button type="button" className="btn btn--ghost" style={{ height: 42 }} onClick={randomizeSeed}>
          <Icon name="shuffle" /> Randomize Seed
        </button>
      </div>

      <div className="avatar-grid">
        {DICEBEAR_STYLES.map((item) => {
          const previewUri = buildDiceBearDataUri({
            styleId: item.id,
            seed: seed || "FinanceTrace",
            bg,
            size: 96,
          });
          const active = styleId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={"avatar-tile" + (active ? " active" : "")}
              onClick={() => onChange({ styleId: item.id, seed, bg })}
            >
              <img src={previewUri} alt={item.label} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
