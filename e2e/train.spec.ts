import { expect, test } from "@playwright/test";

test("главная → сфера → область → ответ → подсветка и объяснение", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Подготовка к аттестации");

  // Главная → карточка сферы → «Начать тренировку» на карточке области.
  await page
    .getByRole("link", { name: /Промышленная безопасность/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/kurs\/prombez$/);
  await page.getByRole("link", { name: "Начать тренировку" }).first().click();
  await expect(page).toHaveURL(/\/[a-z0-9]+\/train$/);

  const answers = page.getByRole("radiogroup", { name: "Варианты ответа" }).getByRole("radio");
  await expect(answers.first()).toBeVisible();
  await answers.first().click();

  await expect(page.getByTestId("verdict")).toBeVisible();
  // Правильный ответ подсвечен в любом случае: выбранный верный или пропущенный.
  await expect(page.locator('[data-state="correct"], [data-state="missed"]')).toHaveCount(1);
  await expect(page.getByTestId("explanation")).toBeVisible();
  await expect(page.getByRole("button", { name: "Дальше" })).toBeVisible();

  // Прогресс переживает перезагрузку.
  await page.reload();
  await expect(page.getByText(/В сессии: 0/)).toBeVisible();
  const stored = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("pg:v1:progress:")));
  expect(stored.length).toBe(1);
});

test("экзамен: старт, ответ, досрочное завершение и результат", async ({ page }) => {
  await page.goto("/a1/exam");
  await page.getByRole("button", { name: "Начать экзамен" }).click();
  await expect(page.getByRole("timer")).toBeVisible();
  // Во время экзамена нет подсветки правильных ответов.
  await page.locator("[role=radio], [role=checkbox]").first().click();
  await expect(page.locator('[data-state="correct"], [data-state="wrong"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Завершить экзамен досрочно" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Завершить" }).click();
  await expect(page.getByTestId("exam-result")).toContainText(/из \d+ верно/);
});

test("SEO-страница вопроса работает без JS", async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto("/a1");
  await page.getByRole("link", { name: /Кто имеет право выдавать/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("наряд-допуск");
  await expect(page.getByText("— правильный ответ")).toBeVisible();
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
  await ctx.close();
});

test("мини-тест под вопросом: 5 ответов → итог и «Поделиться»", async ({ page }) => {
  await page.goto("/a1");
  await page.getByRole("link", { name: /Кто имеет право выдавать/ }).click();
  await expect(page.getByRole("link", { name: "Telegram" }).first()).toBeVisible();

  await page.getByRole("button", { name: "Начать мини-тест" }).click();
  const quiz = page.getByTestId("mini-quiz");
  for (let i = 0; i < 5; i++) {
    // Вопрос на порядок или соответствие: варианты нажимаются все, по очереди.
    const sequence = quiz.locator("button[aria-pressed]");
    const n = await sequence.count();
    if (n > 0) for (let j = 0; j < n; j++) await sequence.nth(j).click();
    else await quiz.locator("[role=radio], [role=checkbox]").first().click();
    const submit = quiz.getByRole("button", { name: "Ответить" });
    if (await submit.isVisible()) await submit.click();
    await expect(quiz.getByTestId("quiz-verdict")).toBeVisible();
    await quiz.getByRole("button", { name: i === 4 ? "Показать результат" : "Дальше" }).click();
  }
  await expect(quiz.getByTestId("quiz-score")).toContainText(/из 5 верно/);
  await expect(quiz.getByRole("link", { name: "Telegram" })).toHaveAttribute("href", /t\.me\/share\/url/);
  // Ответы мини-теста попали в общий прогресс области.
  const stored = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("pg:v1:progress:")));
  expect(stored.length).toBe(1);
});

test("вопрос на порядок: страница с правильным порядком", async ({ page }) => {
  await page.goto("/a1");
  await page.getByRole("link", { name: /шаги тестовой процедуры допуска/ }).click();
  await expect(page.getByText("Правильный порядок:")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Получить тестовый наряд" })).toBeVisible();
});
