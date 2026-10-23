# prombez-game.ru

Тренажёр для подготовки к аттестации по промбезопасности. Полное ТЗ — [SPEC.md](./SPEC.md); работаем по этапам из раздела 11.

## Команды

- `npm run dev` — разработка (нужен Postgres, см. README)
- `npm run lint && npm run typecheck && npm test && npm run format:check` — должно проходить после каждого изменения
- `npm run build && npm run test:e2e` — e2e (нужна БД с тестовым банком: `npm run db:migrate && npm run import:sample`)
- `npm run db:generate` — новая миграция после правки `lib/db/schema.ts`

## Устройство

- `lib/progress` — Лейтнер, готовность, выбор следующего вопроса, серия дней, хранилище. Чистые функции, всё покрыто тестами.
  UI ходит в хранилище только через `ProgressStore` (`storage.ts`), чтобы потом подменить на серверное.
- `lib/exam` — билет, подсчёт результата, таймер. Чистые функции с тестами.
- `lib/data.ts` — все запросы к БД для страниц. Импорт банков: `lib/import.ts` (разбор и проверка), `lib/import-db.ts` (запись в БД),
  `scripts/import-questions.ts` (CLI) и `POST /api/admin/import` (по токену `IMPORT_TOKEN`). `scripts/parsers/` — конвертеры источников в JSON.
- Параметры экзамена (число вопросов, время, порог) — в таблице `areas`, не в коде.
- Тренировка/экзамен/ошибки — клиентские компоненты (`components/Trainer.tsx`, `ExamRunner.tsx`), `noindex`.
  SEO-страницы вопросов — серверные, ISR, работают без JS.
- SEO: одинаковые вопросы разных областей склеиваются через canonical (`lib/canonical.ts`, главная — область с первым кодом, А.1 раньше Б), копии не попадают в sitemap. Темы (`lib/topics.ts`) — страницы `/[area]/t/[topic]`, считаются по ключевым словам. После импорта/деплоя: `npm run indexnow` (IndexNow для Яндекса и Bing).
- Telegram-бот «Вопрос дня» — отдельный проект `bot/` на Telegram Serverless (не на нашем сервере: он не достаёт до Telegram). После импорта банка: `node scripts/build-bot-questions.mjs && cd bot && npx tgcloud push`. Подробности — README, раздел «Telegram-бот».
- Реклама: только через `<AdSlot id=… />`, никогда в экзамене и не между вопросом и ответом.

## Соглашения

- Тексты интерфейса и комментарии — по-русски.
- Slug вопроса после первого импорта не меняется (SEO).
- Прод собирается из ветки `main` (Dokploy, приложение `prombez-game`); порядок выкатки и эксплуатации — в README, раздел «Эксплуатация».
