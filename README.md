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

### Банк prombez24 (все сферы)

Выгрузка prombez24 (`questions.json` + `catalog.json`, 14 курсов, 301 тест) превращается в файлы импорта
по одному на тест: тест = область, курс = сфера (`lib/courses.ts`, страница `/kurs/{slug}`).

```bash
python3 -I scripts/parsers/prombez24.py --questions questions.json --catalog catalog.json \
  --map data/prombez24/areas.json --out data/raw/prombez24      # 301 файл + _report.json
IMPORT_TOKEN=… npx tsx scripts/upload-banks.ts --dir data/raw/prombez24 --site https://prombez-game.ru --dry-run
IMPORT_TOKEN=… npx tsx scripts/upload-banks.ts --dir data/raw/prombez24 --site https://prombez-game.ru --publish official
```

- **Карта областей** `data/prombez24/areas.json`: код, slug, сфера, раздел, чей банк (`authority`) и параметры экзамена
  для каждого `test_id`. Коды ПБ, Г и В — по порядку тестов в разделе источника; это совпало со всеми 31 областью,
  которые уже были на сайте (Б.8.1.1–Б.8.1.5 стоят в источнике сразу за Б.8.1). У остальных сфер коды свои (ЭБ.1, ОТ.1…).
  Slug после первой загрузки не менять. Новый тест в источнике — новая строка в карте, иначе конвертер остановится.
- **Параметры экзамена** взяты из размера билета источника; время — минута на вопрос (не меньше 10), порог — 90%
  для банков Ростехнадзора и 80% для остальных. Это значения по умолчанию, регламенты по сферам надо сверить.
- **Какие вопросы не попадают:** без отмеченного ответа (`answer_unknown`), без текста и картинки (`image_missing`),
  обрывки (`incomplete`) и ответы, восстановленные без подтверждения (`fixed_by_claude_unverified`, флаг
  `--include-unverified` их включит).
- **Типы вопросов:** все варианты верные и пронумерованы — вопрос на порядок (`kind: order`, номера убираются, варианты
  встают по номерам); все верные и вида «левое --- правое» — на соответствие (`kind: match`). В тренажёре варианты
  нажимают по очереди. Картинки (`image`, data URI) хранятся в `question_images` и отдаются по `/qimg/{id}`.
- **Сопоставление со старыми вопросами.** Если у всех вопросов файла есть `source_id`, импорт узнаёт вопрос по нему,
  а если в БД его ещё нет — по тексту (регистр, пунктуация, ё и хвост «Выберите правильный вариант ответа» не важны).
  Узнанный вопрос сохраняет номер, slug, страницу и прогресс пользователей; новые получают номера в конце области.
  `--dry-run` (и `dryRun=1` у эндпоинта) делает импорт с откатом транзакции и показывает, сколько узнано и сколько уйдёт.
- `--publish official` открывает области, у которых указан официальный банк (Ростехнадзор, Минтруд); остальные
  загружаются скрытыми, их можно открыть позже тем же скриптом с `--publish all` или `--only slug1,slug2`.

### Загрузка банка на работающий сайт

База на проде наружу не открыта, поэтому банк загружается через защищённый эндпоинт. Он использует ту же логику,
что и скрипт (`lib/import-db.ts`). Нужна переменная `IMPORT_TOKEN`; без неё эндпоинт отвечает 404.

```bash
T=<IMPORT_TOKEN>; URL=https://prombez-game.ru/api/admin/import

# 1. проверка без записи
curl -X POST "$URL?area=a1&dryRun=1" -H "Authorization: Bearer $T" --data-binary @data/raw/a1.json
# 2. загрузка (область остаётся скрытой, пока не передан publish=1)
curl -X POST "$URL?area=a1&version=47-рп" -H "Authorization: Bearer $T" --data-binary @data/raw/a1.json
# 3. состояние областей, включая скрытые
curl "$URL" -H "Authorization: Bearer $T"
# 4. публикация (повторная загрузка того же файла с publish=1 идемпотентна)
curl -X POST "$URL?area=a1&publish=1" -H "Authorization: Bearer $T" --data-binary @data/raw/a1.json
```

Коды ответов: 401 неверный токен, 400 плохие параметры или JSON, 422 файл не прошёл проверку (список ошибок с
номерами вопросов), 409 код области уже занят другим slug, 413 тело больше 40 МБ. После записи кэш страниц
сбрасывается сам.

## Деплой (Dokploy)

1. Приложение типа Dockerfile из этого репозитория (ветка `main`), порт 3000, домен `prombez-game.ru` (Traefik выпустит сертификат).
2. **Build-аргументы** (попадают в клиентский код и статические страницы; после изменения нужна пересборка):
   `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_YM_ID`, `NEXT_PUBLIC_ADS_ENABLED`, `NEXT_PUBLIC_RSYA_BLOCK_*`,
   `NEXT_PUBLIC_FEEDBACK_EMAIL`, `YANDEX_VERIFICATION`, `GOOGLE_SITE_VERIFICATION`. В Dokploy: Environment → Build-time Arguments.
3. **Runtime-переменные**: `DATABASE_URL`, `REVALIDATE_SECRET`, `IMPORT_TOKEN` (и `YANDEX_VERIFICATION` на всякий случай, в обоих местах).
4. Миграции применяются при старте контейнера (`docker-entrypoint.sh`; отключить — `SKIP_MIGRATIONS=1`).
   Healthcheck — `GET /api/health`.
5. Загрузка банков вопросов на прод: через `/api/admin/import` (см. выше). Порт БД наружу не открывается.

