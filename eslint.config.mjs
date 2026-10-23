import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "drizzle/**",
      "playwright-report/**",
      "test-results/**",
      "next-env.d.ts",
      "bot/.tgcloud/**",
      "bot/node_modules/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Модули бота на Telegram Serverless: необъявленные имена (например, забытый импорт) падают только на платформе,
    // поэтому ловим их здесь.
    files: ["bot/tgcloud/**/*.js"],
    languageOptions: { globals: { console: "readonly", setTimeout: "readonly" } },
    rules: { "no-undef": "error" },
  },
];

export default config;
