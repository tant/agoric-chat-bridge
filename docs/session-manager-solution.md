# Session manager solution — Docker + Postgres + Redis

This document describes a recommended implementation for persisting chat sessions using a **speed-optimized, "Fire-and-Forget"** approach. The goal is to prioritize user response time by decoupling the main message processing flow from the database logging flow.

The stack remains the same: the application runs inside a Docker image, backed by PostgreSQL for durable storage and Redis for caching and queuing.

## Goals / Requirements
- **Fast Response Time**: Minimize latency for the end-user.
- **Asynchronous Logging**: Persist conversation data without blocking the main thread.
- **Acceptable Data Loss**: Acknowledge that in rare failure scenarios, some log data might be lost.
- Easy local setup and a clear migration path to production.

## Architecture Overview (Parallel Flow)

- **app (node)** — The TypeScript application.
- **postgres** — Durable relational DB for long-term storage.
- **redis** — Used as a fast cache and potentially as a simple message queue for logging jobs.

**Flow (High Level - Speed Optimized):**

1.  **Adapter receives inbound message.**
2.  **Forward to AI & Queue Logging (Parallel)**:
    -   The message is **immediately sent** to the Mastra AI Agent.
    -   Simultaneously, a "log job" (containing the message data) is pushed to an asynchronous handler or a Redis queue.
3.  **Process AI Response**:
    -   When the response arrives from Mastra, it is **immediately sent back** to the user.
    -   Another "log job" for the outbound message is queued asynchronously.
4.  **Background Worker**: A separate process or an async task pulls jobs from the queue and writes them to Postgres. This operation does not affect the user-facing response time.

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

-   **`ChatIntegration.handleMessage()`**: This is the core logic change.
    -   Instead of `await`-ing the database save operation, trigger it as a non-blocking, async task.
    -   Example: `this.sessionRepo.saveMessage(message).catch(err => console.error('Logging failed:', err));`
-   **`session-repo` module**: This module will contain the logic to write to the database. It should handle its own error logging.
-   **Redis Queue (Optional but Recommended)**: For more robust background processing, use a Redis list as a simple queue. A worker can `BRPOP` from the list to process logging jobs reliably.

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
Document updated to reflect a speed-optimized architecture.
