import { useState } from "react";
import { api } from "../api/client";
import { AvatarPicker, UserAvatar } from "../components/Avatar";
import { BaseInput, BaseSelect, SegmentedTabs } from "../components/BaseControls";
import { BLUE_BLACK_SWATCHES, CATEGORY_ICON_OPTIONS, Icon } from "../components/Icons";
import {
  AnimatedNotificationsList,
  MorphEditButton,
  MotionTooltip,
} from "../components/MotionPatterns";
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

  const [creatingCat, setCreatingCat] = useState(false);

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

      <SegmentedTabs
        value={tab}
        onValueChange={setTab}
        items={[
          { value: "profile", label: "Profile & Avatar", icon: "user" },
          { value: "categories", label: "Categories", icon: "tag" },
          { value: "preferences", label: "Preferences", icon: "sliders" },
          { value: "notifications", label: "Notifications", icon: "bell" },
        ]}
        layoutId="settings-section-tabs"
        style={{ marginBottom: 20 }}
      />

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
              <BaseInput value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="field">
              <label>Username</label>
              <BaseInput value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="field">
              <label>Email address</label>
              <BaseInput value={email} onChange={(e) => setEmail(e.target.value)} />
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
            <button className="btn btn--primary btn--sm" onClick={() => setCreatingCat(true)}>
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
                  <MorphEditButton
                    morphId={`cat-${c.id}`}
                    title="Edit Category"
                    tooltip="Edit category"
                  >
                    {(close) => (
                      <CategoryEditorBody
                        initial={c}
                        categories={categories}
                        onCancel={close}
                        onSaved={(msg) => {
                          close();
                          onCategoriesChanged(msg);
                        }}
                      />
                    )}
                  </MorphEditButton>

                  <MotionTooltip content="Delete category">
                    <button
                      type="button"
                      className="mini-btn danger"
                      onClick={() => deleteCat(c)}
                      aria-label="Delete category"
                    >
                      <Icon name="trash" />
                    </button>
                  </MotionTooltip>
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
            <SegmentedTabs
              value={theme}
              onValueChange={setTheme}
              items={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
                { value: "system", label: "System" },
              ]}
              layoutId="settings-theme-seg"
              style={{ minWidth: 270 }}
            />
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
            <BaseSelect
              width={320}
              value={fontPreset}
              onValueChange={(v) => setFontPreset(v as FontPreset)}
              options={[
                { value: "modern", label: "Modern Corporate — Montserrat + Rajdhani" },
                { value: "heritage", label: "Private Wealth — Cinzel + Montserrat" },
                { value: "fintech", label: "Digital Fintech — Exo 2 + Rajdhani" },
              ]}
            />
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
            <BaseSelect
              width={220}
              value={lang}
              onValueChange={(v) => setLang(v as Preferences["language"])}
              options={[
                { value: "en", label: "English" },
                { value: "pl", label: "Polski" },
                { value: "fr", label: "Français" },
              ]}
            />
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
            <BaseSelect
              width={220}
              value={cur}
              onValueChange={(v) => setCur(v as Preferences["currency"])}
              options={[
                { value: "USD", label: "USD — US Dollar" },
                { value: "EUR", label: "EUR — Euro" },
                { value: "GBP", label: "GBP — Pound" },
              ]}
            />
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
          <div className="card-title" style={{ marginBottom: 14 }}>
            Recent notifications
          </div>
          <AnimatedNotificationsList notifications={notifications} />
        </div>
      )}

      {creatingCat && (
        <Modal title="New Category" onClose={() => setCreatingCat(false)}>
          <div style={{ margin: "-24px" }}>
            <CategoryEditorBody
              initial={null}
              categories={categories}
              onCancel={() => setCreatingCat(false)}
              onSaved={(msg) => {
                setCreatingCat(false);
                onCategoriesChanged(msg);
              }}
            />
          </div>
        </Modal>
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
      <AnimatedNotificationsList notifications={notifications} />
    </Drawer>
  );
}

function CategoryEditorBody({
  initial,
  categories,
  onCancel,
  onSaved,
}: {
  initial: Category | null;
  categories: Category[];
  onCancel: () => void;
  onSaved: (msg: string) => void;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [type, setType] = useState<CategoryType>(initial?.type || "expense");
  const [color, setColor] = useState(initial?.color || "#0352ff");
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
    <>
      <div className="mp-morph-panel__body">
        {err && <div className="error-banner">{err}</div>}
        <div className="grid2" style={{ marginBottom: 14 }}>
          <div className="field">
            <label>Name</label>
            <BaseInput value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>Type</label>
            <BaseSelect
              value={type}
              onValueChange={(v) => setType(v as CategoryType)}
              options={[
                { value: "expense", label: "Expense" },
                { value: "income", label: "Income" },
                { value: "transfer", label: "Transfer" },
              ]}
            />
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
                  outline: color.toLowerCase() === s.hex ? "2px solid var(--blue-600)" : "none",
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
                  border: iconName === opt.id ? "2px solid var(--blue-600)" : "1px solid var(--border)",
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
            <BaseSelect
              value={parentId || "__none__"}
              onValueChange={(v) => setParentId(v === "__none__" ? "" : v)}
              options={[
                { value: "__none__", label: "None (top-level)" },
                ...categories.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
          </div>
        )}
      </div>
      <div className="mp-morph-panel__foot">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn btn--primary" onClick={save}>
          <Icon name="check" /> Save
        </button>
      </div>
    </>
  );
}