Сборке БД не нужна: страницы областей и вопросов генерируются при первом запросе и кэшируются (ISR).

## Эксплуатация

- **Выкатка.** Dokploy → приложение → Deploy. Собирается образ из ветки `main`; после деплоя проверьте `https://prombez-game.ru/api/health`
  (должно вернуть `{"status":"ok","db":"ok"}`). Автодеплой по пушу настраивается флагом `autoDeploy` в приложении.
- **Новая версия банка вопросов.** `POST /api/admin/import` с тем же `area` и новой версией: существующие вопросы обновляются,
  пропавшие деактивируются (страница остаётся с плашкой «вопрос исключён»), slug не меняется, кэш страниц сбрасывается сам.
- **Смена переменных.** Runtime-переменные применяются после перезапуска приложения, build-аргументы — после новой сборки.
- **Восстановление с нуля.** Пустая БД → запуск контейнера применяет миграции → повторная загрузка банка через `/api/admin/import`.
  Прогресс пользователей хранится в их браузерах, на сервере его нет. Резервные копии БД настраиваются в Dokploy
  (Database → Backups, нужен S3-совместимый диск).
- **Секреты.** `IMPORT_TOKEN` и `REVALIDATE_SECRET` генерируются `openssl rand -hex 32`, хранятся только в Dokploy.
  API-ключ Dokploy при компрометации перевыпускается в Settings → Profile → API/CLI.

## Переменные окружения

См. [.env.example](./.env.example). Пустой `NEXT_PUBLIC_YM_ID` отключает Метрику, `NEXT_PUBLIC_ADS_ENABLED=false`
или пустой ID блока — рекламу.

Цели Метрики: `answer_given`, `session_10_done`, `exam_started`, `exam_finished`, `exam_passed`, `search_used`.

## Telegram-бот «Вопрос дня»

Человек нажимает на сайте «Получать вопрос дня», в боте `/start` подписывает его (новому подписчику сначала показывает меню выбора, первый вопрос — после «Готово»), каждый день в 09:00 (МСК) бот присылает викторину (`sendPoll`) из выбранных подписчиком областей, `/settings` — выбор сфер и областей, `/stop` удаляет подписку.
Бот работает на [Telegram Serverless](https://core.telegram.org/bots/serverless): код и база (SQLite) живут у Telegram, серверу сайта до Telegram ходить не нужно. Проект лежит в `bot/`.

- `bot/tgcloud/handlers/message.js` — команды `/start`, `/settings`, `/question`, `/stop`, `/help`; `handlers/callback_query.js` — кнопки меню `/settings`.
  `bot/tgcloud/schema.js` — таблицы `subscribers` (в `areas` — выбранные области, null — А.1) и `questions` (копия вопросов сайта).
- `bot/tgcloud/lib/settings.js` — меню выбора; `lib/catalog.js` — сферы и области для меню (создаёт `scripts/sync-bot.mjs`);
  `lib/pool.js` и `lib/daily.js` — выбор вопроса: у каждого подписчика свой порядок, весь пул проходится без повторов.
  Со страницы вопроса на сайте ссылка ведёт на `/start a_<slug>`: область сразу добавляется к выбору.
- В бота попадают только вопросы с одним верным ответом, без картинок и в лимитах Telegram (`lib/poll-questions.ts`), примерно половина банка.
- Синхронизация с сайтом — workflow «Выкатка бота в Telegram» (`.github/workflows/bot-deploy.yml`): при изменениях бота в `main` и вручную.
  Он скачивает вопросы (`node scripts/sync-bot.mjs fetch`, ручки `GET /api/telegram/areas` и `/api/telegram/questions?area=…`),
  выкладывает код (`tgcloud push`, `migrate --safe`, `webhook sync`) и загружает вопросы в базу бота (`sync-bot.mjs import`).
  **После импорта банка** запустите его вручную: Actions → «Выкатка бота в Telegram» → Run workflow.
- `bot/tgcloud/endpoints/daily.js` — рассылка подписчикам, `endpoints/stats.js` — число подписчиков, `endpoints/importQuestions.js` — приём вопросов от `sync-bot.mjs`.
- Расписание: Serverless не умеет cron, поэтому ежедневно запускает GitHub Actions (`.github/workflows/daily-question.yml`) командой `tgcloud run endpoints/daily`.
  Нужен секрет репозитория `TGCLOUD_TOKEN` (@BotFather → бот → Serverless → CLI Access → Access token). Вручную: вкладка Actions → Run workflow.
  Расписание GitHub берёт из ветки по умолчанию, поэтому она должна быть `main`.

Работа с ботом (токен — только в переменной окружения `TGCLOUD_TOKEN`, в файлы не записывается):

```bash
cd bot && npm install
npm test                                   # тесты логики бота (node --test)
npx tgcloud status                         # что изменилось локально
npx tgcloud push                           # выложить код
npx tgcloud migrate --safe                 # применить изменения схемы БД
npx tgcloud webhook sync                   # привязать вебхук к платформе (после первого push и при новых handlers)
npx tgcloud run endpoints/stats '{}' --ctx '{ initData: { user: { id: 1 } } }'   # число подписчиков
```

На сайте кнопки подписки появляются, если задан build-arg `NEXT_PUBLIC_TELEGRAM_BOT` (username бота без `@`); список вопросов для генератора отдаёт `GET /api/telegram/questions`.
Из окружений без прямого выхода в интернет (песочница, корпоративный прокси) CLI запускайте с `NODE_USE_ENV_PROXY=1`.
