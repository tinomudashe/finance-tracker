import React from "react";
import type { Preferences } from "../types";
import { Icon } from "./Icons";

export interface WallpaperOption {
  id: string;
  label: string;
  source: string;
  cssImage: string;
}

export const PEXELS_WALLPAPERS: WallpaperOption[] = [
  {
    id: "contour-blue",
    label: "Blue Contour Waves",
    source: "FinanceTrace Signature",
    cssImage: 'url("/wallpapers/contour-blue.svg")',
  },
  {
    id: "pexels-blue-marble",
    label: "Blue Marble Flow",
    source: "Pexels #3255761",
    cssImage:
      'url("https://images.pexels.com/photos/3255761/pexels-photo-3255761.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2"), url("/wallpapers/contour-blue.svg")',
  },
  {
    id: "pexels-black-dunes",
    label: "Obsidian Sand Ripples",
    source: "Pexels #2387793",
    cssImage:
      'url("https://images.pexels.com/photos/2387793/pexels-photo-2387793.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2"), url("/wallpapers/contour-blue.svg")',
  },
  {
    id: "pexels-smooth-curves",
    label: "Minimal Architectural Curves",
    source: "Pexels #1103970",
    cssImage:
      'url("https://images.pexels.com/photos/1103970/pexels-photo-1103970.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2"), url("/wallpapers/contour-blue.svg")',
  },
  {
    id: "pexels-alpine-blue",
    label: "Cobalt Horizon",
    source: "Pexels #1054218",
    cssImage:
      'url("https://images.pexels.com/photos/1054218/pexels-photo-1054218.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2"), url("/wallpapers/contour-blue.svg")',
  },
  {
    id: "pexels-night-stars",
    label: "Midnight Vault Sky",
    source: "Pexels #924824",
    cssImage:
      'url("https://images.pexels.com/photos/924824/pexels-photo-924824.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2"), url("/wallpapers/contour-blue.svg")',
  },
  {
    id: "contour-mono",
    label: "Alabaster Topography",
    source: "Minimal Line Pattern",
    cssImage: 'url("/wallpapers/contour-mono.svg")',
  },
];

export function resolveWallpaperCss(prefs?: Preferences): string {
  const custom = prefs?.custom_wallpaper_url?.trim();
  if (custom && /^https?:\/\//i.test(custom)) {
    const safeUrl = custom.replace(/"/g, "%22");
    return `url("${safeUrl}"), url("/wallpapers/contour-blue.svg")`;
  }
  const id = prefs?.card_wallpaper || "contour-blue";
  const found = PEXELS_WALLPAPERS.find((w) => w.id === id) || PEXELS_WALLPAPERS[0];
  return found.cssImage;
}

export function PageHeroCard({
  icon,
  title,
  subtitle,
  wallpaperCss,
  rightSlot,
  children,
}: {
  icon: string;
  title: string;
  subtitle?: React.ReactNode;
  wallpaperCss?: string;
  rightSlot?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const bgImage = wallpaperCss || PEXELS_WALLPAPERS[0].cssImage;
  return (
    <section className="hero-card">
      <div className="hero-card__top">
        <span className="hero-card__icon" aria-hidden="true">
          <Icon name={icon} />
        </span>
        <div className="hero-card__title-wrap">
          <h1>{title}</h1>
          {subtitle && <div className="sub">{subtitle}</div>}
        </div>
        <div className="hero-card__right">{rightSlot}</div>
      </div>
      {children && (
        <div className="hero-card__banner" style={{ backgroundImage: bgImage }}>
          {children}
        </div>
      )}
    </section>
  );
}

export function WallpaperPicker({
  selectedId,
  customUrl,
  onChange,
}: {
  selectedId: string;
  customUrl: string;
  onChange: (next: { cardWallpaper: string; customUrl: string }) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="between" style={{ flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontWeight: 700 }}>Card Wallpaper (Pexels Collection)</div>
          <div className="muted" style={{ fontSize: 13 }}>
            Applied to section hero banners and bank account cards. Browse more at{" "}
            <a
              href="https://www.pexels.com/discover/wallpapers/"
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--blue-600)", fontWeight: 600 }}
            >
              pexels.com/discover/wallpapers
            </a>
            .
          </div>
        </div>
      </div>

      <div className="wallpaper-grid">
        {PEXELS_WALLPAPERS.map((w) => {
          const active = !customUrl.trim() && selectedId === w.id;
          return (
            <button
              key={w.id}
              type="button"
              className={"wallpaper-tile" + (active ? " active" : "")}
              onClick={() => onChange({ cardWallpaper: w.id, customUrl: "" })}
            >
              <div
                className="wallpaper-tile__preview"
                style={{ backgroundImage: w.cssImage }}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{w.label}</div>
                <div className="muted" style={{ fontSize: 11.5 }}>
                  {w.source}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="field">
        <label>Custom Pexels Image URL (optional)</label>
        <input
          className="input"
          placeholder="https://images.pexels.com/photos/..."
          value={customUrl}
          onChange={(e) => onChange({ cardWallpaper: selectedId, customUrl: e.target.value })}
        />
      </div>
    </div>
  );
}
