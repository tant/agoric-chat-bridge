# Migration plan — Move HTTP layer to Fastify

This document outlines a step-by-step plan to add a Fastify HTTP layer to the project and integrate it with the existing ChatIntegration and adapters. It focuses on the logical tasks and order of operations — no code will be added here, only the actions to perform and decisions to make.

Checklist (high level)
- Add Fastify bootstrap and basic server lifecycle (start/stop)
- Add health endpoint and readiness checks
- Implement webhook handlers for platforms that support webhooks
- Add middleware: request-id, body size limit, signature verification
- Wire ChatIntegration instance into route handlers
- Ensure adapter polling remains available and configurable
- Add graceful shutdown and signal handling
- Add telemetry hooks (metrics/tracing) and logging integration
- Add tests: unit for handlers, e2e smoke test

Detailed plan (ordered)

1) Preparation and design
- Review existing `ChatIntegration` and adapter public API to identify init/shutdown points and the minimal interface needed by HTTP handlers (e.g., `handleMessage`, `sendMessage`, `getAdapter`).
- Decide configuration model: single FASTIFY server handling all webhooks, or one server per platform (prefer single server with route namespace: `/webhook/telegram`, `/webhook/zalo`, ...).
- Decide running modes: polling (existing) vs webhook (new). Make this configurable via environment variables (e.g., `TELEGRAM_WEBHOOK_ENABLED=true|false`).

2) Add Fastify bootstrap (app lifecycle)
- Create a Fastify bootstrap that can:
  - read configuration (env) and set server port
  - create and configure Fastify instance with sensible defaults (JSON body limit, logger config)
  - wire lifecycle hooks: onReady, onClose to start/stop `ChatIntegration`
  - support registering routes from separate router modules for modularity
- Ensure bootstrap initializes `ChatIntegration` before listening, or if ChatIntegration initialization is async, start server only after it is healthy.

3) Health & readiness
- Add `/health` and `/ready` endpoints.
  - `/health` should report basic process status (uptime, memory).
  - `/ready` should verify dependencies: DB (if present), Redis (if present), Mastra health (call `MastraClient.healthCheck()`), and ChatIntegration state.
- Use these endpoints for container orchestrator probes and local checks.

4) Request safety & middleware
- Add a request-id generation middleware: create or forward `X-Request-Id` header, attach to logs and pass downstream in context.
- Configure body limits and parsers; reject overly large payloads to avoid DoS vectors.
- Add signature/verification middleware for each platform that supports it (e.g., verify Telegram secret, Line signature, WhatsApp HMAC). Validation rules per-platform kept in adapters or in dedicated middleware.
- Add IP whitelisting option (configurable) if platform publishes source IP ranges.

5) Webhook handlers (per platform)
- For each platform that supports webhooks, create a handler that:
  - Validates signature and payload schema
  - Extracts message(s) into the project `Message` model
  - Deduplicates messages early using platform message ID to avoid double processing
  - Enqueues or directly processes messages via `ChatIntegration.handleMessage()` depending on expected synchronous behaviour
  - Responds quickly (200 OK) after enqueueing to avoid retries. If synchronous reply required, respond with minimal acknowledgement and let background worker send outbound message.
- Keep platform-specific parsing in adapters or dedicated router modules; handlers should be thin and delegate to adapters or translator functions.

6) Polling support
- Preserve existing polling code paths in adapters (Telegram polling etc.).
- Allow `TELEGRAM_WEBHOOK_ENABLED=false` to keep polling active for local dev or platforms that prefer it.
- For polling in multi-instance deployment, ensure leader election or distributed lock to avoid duplicate polling (use Redis-based lock or single-instance configuration).

7) Concurrency, queueing and workers
- Decide on immediate process model: do webhook handlers call `ChatIntegration.handleMessage()` synchronously, or enqueue to a worker queue (recommended for scale)?
- If enqueuing is used:
  - Use Redis lists or a proper queue (BullMQ) to accept tasks.
  - Workers pop tasks and call `ChatIntegration.handleMessage()`; on success, workers persist outbound messages and send via adapter.
  - Webhook handler responds 200 as soon as task enqueued; include request-id to track.
- For synchronous path (small traffic), ensure handler has request timeout and that long-running Mastra calls don't block the HTTP response loop — use optimistic timeouts and return polite fallback messages if needed.

8) Error handling & idempotency
- All handlers must be idempotent: dedupe on platform message ID and record processing state in DB/Redis.
- Distinguish transient vs permanent errors: transient -> schedule retry with backoff; permanent -> log and store failure state.
- Capture exceptions globally and map to appropriate HTTP responses (400 for malformed, 401 for auth, 500 for server errors). Use consistent JSON error shape.

9) Logging, metrics, tracing
- Integrate Fastify logger with existing `fun-logger` or a compatible logger.
- Add metrics hooks around request handling and Mastra calls: request count, latency histogram, error count, queue sizes.
- Wire tracing (optional OpenTelemetry): propagate request-id and Mastra request ids so traces correlate across handlers and downstream calls.

10) Security considerations
- Enforce HTTPS in production deployment of webhooks. Suggest using a reverse proxy (nginx) or platform LB with TLS termination; for local dev use `ngrok`.
- Keep tokens and credentials in environment or secrets manager; never log credentials.
- Validate and sanitize incoming content (avoid injection into logs/db without escaping).

11) Graceful shutdown
- On SIGINT/SIGTERM:
  - Stop accepting new requests (Fastify `close`)
  - Drain workers and finish in-flight `ChatIntegration` requests (with timeout)
  - Persist any in-memory queues or state if necessary
  - Exit with appropriate code

12) Tests
- Unit tests for each webhook handler (payload parsing, signature validation, dedupe logic).
- Integration/e2e test that boots server, sends a sample webhook payload, asserts message persisted and response processed (can use Mastra mock).
- Load test plan if expected traffic is non-trivial (simulate webhooks & Mastra latency)

13) Documentation & developer ergonomics
- Document how to run server locally (ngrok guidance) and how to switch between polling and webhook modes.
- Update README with new endpoints and env vars.
- Add example curl payloads and testing checklist.

14) Rollout strategy
- Deploy behind a feature flag in Compose: `FASTIFY_ENABLED=true` and `TELEGRAM_WEBHOOK_ENABLED=true`.
- Start with one platform (Telegram) and run for limited users; monitor metrics and logs.
- Gradually add webhooks for other platforms and disable polling only when webhook stable.

15) Backwards compatibility
- Keep current CLI entrypoint working (existing `index.ts`) during migration; start Fastify as optional feature so the app can be run in previous mode.
- Make changes incremental: implement webhook handlers without removing polling; only flip off polling per platform after webhook tested.


## Integration points in repo (where to place logic)
- Bootstrap: `src/http-server.ts` or `src/main-http.ts` (new)
- Routes/handlers: `src/adapters/<platform>/webhook-handler.ts` or `src/adapters/<platform>/controller.ts`
- Middleware: `src/http/middleware/*` for request-id, signatures, validation
- Queue workers: `src/worker/*` for background processing
- Config: `src/config/config.ts` extend to include webhook flags and Fastify config


## Acceptance criteria (done when)
- Fastify server starts and exposes `/health` and platform webhook routes
- Webhook handler for at least one platform (Telegram) parses payload and enqueues a task or calls `ChatIntegration.handleMessage()` and persists message
- Polling remains available and switchable via configuration
- Tests covering webhook parsing and end-to-end path with Mastra mock
- Graceful shutdown implemented


---

Document created as a migration plan to Fastify. Follow items in order and implement tests/metrics as you go.
