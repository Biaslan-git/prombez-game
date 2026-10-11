# prombez-game.ru

Бесплатный веб-тренажёр для подготовки к аттестации по промышленной безопасности в Ростехнадзоре (ЕПТ):
тренировка с интервальным повторением, шкала готовности, пробный экзамен, работа над ошибками, SEO-страницы вопросов и поиск.

ТЗ: [SPEC.md](./SPEC.md). Стек: Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · PostgreSQL · Drizzle ORM · zod · Vitest · Playwright.

## Быстрый старт

```bash
cp .env.example .env
docker compose up -d db          # локальный Postgres 16
npm install
npm run db:migrate               # миграции из ./drizzle
npm run import:sample            # тестовый банк А.1 на 30 вопросов-заглушек
npm run dev                      # http://localhost:3000
```

Весь стек одной командой (приложение + БД, миграции при старте): `docker compose --profile app up --build`.

## Проверки

```bash
npm run lint && npm run typecheck && npm test && npm run format:check
npm run build && npm run test:e2e   # нужна БД с тестовым банком
```

## Импорт вопросов

```bash
npx tsx scripts/import-questions.ts --area a1 --file data/raw/a1.json --version "2026-xx" [--publish] [--dry-run]
```

- Формат входного JSON — SPEC.md, раздел 9. Дополнительно поддерживаются необязательные поля:
  `area.short_description`, `area.sort_order`, `area.exam` (`questions_count`, `time_limit_min`, `pass_threshold`),
  у вопроса — `explanation` и `explanation_verified`.
- Upsert по `(область, номер)`; вопросы, пропавшие из новой версии, получают `is_active = false` (страница остаётся
  с плашкой «вопрос исключён»). Slug при изменении текста не меняется. Если изменился текст или ответы, флаг
  проверенного объяснения сбрасывается.
- `--publish` открывает область на сайте (новая область по умолчанию скрыта).
- Если заданы `REVALIDATE_SECRET` и `NEXT_PUBLIC_SITE_URL` (или `REVALIDATE_URL`), после импорта сбрасывается ISR-кэш сайта.
- `data/raw/` в git не попадает. Тестовый банк лежит в `data/sample/a1.test.json` — это выдуманные вопросы,
  не официальный банк.

> ⚠️ Параметры экзамена в тестовом банке (20 вопросов, 20 минут, порог 18) — заглушки. Перед запуском
> сверьте их с актуальным регламентом ЕПТ по каждой области (SPEC.md, раздел 13) и передайте в `area.exam`.

## Деплой (Dokploy)

1. Приложение типа Dockerfile из этого репозитория, порт 3000, домен `prombez-game.ru` (Traefik выпустит сертификат).
2. Build-time arguments (встраиваются в клиентский код): `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_YM_ID`,
   `NEXT_PUBLIC_ADS_ENABLED`, `NEXT_PUBLIC_RSYA_BLOCK_*`, `NEXT_PUBLIC_FEEDBACK_EMAIL`.
3. Runtime env: `DATABASE_URL`, `YANDEX_VERIFICATION`, `REVALIDATE_SECRET`.
4. Миграции применяются при старте контейнера (`docker-entrypoint.sh`; отключить — `SKIP_MIGRATIONS=1`).
   Healthcheck — `GET /api/health`.
5. Импорт на проде: `docker build --target tools -t prombez-tools .` и
   `docker run --rm -e DATABASE_URL=… -v $PWD/data:/app/data prombez-tools npx tsx scripts/import-questions.ts …`,
   либо локально с `DATABASE_URL` прод-базы.

Сборке БД не нужна: страницы областей и вопросов генерируются при первом запросе и кэшируются (ISR).

## Переменные окружения

См. [.env.example](./.env.example). Пустой `NEXT_PUBLIC_YM_ID` отключает Метрику, `NEXT_PUBLIC_ADS_ENABLED=false`
или пустой ID блока — рекламу.

Цели Метрики: `answer_given`, `session_10_done`, `exam_started`, `exam_finished`, `exam_passed`, `search_used`.
