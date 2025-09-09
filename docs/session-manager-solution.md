# Session manager solution — Docker + Postgres + Redis

This document describes a recommended implementation for persisting chat sessions using a containerized stack: the application running inside a Docker image, backed by PostgreSQL for durable relational storage and Redis for hot/session cache and locks.

The goal: provide a reproducible local/dev environment (via Docker Compose) and an easy migration path to managed production Postgres later.

## Goals / requirements
- Durable storage of full conversation transcripts and metadata
- Fast lookup for active sessions and locking to avoid concurrent writer conflicts
- Easy local setup for development and testing (single `docker-compose up`)
- Clear migration path from SQLite or other storage
- Secure handling of secrets and retention policies

## Architecture overview

- app (node) — the TypeScript app built into `dist/` (multi-stage Dockerfile)
- postgres — durable relational DB storing sessions, messages, users, and metadata
- redis — fast key-value store used for active sessions, TTLs, locks, and pub/sub for background workers

Flow (high level):

1. Adapter receives inbound message → resolve session (look in Redis, fallback to Postgres)
2. Persist inbound message to Postgres (transactionally) and update session row
3. Update Redis active session index and lastActivity TTL
4. Send message to Mastra; when response arrives persist outbound message and update stats
5. Background tasks (optional): compact old sessions, archive, retention cleanup

## File / schema notes (short)

- `sessions` table: id (uuid), platform, platform_conversation_id, user_id, status, created_at, last_activity, metadata (jsonb)
- `messages` table: id (uuid), session_id (fk), direction (inbound/outbound), sender_id, content_text, content_type, attachments (jsonb), created_at, mastra_request_id, status, metadata (jsonb)
- Indexes: sessions(platform, platform_conversation_id), messages(session_id, created_at)

Keep attachments in object storage (S3/MinIO) and store references in `attachments` JSON.

## Dockerfile (skeleton)

Use a multi-stage build: compile TypeScript in a build stage and produce a minimal runtime image.

```
# syntax=docker/dockerfile:1
FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm i -g pnpm
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
USER node
CMD ["node", "dist/index.js"]
```

Notes:
- If you use `ts-node` in development, add a `dev.Dockerfile` or use `volumes` in Compose to mount source for hot reload.

## docker-compose.yml example

This compose file is a starting point for development and local testing.

```
version: '3.8'
services:
  app:
    build: .
    image: agoric-chat-bridge:dev
    env_file: .env
    environment:
      - DATABASE_URL=postgres://postgres:password@postgres:5432/agoric
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    ports:
      - "3000:3000"
    volumes:
      - ./:/app # dev convenience; remove in prod

  postgres:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: agoric
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redisdata:/data

volumes:
  pgdata:
  redisdata:
```

Notes:
- Do not use these default passwords in production. Use environment variables or Docker secrets.
- The `env_file` will inject other runtime variables from your repo `.env` (make sure you exclude `.env` from VCS).

## Migrations

- Use a migration tool (recommended: Prisma Migrate, Knex, or TypeORM migrations). Add migrations to `migrations/` and run them during startup or CI.
- In Compose, you can add a small init step or a command that runs `pnpm migrate` before launching the app. Example pattern in production: entrypoint script that runs migrations then `node dist/index.js`.

## Config & environment variables (suggested)

- `DATABASE_URL` — Postgres connection string
- `REDIS_URL` — Redis connection string
- `MASTRA_ENDPOINT`, `MASTRA_API_KEY`, etc. — existing Mastra configs
- `SESSION_TTL_SECONDS` — TTL for active sessions in Redis
- `ATTACHMENT_BUCKET` — object storage bucket name

## Development vs Production differences

- Development:
  - Mount source into container for hot reload
  - Use local Postgres and Redis from Compose
  - Use simpler credentials and local MinIO if you want S3 emulation

- Production:
  - Use managed Postgres (RDS/GCP Cloud SQL) or provisioned Postgres cluster
  - Use Redis managed service or cluster
  - Use Docker images but orchestrate with Kubernetes or deploy service on a VM/container service
  - Use Docker secrets / environment injection for credentials and do not mount source

## Migration path from SQLite

1. Implement schema and migrations targeting Postgres types (use UUID PKs and jsonb for metadata).
2. Create a migration that prepares Postgres schema.
3. Export current SQLite data (CSV/JSON) and import into Postgres mapping types correctly. For small datasets you can use `sqlite3` to dump rows and `psql` to import.
4. Validate counts and sample transcripts in staging before cutting over.

## Operational considerations

- Backups: schedule `pg_dump` or snapshot the volume; test restores.
- Health & readiness: expose `/health` endpoint and use Compose/Kubernetes healthchecks.
- Security: use TLS for any production DB connections; do not commit `.env`.
- Scaling: keep app stateless; use multiple replicas and a load balancer. Postgres can be scaled vertically or moved to managed service.

## Where to integrate in codebase

- Resolve and persist sessions in `ChatIntegration.initializePlatforms()` / `handleMessage()` — persist inbound message before calling Mastra.
- Use Redis for session lookup/locks in `TelegramAdapter.handleTelegramMessage` and adapters' `sendMessage` paths.
- Centralize DB access in a `session-repo` module to make future migration easier.

## Quick start (developer)

1. Copy `.env.example` to `.env` and set `DATABASE_URL` and `REDIS_URL` appropriately.
2. Start compose: `docker compose up --build`
3. Run migrations: `pnpm migrate` (or use the entrypoint that runs migrations)
4. Start app: `pnpm start` (or the container runs it automatically)

## Next steps I can implement for you
- Add `Dockerfile` and `docker-compose.yml` file(s) to repo (I can create them).
- Add example migration and a `session-repo` interface scaffold.
- Add an entrypoint script that runs migrations before startup.

---
Document created to help implement session management using Docker + Postgres + Redis.
