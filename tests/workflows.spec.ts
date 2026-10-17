import { test, expect, login } from "./fixtures.ts";
import AxeBuilder from "@axe-core/playwright";
const save = async (p: import("@playwright/test").Page) => {
  await p
    .getByRole("dialog")
    .getByRole("button", { name: "Сохранить", exact: true })
    .click();
  await expect(p.locator("dialog")).toHaveCount(0);
};
test("Сквозной цикл в браузере: ученик → группа → занятие → абонемент → оплата → явка → остаток", async ({
  page,
  app,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page, app);
  await page.getByRole("link", { name: "Ученики", exact: true }).click();
  await page
    .getByRole("button", { name: "Добавить ученика", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Фамилия и имя")
    .fill("Сквозной Ученик");
  await save(page);
  await page.getByRole("link", { name: "Группы", exact: true }).click();
  await page
    .getByRole("button", { name: "Добавить группу", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Название группы")
    .fill("Сквозная группа");
  await page
    .getByRole("dialog")
    .getByLabel("Предмет", { exact: true })
    .fill("Сквозной курс");
  await save(page);
  await page.getByRole("link", { name: "Ученики", exact: true }).click();
  await page
    .getByRole("button", { name: "Записать в группу", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Ученик", { exact: true })
    .selectOption({ label: "Сквозной Ученик" });
  await page
    .getByRole("dialog")
    .getByLabel("Группа", { exact: true })
    .selectOption({ label: "Сквозная группа" });
  await save(page);
  await page.getByRole("link", { name: "Расписание", exact: true }).click();
  await page
    .getByRole("button", { name: "Добавить занятие", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Название занятия")
    .fill("Сквозное занятие");
  await page
    .getByRole("dialog")
    .getByLabel("Группа", { exact: true })
    .selectOption({ label: "Сквозная группа" });
  await page
    .getByRole("dialog")
    .getByLabel("Начало", { exact: true })
    .fill("00:01");
  await page
    .getByRole("dialog")
    .getByLabel("Окончание", { exact: true })
    .fill("00:30");
  await save(page);
  await page.getByRole("link", { name: "Финансы", exact: true }).click();
  await page
    .getByRole("button", { name: "Добавить тариф", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Название тарифа")
    .fill("Сквозной тариф");
  await page
    .getByRole("dialog")
    .getByLabel("Предмет", { exact: true })
    .fill("Сквозной курс");
  await page.getByRole("dialog").getByLabel("Цена, ₽").fill("1000");
  await page.getByRole("dialog").getByLabel("Количество занятий").fill("4");
  await save(page);
  await page
    .getByRole("button", { name: "Выдать абонемент", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Ученик", { exact: true })
    .selectOption({ label: "Сквозной Ученик" });
  await page
    .getByRole("dialog")
    .getByLabel("Тариф", { exact: true })
    .selectOption({ label: "Сквозной тариф · 1 000,00 ₽" });
  await save(page);
  await page
    .getByRole("button", { name: "Принять оплату", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Абонемент / ученик")
    .selectOption({ label: "Сквозной Ученик · Сквозной тариф" });
  await page.getByRole("dialog").getByLabel("Сумма, ₽").fill("1000");
  await save(page);
  await page.getByRole("link", { name: "Расписание", exact: true }).click();
  const card = page
    .locator("article.lesson")
    .filter({ hasText: "Сквозное занятие" });
  await card
    .getByRole("button", { name: "Отметить явку", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Сквозной Ученик", { exact: true })
    .selectOption("present");
  await save(page);
  await expect(card).toContainText("Завершено");
  await page.reload();
  await page.getByRole("link", { name: "Финансы", exact: true }).click();
  const row = page
    .getByRole("row")
    .filter({ hasText: "Сквозной Ученик" })
    .filter({ hasText: "3 / 4" });
  await expect(row).toContainText("0,00");
  expect(errors).toEqual([]);
});
test("Формы: ошибка времени, сохранение полей, Escape, Tab, возврат фокуса", async ({
  page,
  app,
}) => {
  await login(page, app);
  const trigger = page.getByRole("button", {
    name: "Добавить занятие",
    exact: true,
  });
  await trigger.click();
  await page
    .getByRole("dialog")
    .getByLabel("Название занятия")
    .fill("Несохранённое");
  await page
    .getByRole("dialog")
    .getByLabel("Группа", { exact: true })
    .selectOption("group-0");
  await page
    .getByRole("dialog")
    .getByLabel("Начало", { exact: true })
    .fill("19:00");
  await page
    .getByRole("dialog")
    .getByLabel("Окончание", { exact: true })
    .fill("18:00");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Сохранить", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Окончание");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).toContainText(
    "Закрыть без сохранения",
  );
  await page.getByRole("button", { name: "Продолжить редактирование" }).click();
  await expect(
    page.getByRole("dialog").getByLabel("Название занятия"),
  ).toHaveValue("Несохранённое");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Отмена", exact: true })
    .click();
  await page.getByRole("button", { name: "Не сохранять", exact: true }).click();
  await expect(trigger).toBeFocused();
  await trigger.click();
  const dialog = page.getByRole("dialog");
  for (let i = 0; i < 30; i++) await page.keyboard.press("Tab");
  expect(await dialog.evaluate((e) => e.contains(document.activeElement))).toBe(
    true,
  );
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});
test("Прямые URL, reload, история, поиск, 404 и роль преподавателя", async ({
  page,
  app,
}) => {
  await login(page, app);
  for (const route of [
    "schedule",
    "lessons",
    "students",
    "groups",
    "teachers",
    "finance",
    "analytics",
    "settings",
  ]) {
    await page.goto(app + "/" + route);
    await expect(page.locator("main h1")).toBeVisible();
    await page.reload();
    await expect(page.locator("main h1")).toBeVisible();
  }
  await page.goto(app + "/does-not-exist");
  await expect(page.locator("main h1")).toContainText("404");
  await page.goto(app + "/dashboard");
  await page
    .getByRole("combobox", { name: "Поиск ученика, группы или преподавателя" })
    .fill("Смирнов");
  await page.locator("#search-results").getByRole("option").first().click();
  await expect(page.getByRole("dialog")).toContainText("Смирнов Арсений");
  await page.keyboard.press("Escape");
  await page.goBack();
  await expect(page.getByRole("dialog")).toContainText("Смирнов Арсений");
  await page.goForward();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const context = await page.context().browser()!.newContext();
  const teacher = await context.newPage();
  await login(teacher, app, "teacher");
  await teacher.goto(app + "/finance");
  await expect(
    teacher.getByRole("heading", { name: "Доступ ограничен" }),
  ).toBeVisible();
  expect(
    await teacher.evaluate(async () => {
      const s = await (await fetch("/api/session")).json();
      return (
        await fetch("/api/commands", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": s.csrf,
          },
          body: JSON.stringify({
            revision: 0,
            requestId: crypto.randomUUID(),
            command: {
              type: "settings",
              name: "Подмена",
              timezone: "UTC",
              academicYear: "2026",
              closedThrough: "",
            },
          }),
        })
      ).status;
    }),
  ).toBe(403);
  await context.close();
});
test("Сбой сети после сохранения: повтор той же команды не создаёт дубль", async ({
  page,
  app,
}) => {
  await login(page, app);
  await page.getByRole("link", { name: "Ученики", exact: true }).click();
  await page
    .getByRole("button", { name: "Добавить ученика", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Фамилия и имя")
    .fill("Сетевой Тест");
  let intercepted = false;
  await page.route("**/api/commands", async (route) => {
    if (!intercepted) {
      intercepted = true;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Сохранить", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Нет связи");
  await expect(
    page.getByRole("dialog").getByLabel("Фамилия и имя"),
  ).toHaveValue("Сетевой Тест");
  await save(page);
  await expect(
    page.getByRole("button", { name: "Сетевой Тест", exact: true }),
  ).toHaveCount(1);
});
for (const width of [390, 768, 1280, 1440])
  test("Адаптивность и доступность " + width, async ({ page, app }) => {
    await page.setViewportSize({ width, height: 900 });
    await login(page, app);
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    if (width === 390) {
      await page.getByRole("button", { name: "Открыть навигацию" }).click();
      await page.getByRole("link", { name: "Ученики", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Ученики", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Добавить ученика", exact: true })
        .click();
      expect(
        await page
          .getByRole("dialog")
          .evaluate((e) => e.scrollWidth <= e.clientWidth),
      ).toBe(true);
      await page.keyboard.press("Escape");
    }
    const scan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      scan.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  });
test("Визуальная регрессия главной (локальные шрифты, фиксированные тестовые часы)", async ({
  page,
  app,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page, app);
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot("dashboard.png", {
    fullPage: true,
    animations: "disabled",
  });
});

test("CSV: предварительная проверка, импорт и безопасный вывод XSS-строки", async ({
  page,
  app,
}) => {
  await login(page, app);
  await page.getByRole("link", { name: "Ученики", exact: true }).click();
  await page.getByRole("button", { name: "Импорт CSV", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Содержимое CSV")
    .fill("name;birthDate;contact\n<img src=x onerror=alert(1)>;2012-01-01;");
  await expect(
    dialog.getByRole("button", { name: "Сохранить", exact: true }),
  ).toBeDisabled();
  await dialog
    .getByRole("button", { name: "Проверить импорт", exact: true })
    .click();
  await expect(dialog).toContainText("Готово к импорту: 1");
  await save(page);
  await expect(
    page.getByRole("button", {
      name: "<img src=x onerror=alert(1)>",
      exact: true,
    }),
  ).toHaveCount(1);
  await expect(page.locator("img")).toHaveCount(0);
});

test("Две браузерные сессии: конфликт версии сохраняет поля, повтор не затирает чужой контакт", async ({
  page,
  app,
  browser,
}) => {
  await login(page, app);
  await page.getByRole("link", { name: "Ученики", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: "Ковалев Максим" });
  await row.getByRole("button", { name: "Изменить", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Фамилия и имя")
    .fill("Изменённое имя");
  const context = await browser.newContext();
  const second = await context.newPage();
  await login(second, app, "admin");
  await second.getByRole("link", { name: "Ученики", exact: true }).click();
  await second
    .getByRole("row")
    .filter({ hasText: "Ковалев Максим" })
    .getByRole("button", { name: "Изменить", exact: true })
    .click();
  await second
    .getByRole("dialog")
    .getByLabel("Контакт", { exact: true })
    .fill("kept@example.invalid");
  await save(second);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Сохранить", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("другим сотрудником");
  await expect(
    page.getByRole("dialog").getByLabel("Фамилия и имя"),
  ).toHaveValue("Изменённое имя");
  await save(page);
  await expect(
    page.getByRole("button", { name: "Изменённое имя", exact: true }),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "Изменённое имя", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("kept@example.invalid");
  await context.close();
});
