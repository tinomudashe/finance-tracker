import { useState } from "react";
import { api } from "../api/client";
import { Icon } from "../components/Icons";
import { Drawer, Modal } from "../components/Shell";
import type { Category, CategoryType, NotificationItem, Preferences, User } from "../types";
import { userInitials } from "../utils/format";

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

  const [theme, setTheme] = useState<Preferences["theme"]>(user.preferences?.theme || "light");
  const [lang, setLang] = useState<Preferences["language"]>(user.preferences?.language || "en");
  const [cur, setCur] = useState<Preferences["currency"]>(user.preferences?.currency || "USD");

  const [catModal, setCatModal] = useState<Category | "new" | null>(null);

  const saveProfile = async () => {
    try {
      const updated = await api.updateProfile({
        full_name: fullName,
        username: username || undefined,
        email,
      });
      onUserUpdated(updated, "Profile saved");
    } catch (ex) {
      onError(ex instanceof Error ? ex.message : "Failed to update profile");
    }
  };

  const savePrefs = async () => {
    try {
      const updated = await api.updateProfile({
        preferences: { theme, language: lang, currency: cur },
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

  return (
    <div className="page" style={{ maxWidth: 960 }}>
      <div className="page-head">
        <div className="page-head__left">
          <span className="sf-head-icon">
            <Icon name="settings" />
          </span>
          <div>
            <div className="page-head__eyebrow">Setup</div>
            <h1>Settings</h1>
            <div className="sub">Manage your profile, categories and preferences</div>
          </div>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 20 }}>
        <button className={"tab" + (tab === "profile" ? " active" : "")} onClick={() => setTab("profile")}>
          <Icon name="user" /> Profile
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
            Profile
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 22 }}>
            <div
              className="avatar"
              style={{ width: 60, height: 60, fontSize: 21, borderRadius: 12 }}
            >
              {userInitials(user.full_name, user.email)}
            </div>
            <div>
              <div className="cell-strong" style={{ fontSize: 17 }}>
                {user.full_name || user.email}
              </div>
              <div className="muted" style={{ fontSize: 13.5 }}>
                {user.email}
              </div>
            </div>
          </div>
          <div className="grid2" style={{ borderTop: "1px solid var(--line)", paddingTop: 20 }}>
            <div className="field">
              <label>Full name</label>
              <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="field">
              <label>Username</label>
              <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="field">
              <label>Email address</label>
              <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <div style={{ marginTop: 20 }}>
            <button className="btn btn--primary" onClick={saveProfile}>
              <Icon name="check" /> Save changes
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
            {categories.map((c) => (
              <div
                key={c.id}
                className="between"
                style={{
                  padding: "11px 14px",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  background: "var(--surface-2)",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 500 }}>
                  <span style={{ width: 11, height: 11, borderRadius: 3, background: c.color }} />
                  {c.name}
                  <span
                    className="badge"
                    style={{
                      background: c.type === "income" ? "var(--pos-soft)" : "var(--surface-3)",
                      color: c.type === "income" ? "var(--pos)" : "var(--ink-2)",
                      textTransform: "capitalize",
                    }}
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
            style={{ padding: "14px 0", borderBottom: "1px solid var(--line)" }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>Appearance</div>
              <div className="muted" style={{ fontSize: 13 }}>
                Choose how FinanceTrace looks to you.
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
            style={{ padding: "14px 0", borderBottom: "1px solid var(--line)" }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>Language</div>
              <div className="muted" style={{ fontSize: 13 }}>
                Display language for navigation.
              </div>
            </div>
            <select
              className="select"
              style={{ width: 180 }}
              value={lang}
              onChange={(e) => setLang(e.target.value as Preferences["language"])}
            >
              <option value="en">English</option>
              <option value="pl">Polski</option>
              <option value="fr">Français</option>
            </select>
          </div>

          <div className="between" style={{ padding: "14px 0" }}>
            <div>
              <div style={{ fontWeight: 600 }}>Currency</div>
              <div className="muted" style={{ fontSize: 13 }}>
                Default currency symbol for balances and reports.
              </div>
            </div>
            <select
              className="select"
              style={{ width: 180 }}
              value={cur}
              onChange={(e) => setCur(e.target.value as Preferences["currency"])}
            >
              <option value="USD">USD — US Dollar</option>
              <option value="EUR">EUR — Euro</option>
              <option value="GBP">GBP — Pound</option>
            </select>
          </div>

          <div style={{ marginTop: 14 }}>
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
  const tone: Record<NotificationItem["kind"], [string, string, string]> = {
    warn: ["var(--warn-soft)", "var(--neg)", "alert"],
    pos: ["var(--pos-soft)", "var(--pos)", "checkCircle"],
    info: ["var(--blue-soft)", "var(--blue)", "bell"],
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {notifications.map((n) => {
        const [bg, fg, ic] = tone[n.kind];
        return (
          <div
            key={n.id}
            style={{
              display: "flex",
              gap: 13,
              padding: "13px 15px",
              border: "1px solid var(--border)",
              borderRadius: 4,
            }}
          >
            <span className="stat__ic" style={{ background: bg, color: fg, flexShrink: 0 }}>
              <Icon name={ic} />
            </span>
            <div style={{ flex: 1 }}>
              <div className="between">
                <span className="cell-strong" style={{ fontSize: 14 }}>
                  {n.title}
                </span>
                <span className="muted" style={{ fontSize: 12 }}>
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
  const [color, setColor] = useState(initial?.color || "#0176d3");
  const [parentId, setParentId] = useState(initial?.parent_id || "");
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) {
      setErr("Category name is required");
      return;
    }
    try {
      if (initial) {
        await api.updateCategory(initial.id, { name: name.trim(), type, color });
        onSaved("Category updated");
      } else {
        await api.createCategory({
          name: name.trim(),
          type,
          color,
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
      <div className="field" style={{ marginBottom: 14 }}>
        <label>Name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid2" style={{ marginBottom: 14 }}>
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
        <div className="field">
          <label>Color</label>
          <input
            className="input"
            type="color"
            value={color.startsWith("#") ? color : "#0176d3"}
            onChange={(e) => setColor(e.target.value)}
          />
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
