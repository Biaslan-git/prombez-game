# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* встраиваются в клиентский код при сборке — передавайте их как build args (в Dokploy: Build-time Arguments).
ARG NEXT_PUBLIC_SITE_URL=https://prombez-game.ru
ARG NEXT_PUBLIC_YM_ID=
ARG NEXT_PUBLIC_ADS_ENABLED=false
ARG NEXT_PUBLIC_RSYA_BLOCK_HOME=
ARG NEXT_PUBLIC_RSYA_BLOCK_AREA=
ARG NEXT_PUBLIC_RSYA_BLOCK_TRAIN=
ARG NEXT_PUBLIC_RSYA_BLOCK_QUESTION=
ARG NEXT_PUBLIC_RSYA_BLOCK_QUESTION_BOTTOM=
ARG NEXT_PUBLIC_FEEDBACK_EMAIL=support@prombez-game.ru
ENV NEXT_TELEMETRY_DISABLED=1
# БД при сборке не нужна: страницы областей и вопросов собираются по запросу (ISR).
RUN DATABASE_URL= npx next build

# Образ для служебных команд (импорт вопросов): docker build --target tools -t prombez-tools .
FROM builder AS tools
CMD ["npx", "tsx", "scripts/import-questions.ts", "--help"]

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S nodejs -g 1001 && adduser -S nextjs -u 1001 -G nodejs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# Миграции при старте контейнера: SQL-файлы и полный drizzle-orm/postgres (в standalone они урезаны трассировкой).
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/scripts/migrate.mjs ./scripts/migrate.mjs
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/postgres ./node_modules/postgres
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh

USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" >/dev/null || exit 1
ENTRYPOINT ["sh", "./docker-entrypoint.sh"]
CMD ["node", "server.js"]
