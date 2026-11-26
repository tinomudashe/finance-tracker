import { useCallback, useEffect, useState } from "react";
import { api } from "./api/client";
import { HeaderBar, Toast, TopNav } from "./components/Shell";
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
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2800);
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

  const handleCycleLanguage = async () => {
    if (!user) return;
    const order: Preferences["language"][] = ["en", "pl", "fr"];
    const next = order[(order.indexOf(user.preferences?.language || "en") + 1) % order.length];
    const updated = await api.updateProfile({
      preferences: { ...user.preferences, language: next },
    });
    setUser(updated);
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

  if (!user) {
    return <AuthView onAuth={(u) => setUser(u)} />;
  }

  const currency = user.preferences?.currency || "USD";

  return (
    <div className="app">
      <HeaderBar
        user={user}
        searchQuery={searchQuery}
        onSearchChange={handleGlobalSearch}
        onBell={() => setNotifOpen(true)}
        hasAlerts={notifications.some((n) => n.kind === "warn")}
        onCycleLanguage={handleCycleLanguage}
        onGoSettings={() => go("settings")}
        onLogout={handleLogout}
      />
      <TopNav route={route} go={go} language={user.preferences?.language} />

      <div className="main">
        <div className="scroll">
          {route === "dashboard" && summary && (
            <DashboardView
              user={user}
              summary={summary}
              accounts={accounts}
              allTransactions={transactions}
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
              onChanged={async (msg) => {
                await refreshWorkspace();
                showToast(msg);
              }}
              onError={showToast}
            />
          )}
          {route === "budgets" && (
            <BudgetsView
              budgets={budgets}
              categories={categories}
              transactions={transactions}
              currency={currency}
              onChanged={async (msg) => {
                await refreshWorkspace();
                showToast(msg);
              }}
              onError={showToast}
            />
          )}
          {route === "reports" && <ReportsView currency={currency} toast={showToast} />}
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
              onError={showToast}
            />
          )}
        </div>
      </div>

      {txModal && (
        <TransactionFormModal
          accounts={accounts}
          categories={categories}
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

      {toastMsg && <Toast msg={toastMsg} />}
    </div>
  );
}
