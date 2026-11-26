import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { api } from "./api/client";
import { AppToastProvider, showAppToast } from "./components/BaseControls";
import { HeaderBar, TopNav } from "./components/Shell";
import { resolveWallpaperCss } from "./components/Wallpapers";
import { AccountsView } from "./features/AccountsView";
import { AuthView } from "./features/AuthView";
import { BudgetsView } from "./features/BudgetsView";
import { DashboardView } from "./features/DashboardView";
import { ReportsView } from "./features/ReportsView";
import { NotificationsDrawer, SettingsView } from "./features/SettingsView";
import { TransactionFormModal, TransactionsView } from "./features/TransactionsView";
import type {
  Account,
  BudgetUtilization,
  Category,
  DashboardSummary,
  NotificationItem,
  Preferences,
  RouteId,
  Transaction,
  User,
} from "./types";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);
  const [route, setRoute] = useState<RouteId>(
    () => (localStorage.getItem("ft_route") as RouteId) || "dashboard"
  );
  const [searchQuery, setSearchQuery] = useState("");

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<BudgetUtilization[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const [txModal, setTxModal] = useState<Transaction | "new" | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);

  const showToast = useCallback((msg: string) => {
    showAppToast(msg);
  }, []);

  const showErrorToast = useCallback((msg: string) => {
    showAppToast(msg, { type: "alert" });
  }, []);

  // Apply light/dark/system theme and 1001Fonts preset to <html>
  useEffect(() => {
    const pref = user?.preferences?.theme || "light";
    const resolved =
      pref === "system"
        ? window.matchMedia?.("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : pref;
    document.documentElement.setAttribute("data-theme", resolved);
    document.documentElement.setAttribute("data-font", user?.preferences?.font_preset || "modern");
  }, [user?.preferences?.theme, user?.preferences?.font_preset]);

  const refreshWorkspace = useCallback(async () => {
    const [dash, accts, cats, txPage, bgs, notifs] = await Promise.all([
      api.getDashboard(),
      api.listAccounts(),
      api.listCategories(),
      api.listTransactions({ limit: 200 }),
      api.listBudgets(),
      api.getNotifications(),
    ]);
    setSummary(dash);
    setAccounts(accts);
    setCategories(cats);
    setTransactions(txPage.transactions);
    setBudgets(bgs);
    setNotifications(notifs);
  }, []);

  useEffect(() => {
    api
      .me()
      .then((u) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setBooting(false));
  }, []);

  useEffect(() => {
    if (user) {
      refreshWorkspace().catch(() => {});
    }
  }, [user, refreshWorkspace]);

  const go = (r: RouteId) => {
    setRoute(r);
    localStorage.setItem("ft_route", r);
  };

  const handleGlobalSearch = (q: string) => {
    setSearchQuery(q);
    if (q.trim() && route !== "transactions") {
      go("transactions");
    }
  };

  const handleSelectLanguage = async (next: Preferences["language"]) => {
    if (!user || user.preferences?.language === next) return;
    const updated = await api.updateProfile({
      preferences: { ...user.preferences, language: next },
    });
    setUser(updated);
    const names: Record<Preferences["language"], string> = {
      en: "English",
      pl: "Polski",
      fr: "Français",
    };
    showAppToast(`Language switched to ${names[next]}`);
  };

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    setSummary(null);
  };

  if (booting) {
    return (
      <div style={{ display: "grid", placeItems: "center", height: "100%" }} className="muted">
        Loading FinanceTrace…
      </div>
    );
  }

  const currency = user?.preferences?.currency || "USD";
  const wallpaperCss = resolveWallpaperCss(user?.preferences);

  return (
    <AppToastProvider>
      {!user ? (
        <AuthView onAuth={(u) => setUser(u)} />
      ) : (
        <div className="app">
          <HeaderBar
            user={user}
            searchQuery={searchQuery}
            onSearchChange={handleGlobalSearch}
            onBell={() => setNotifOpen(true)}
            hasAlerts={notifications.some((n) => n.kind === "warn")}
            onSelectLanguage={handleSelectLanguage}
            onGoHome={() => go("dashboard")}
            onGoSettings={() => go("settings")}
            onLogout={handleLogout}
          />
          <TopNav route={route} go={go} language={user.preferences?.language} />

          <div className="main">
            <div className="scroll">
              <AnimatePresence mode="wait">
                <motion.div
                  key={route}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                >
                  {route === "dashboard" && summary && (
                    <DashboardView
                      user={user}
                      summary={summary}
                      accounts={accounts}
                      allTransactions={transactions}
                      wallpaperCss={wallpaperCss}
                      go={go}
                      openAddTx={() => setTxModal("new")}
                    />
                  )}
                  {route === "transactions" && (
                    <TransactionsView
                      transactions={transactions}
                      accounts={accounts}
                      categories={categories}
                      currency={currency}
                      wallpaperCss={wallpaperCss}
                      externalSearch={searchQuery}
                      onExternalSearchChange={setSearchQuery}
                      onOpenAdd={() => setTxModal("new")}
                      onOpenEdit={(t) => setTxModal(t)}
                      onDuplicate={async (t) => {
                        await api.duplicateTransaction(t.id);
                        await refreshWorkspace();
                        showToast("Transaction duplicated");
                      }}
                      onDelete={async (t) => {
                        await api.deleteTransaction(t.id);
                        await refreshWorkspace();
                        showToast("Transaction deleted");
                      }}
                      onImported={async (msg) => {
                        await refreshWorkspace();
                        showToast(msg);
                      }}
                    />
                  )}
                  {route === "accounts" && (
                    <AccountsView
                      accounts={accounts}
                      transactions={transactions}
                      currency={currency}
                      wallpaperCss={wallpaperCss}
                      onChanged={async (msg) => {
                        await refreshWorkspace();
                        showToast(msg);
                      }}
                      onError={showErrorToast}
                    />
                  )}
                  {route === "budgets" && (
                    <BudgetsView
                      budgets={budgets}
                      categories={categories}
                      transactions={transactions}
                      currency={currency}
                      wallpaperCss={wallpaperCss}
                      onChanged={async (msg) => {
                        await refreshWorkspace();
                        showToast(msg);
                      }}
                      onError={showErrorToast}
                    />
                  )}
                  {route === "reports" && (
                    <ReportsView
                      currency={currency}
                      wallpaperCss={wallpaperCss}
                      toast={showToast}
                    />
                  )}
                  {route === "settings" && (
                    <SettingsView
                      user={user}
                      categories={categories}
                      notifications={notifications}
                      onUserUpdated={(u, msg) => {
                        setUser(u);
                        showToast(msg);
                      }}
                      onCategoriesChanged={async (msg) => {
                        await refreshWorkspace();
                        showToast(msg);
                      }}
                      onError={showErrorToast}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {txModal && (
            <TransactionFormModal
              accounts={accounts}
              categories={categories}
              currency={currency}
              initial={txModal === "new" ? null : txModal}
              onClose={() => setTxModal(null)}
              onSaved={async (msg) => {
                setTxModal(null);
                await refreshWorkspace();
                showToast(msg);
              }}
            />
          )}

          {notifOpen && (
            <NotificationsDrawer
              notifications={notifications}
              onClose={() => setNotifOpen(false)}
            />
          )}
        </div>
      )}
    </AppToastProvider>
  );
}
