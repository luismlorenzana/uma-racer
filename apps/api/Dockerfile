# Build from the repo root:
#   docker build --secret id=npm_token,env=NODE_AUTH_TOKEN -f apps/api/Dockerfile -t racer-api .
# The secret is a token with read:packages, for @luismlorenzana/* on GitHub Packages; it never lands in a layer.
# Multi-stage, as in uma-rpg: install the workspace, build the domain package (CJS) and the API, then ship a
# self-contained image. The API imports @racer/domain directly (rearchitecture/08 step 1.1), so there are no copies.

FROM node:22-slim AS builder
RUN corepack enable
WORKDIR /repo

# Workspace manifests first (better layer caching). All package.json files are needed
# for a valid workspace against the frozen lockfile, even though only the api is built.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/race/package.json packages/race/package.json

RUN --mount=type=secret,id=npm_token NODE_AUTH_TOKEN="$(cat /run/secrets/npm_token)" \
    pnpm install --filter @racer/api... --frozen-lockfile

COPY packages/domain packages/domain
COPY apps/api apps/api
RUN pnpm --filter @racer/domain build && pnpm --filter @racer/api build
# Standalone deploy dir: package files + pruned production node_modules (the domain package comes along built).
RUN --mount=type=secret,id=npm_token NODE_AUTH_TOKEN="$(cat /run/secrets/npm_token)" \
    pnpm --filter @racer/api --prod deploy --legacy /out

FROM node:22-slim AS runtime
ENV NODE_ENV=production
ENV PORT=8080
WORKDIR /app
COPY --from=builder /out ./
EXPOSE 8080
CMD ["node", "dist/main.js"]
