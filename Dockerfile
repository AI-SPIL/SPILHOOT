# ---- BASE ----
FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.17.1 --activate

# ---- BUILDER ----
FROM base AS builder
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/common/package.json ./packages/common/
COPY packages/web/package.json ./packages/web/
COPY packages/socket/package.json ./packages/socket/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY . .

RUN pnpm build

# ---- RUNNER ----
FROM node:24-alpine AS runner

WORKDIR /app

RUN apk add --no-cache nginx supervisor vips-dev
RUN corepack enable && corepack prepare pnpm@10.17.1 --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/common/package.json ./packages/common/
COPY packages/socket/package.json ./packages/socket/

# Install runtime deps through pnpm lockfile for reproducible builds.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --prod --filter @rahoot/socket

COPY docker/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/supervisord.conf /etc/supervisord.conf

COPY --from=builder /app/packages/web/dist /app/web
# COPY --from=builder /app/packages/socket/dist/index.mjs /app/socket/index.mjs
COPY --from=builder /app/packages/socket/dist/index.mjs /app/packages/socket/dist/index.mjs

EXPOSE 3000

CMD ["supervisord", "-c", "/etc/supervisord.conf"]
