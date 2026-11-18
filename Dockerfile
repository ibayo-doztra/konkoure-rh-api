# API and worker share this image (docs/backend/11 §2).
# Worker: docker run <image> node ace.js queue:work
FROM node:24-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@12.21.0 --activate

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tools ./tools
RUN pnpm install --frozen-lockfile
COPY . .
RUN node ace build

FROM base AS runtime
ENV NODE_ENV=production TZ=UTC
COPY --from=build /app/build ./
COPY pnpm-workspace.yaml ./
COPY tools ./tools
RUN pnpm install --prod --frozen-lockfile && pnpm store prune
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app
EXPOSE 3333
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3333}/health" || exit 1
CMD ["node", "bin/server.js"]
