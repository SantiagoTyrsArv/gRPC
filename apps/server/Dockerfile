# syntax=docker/dockerfile:1
#
# Imagen del backend. El contexto de build es la RAÍZ del monorepo, porque el
# servidor necesita `proto/` y `packages/proto-gen`:
#   docker build -f apps/server/Dockerfile -t typerace-server .

ARG NODE_VERSION=24-alpine

# ---------- base: Node + pnpm (versión fijada en package.json) ----------
FROM node:${NODE_VERSION} AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

# ---------- build: instala, genera el código proto y compila ----------
FROM base AS build
# Primero solo los manifiestos, para aprovechar la caché de capas.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/proto-gen/package.json packages/proto-gen/
COPY apps/server/package.json apps/server/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts \
      --filter @typerace/server... --filter typerace-grpc

COPY buf.yaml buf.gen.yaml tsconfig.base.json ./
COPY proto proto
COPY packages/proto-gen packages/proto-gen
COPY apps/server apps/server

RUN pnpm --filter @typerace/proto-gen build \
 && pnpm --filter @typerace/server build \
 # Paquete autocontenido solo con dependencias de producción.
 && pnpm --filter @typerace/server deploy --prod --legacy /out

# ---------- runtime: imagen mínima, usuario sin privilegios ----------
FROM node:${NODE_VERSION} AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080
WORKDIR /app

COPY --from=build --chown=node:node /out/package.json ./
COPY --from=build --chown=node:node /out/node_modules ./node_modules
COPY --from=build --chown=node:node /out/dist ./dist
COPY --from=build --chown=node:node /out/drizzle ./drizzle

USER node
EXPOSE 8080
# Las migraciones se ejecutan aparte (pre-deploy): `node dist/scripts/migrate.js`
CMD ["node", "dist/main.js"]
