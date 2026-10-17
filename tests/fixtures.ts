import { test as base, expect } from "@playwright/test";
import { Store } from "../server/store.ts";
import { createApp } from "../server/http.ts";
export const NOW = new Date("2026-10-18T12:00:00Z");
export const test = base.extend<{ app: string }>({
  app: async ({}, use) => {
    const store = new Store(":memory:", true, NOW);
    const server = createApp(store, { now: () => NOW });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const { port } = server.address() as { port: number };
    try {
      await use("http://127.0.0.1:" + port);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((r, e) =>
        server.close((err) => (err ? e(err) : r())),
      );
      store.close();
    }
  },
});
export { expect };
export async function login(
  page: import("@playwright/test").Page,
  app: string,
  role = "director",
) {
  await page.clock.install({ time: NOW });
  await page.goto(app);
  await page.getByLabel("Email", { exact: true }).fill(role + "@demo.local");
  await page.getByLabel("Пароль", { exact: true }).fill("Demo-School-2026!");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Главная", exact: true }),
  ).toBeVisible();
}
