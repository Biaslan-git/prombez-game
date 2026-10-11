import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 5"], viewport: { width: 360, height: 740 } } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  // Нужны собранное приложение (npm run build) и БД с импортированным тестовым банком (npm run import:sample).
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `node .next/standalone/server.js`,
        env: { PORT: String(PORT), HOSTNAME: "127.0.0.1" },
        url: `http://localhost:${PORT}/api/health`,
        reuseExistingServer: !process.env.CI,
      },
});
