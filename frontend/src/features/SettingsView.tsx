import { useState } from "react";
import { api } from "../api/client";
import { AvatarPicker, UserAvatar } from "../components/Avatar";
import { BLUE_BLACK_SWATCHES, CATEGORY_ICON_OPTIONS, Icon } from "../components/Icons";
import { Drawer, Modal } from "../components/Shell";
import { PageHeroCard, resolveWallpaperCss, WallpaperPicker } from "../components/Wallpapers";
import type { Category, CategoryType, FontPreset, NotificationItem, Preferences, User } from "../types";

export function SettingsView({
  user,
  categories,
  notifications,
  onUserUpdated,
  onCategoriesChanged,
  onError,
}: {
  user: User;
  categories: Category[];
  notifications: NotificationItem[];
  onUserUpdated: (u: User, msg: string) => void;
  onCategoriesChanged: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [tab, setTab] = useState<"profile" | "categories" | "preferences" | "notifications">(
    "profile"
  );
  const [fullName, setFullName] = useState(user.full_name || "");
  const [username, setUsername] = useState(user.username || "");
  const [email, setEmail] = useState(user.email);

  const [avatarStyle, setAvatarStyle] = useState(user.preferences?.avatar_style || "notionists");
  const [avatarSeed, setAvatarSeed] = useState(
    user.preferences?.avatar_seed || user.full_name || user.email
  );
  const [avatarBg, setAvatarBg] = useState(user.preferences?.avatar_bg || "0352ff");

  const [theme, setTheme] = useState<Preferences["theme"]>(user.preferences?.theme || "light");
  const [lang, setLang] = useState<Preferences["language"]>(user.preferences?.language || "en");
  const [cur, setCur] = useState<Preferences["currency"]>(user.preferences?.currency || "USD");
  const [fontPreset, setFontPreset] = useState<FontPreset>(
    user.preferences?.font_preset || "modern"
  );
  const [cardWallpaper, setCardWallpaper] = useState(
    user.preferences?.card_wallpaper || "contour-blue"
  );
  const [customWallpaperUrl, setCustomWallpaperUrl] = useState(
    user.preferences?.custom_wallpaper_url || ""
  );

  const [catModal, setCatModal] = useState<Category | "new" | null>(null);

  const buildPreferences = (overrides?: Partial<Preferences>): Preferences => ({
    theme,
    language: lang,
    currency: cur,
    avatar_style: avatarStyle,
    avatar_seed: avatarSeed,
    avatar_bg: avatarBg,
    font_preset: fontPreset,
    card_wallpaper: cardWallpaper,
    custom_wallpaper_url: customWallpaperUrl.trim() || null,
    ...overrides,
  });

  const saveProfile = async () => {
    try {
      const updated = await api.updateProfile({
        full_name: fullName,
        username: username || undefined,
        email,
        preferences: buildPreferences(),
      });
      onUserUpdated(updated, "Profile & DiceBear avatar saved");
    } catch (ex) {
      onError(ex instanceof Error ? ex.message : "Failed to update profile");
    }
  };

  const savePrefs = async () => {
    try {
      const updated = await api.updateProfile({
        preferences: buildPreferences(),
      });
      onUserUpdated(updated, "Preferences saved");
    } catch (ex) {
      onError(ex instanceof Error ? ex.message : "Failed to save preferences");
    }
  };

  const deleteCat = async (c: Category) => {
    try {
      await api.deleteCategory(c.id);
      onCategoriesChanged("Category deleted");
    } catch (ex) {
      onError(ex instanceof Error ? ex.message : "Cannot delete category");
    }
  };

  const previewUser = {
    full_name: fullName || user.full_name,
    email: email || user.email,
    preferences: buildPreferences(),
  };

  const currentWallpaperCss = resolveWallpaperCss(buildPreferences());

  return (
    <div className="page" style={{ maxWidth: 980 }}>
      <PageHeroCard
        icon="settings"
        title="Settings"
        subtitle="Manage your profile, DiceBear avatar, Pexels card wallpapers and preferences"
        wallpaperCss={currentWallpaperCss}
      />

      <div className="tabs" style={{ marginBottom: 20 }}>
        <button
          className={"tab" + (tab === "profile" ? " active" : "")}
          onClick={() => setTab("profile")}
        >
          <Icon name="user" /> Profile & Avatar
        </button>
        <button
          className={"tab" + (tab === "categories" ? " active" : "")}
          onClick={() => setTab("categories")}
        >
          <Icon name="tag" /> Categories
        </button>
        <button
          className={"tab" + (tab === "preferences" ? " active" : "")}
          onClick={() => setTab("preferences")}
        >
          <Icon name="sliders" /> Preferences
        </button>
        <button
          className={"tab" + (tab === "notifications" ? " active" : "")}
          onClick={() => setTab("notifications")}
        >
          <Icon name="bell" /> Notifications
        </button>
      </div>

      {tab === "profile" && (
        <div className="card card--pad">
          <div className="card-title" style={{ marginBottom: 18 }}>
            Identity & Avatar
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 22 }}>
            <UserAvatar user={previewUser} size={68} />
            <div>
              <div className="cell-strong" style={{ fontSize: 18 }}>
                {fullName || user.email}
              </div>
              <div className="muted" style={{ fontSize: 13.5 }}>
                {email} · Style: <b style={{ color: "var(--ink)" }}>{avatarStyle}</b>
              </div>
            </div>
          </div>

          <div className="grid2" style={{ borderTop: "1px solid var(--line)", paddingTop: 20, marginBottom: 22 }}>
            <div className="field">
              <label>Full name</label>
              <input
                className="input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Username</label>
              <input
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Email address</label>
              <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--line)", paddingTop: 20 }}>
            <AvatarPicker
              styleId={avatarStyle}
              seed={avatarSeed}
              bg={avatarBg}
              onChange={(next) => {
                setAvatarStyle(next.styleId);
                setAvatarSeed(next.seed);
                setAvatarBg(next.bg);
              }}
            />
          </div>

          <div style={{ marginTop: 22 }}>
            <button className="btn btn--primary" onClick={saveProfile}>
              <Icon name="check" /> Save profile & avatar
            </button>
          </div>
        </div>
      )}

      {tab === "categories" && (
        <div className="card card--pad">
          <div className="card-head">
            <div className="card-title">Categories ({categories.length})</div>
            <button className="btn btn--primary btn--sm" onClick={() => setCatModal("new")}>
              <Icon name="plus" /> New category
            </button>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(265px, 1fr))",
              gap: 12,
            }}
          >
            {categories.map((c) => (
              <div
                key={c.id}
                className="between"
                style={{
                  padding: "12px 15px",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-sm)",
                  background: "var(--surface-2)",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 600 }}>
                  <span className="bare-icon" style={{ color: c.color || "var(--blue-600)", fontSize: 18 }}>
                    <Icon name={c.icon || "tag"} />
                  </span>
                  {c.name}
                  <span
                    className={"badge " + (c.type === "income" ? "badge--blue" : "")}
                    style={{ textTransform: "capitalize" }}
                  >
                    {c.type}
                  </span>
                </span>
                <span className="row-act">
                  <button className="mini-btn" title="Edit" onClick={() => setCatModal(c)}>
                    <Icon name="edit" />
                  </button>
                  <button className="mini-btn danger" title="Delete" onClick={() => deleteCat(c)}>
                    <Icon name="trash" />
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "preferences" && (
        <div className="card card--pad">
          <div className="card-title" style={{ marginBottom: 18 }}>
            Preferences
          </div>
          <div
            className="between"
            style={{ padding: "15px 0", borderBottom: "1px solid var(--line)", gap: 16, flexWrap: "wrap" }}
          >
            <div>
              <div style={{ fontWeight: 700 }}>Appearance</div>
              <div className="muted" style={{ fontSize: 13 }}>
                Switch between Light and Obsidian Dark Blue/Black themes.
              </div>
            </div>
            <div className="seg">
              {(["light", "dark", "system"] as const).map((m) => (
                <button
                  key={m}
                  className={theme === m ? "active" : ""}
                  onClick={() => setTheme(m)}
                  style={{ textTransform: "capitalize" }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div
            className="between"
            style={{ padding: "15px 0", borderBottom: "1px solid var(--line)", gap: 16, flexWrap: "wrap" }}
          >
            <div>
              <div style={{ fontWeight: 700 }}>Banking Typography (1001Fonts)</div>
              <div className="muted" style={{ fontSize: 13 }}>
                Select your preferred financial display and ledger typeface pairing.
              </div>
            </div>
            <select
              className="select"
              style={{ width: 290 }}
              value={fontPreset}
              onChange={(e) => setFontPreset(e.target.value as FontPreset)}
            >
              <option value="modern">Modern Corporate — Montserrat + Rajdhani</option>
              <option value="heritage">Private Wealth — Cinzel + Montserrat</option>
              <option value="fintech">Digital Fintech — Exo 2 + Rajdhani</option>
            </select>
          </div>

          <div
            className="between"
            style={{ padding: "15px 0", borderBottom: "1px solid var(--line)", gap: 16, flexWrap: "wrap" }}
          >
            <div>
              <div style={{ fontWeight: 700 }}>Language</div>
              <div className="muted" style={{ fontSize: 13 }}>
                Display language for navigation.
              </div>
            </div>
            <select
              className="select"
              style={{ width: 200 }}
              value={lang}
              onChange={(e) => setLang(e.target.value as Preferences["language"])}
            >
              <option value="en">English</option>
              <option value="pl">Polski</option>
              <option value="fr">Français</option>
            </select>
          </div>

          <div
            className="between"
            style={{ padding: "15px 0", borderBottom: "1px solid var(--line)", gap: 16, flexWrap: "wrap" }}
          >
            <div>
              <div style={{ fontWeight: 700 }}>Currency</div>
              <div className="muted" style={{ fontSize: 13 }}>
                Default currency symbol for balances and reports.
              </div>
            </div>
            <select
              className="select"
              style={{ width: 200 }}
              value={cur}
              onChange={(e) => setCur(e.target.value as Preferences["currency"])}
            >
              <option value="USD">USD — US Dollar</option>
              <option value="EUR">EUR — Euro</option>
              <option value="GBP">GBP — Pound</option>
            </select>
          </div>

          <div style={{ paddingTop: 18 }}>
            <WallpaperPicker
              selectedId={cardWallpaper}
              customUrl={customWallpaperUrl}
              onChange={(next) => {
                setCardWallpaper(next.cardWallpaper);
                setCustomWallpaperUrl(next.customUrl);
              }}
            />
          </div>

          <div style={{ marginTop: 18 }}>
            <button className="btn btn--primary" onClick={savePrefs}>
              <Icon name="check" /> Save preferences
            </button>
          </div>
        </div>
      )}

      {tab === "notifications" && (
        <div className="card card--pad">
          <div className="card-title" style={{ marginBottom: 16 }}>
            Recent notifications
          </div>
          <NotificationList notifications={notifications} />
        </div>
      )}

      {catModal && (
        <CategoryFormModal
          initial={catModal === "new" ? null : catModal}
          categories={categories}
          onClose={() => setCatModal(null)}
          onSaved={(msg) => {
            setCatModal(null);
            onCategoriesChanged(msg);
          }}
        />
      )}
    </div>
  );
}

export function NotificationsDrawer({
  notifications,
  onClose,
}: {
  notifications: NotificationItem[];
  onClose: () => void;
}) {
  return (
    <Drawer title="Notifications" onClose={onClose}>
      <NotificationList notifications={notifications} />
    </Drawer>
  );
}

function NotificationList({ notifications }: { notifications: NotificationItem[] }) {
  const tone: Record<NotificationItem["kind"], [string, string]> = {
    warn: ["stat__ic--black", "alert"],
    pos: ["stat__ic--blue", "checkCircle"],
    info: ["stat__ic--blue", "bell"],
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {notifications.map((n) => {
        const [variant, ic] = tone[n.kind];
        return (
          <div
            key={n.id}
            style={{
              display: "flex",
              gap: 13,
              padding: "14px 16px",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
              background: "var(--surface-2)",
            }}
          >
            <span
              className={"bare-icon " + (variant === "stat__ic--blue" ? "bare-icon--blue" : "")}
              style={{ fontSize: 21 }}
            >
              <Icon name={ic} />
            </span>
            <div style={{ flex: 1 }}>
              <div className="between">
                <span className="cell-strong" style={{ fontSize: 14 }}>
                  {n.title}
                </span>
                <span className="muted num" style={{ fontSize: 12 }}>
                  {n.time}
                </span>
              </div>
              <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                {n.body}
              </div>
            </div>
          </div>
        );
      })}
      {notifications.length === 0 && (
        <div className="muted" style={{ fontSize: 13 }}>
          No active alerts.
        </div>
      )}
    </div>
  );
}

function CategoryFormModal({
  initial,
  categories,
  onClose,
  onSaved,
}: {
  initial: Category | null;
  categories: Category[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [type, setType] = useState<CategoryType>(initial?.type || "expense");
  const [color, setColor] = useState(initial?.color || "#0052ff");
  const [iconName, setIconName] = useState(initial?.icon || "tag");
  const [parentId, setParentId] = useState(initial?.parent_id || "");
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) {
      setErr("Category name is required");
      return;
    }
    try {
      if (initial) {
        await api.updateCategory(initial.id, { name: name.trim(), type, color, icon: iconName });
        onSaved("Category updated");
      } else {
        await api.createCategory({
          name: name.trim(),
          type,
          color,
          icon: iconName,
          parent_id: parentId || null,
        });
        onSaved("Category created");
      }
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Failed to save category");
    }
  };

  return (
    <Modal
      title={initial ? "Edit Category" : "New Category"}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn--primary" onClick={save}>
            <Icon name="check" /> Save
          </button>
        </>
      }
    >
      {err && <div className="error-banner">{err}</div>}
      <div className="grid2" style={{ marginBottom: 14 }}>
        <div className="field">
          <label>Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Type</label>
          <select
            className="select"
            value={type}
            onChange={(e) => setType(e.target.value as CategoryType)}
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
            <option value="transfer">Transfer</option>
          </select>
        </div>
      </div>

      <div className="field" style={{ marginBottom: 14 }}>
        <label>Blue & Black Shade</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
          {BLUE_BLACK_SWATCHES.map((s) => (
            <button
              key={s.hex}
              type="button"
              title={s.label}
              onClick={() => setColor(s.hex)}
              style={{
                height: 32,
                borderRadius: "var(--r-xs)",
                background: s.hex,
                border: color.toLowerCase() === s.hex ? "2px solid var(--ink)" : "1px solid var(--border-2)",
                outline: color.toLowerCase() === s.hex ? "2px solid var(--blue)" : "none",
              }}
            />
          ))}
        </div>
      </div>

      <div className="field" style={{ marginBottom: 14 }}>
        <label>Flaticon Category Glyph</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
          {CATEGORY_ICON_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              title={opt.label}
              onClick={() => setIconName(opt.id)}
              style={{
                height: 36,
                borderRadius: "var(--r-xs)",
                border: iconName === opt.id ? "2px solid var(--blue)" : "1px solid var(--border)",
                background: iconName === opt.id ? "var(--blue-600)" : "var(--surface-2)",
                color: iconName === opt.id ? "#ffffff" : "var(--ink)",
                display: "grid",
                placeItems: "center",
                fontSize: 15,
              }}
            >
              <Icon name={opt.id} />
            </button>
          ))}
        </div>
      </div>

      {!initial && (
        <div className="field">
          <label>Parent Category (optional)</label>
          <select className="select" value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">None (top-level)</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </Modal>
  );
}
