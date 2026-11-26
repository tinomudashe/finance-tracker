"""Locust load-testing suite targeting read-heavy endpoints (Dashboard & Transactions)."""
from locust import HttpUser, between, task


class FinanceTraceUser(HttpUser):
    wait_time = between(0.2, 1.0)
    token: str = ""

    def on_start(self) -> None:
        res = self.client.post("/api/auth/demo")
        if res.status_code == 200:
            self.token = res.json()["access_token"]

    @property
    def auth_headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.token}"} if self.token else {}

    @task(3)
    def view_dashboard(self) -> None:
        self.client.get("/api/dashboard/summary", headers=self.auth_headers)

    @task(4)
    def list_transactions(self) -> None:
        self.client.get("/api/transactions?page=1&limit=50", headers=self.auth_headers)

    @task(2)
    def view_budgets(self) -> None:
        self.client.get("/api/budgets", headers=self.auth_headers)

    @task(1)
    def view_reports(self) -> None:
        self.client.get("/api/reports/analytics?period=3m", headers=self.auth_headers)
