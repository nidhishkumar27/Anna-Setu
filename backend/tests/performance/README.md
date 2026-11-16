# Backend performance tests

This suite uses Autocannon against an in-process Express server bound only to `127.0.0.1`. It starts its own MongoMemoryServer, seeds synthetic records, creates short-lived test JWTs, and shuts down the server and database after each suite. It does not use `server.js`, `MONGODB_URI`, or any external database. The workloads are HTTP `GET` requests only; no benchmark mutates application records.

## Prerequisites and setup

- Node.js and npm compatible with the backend project.
- Backend dependencies installed with `npm install` in `backend/` (Autocannon is a development dependency).
- MongoDB Memory Server must be able to use its configured/downloaded local MongoDB binary. No separately running MongoDB service is required.
- Run from the `backend/` directory. Do not change the target to a production or remote host.

Each Jest suite creates an isolated temporary database and binds an ephemeral port on loopback. The fixtures are synthetic and contain no real user account data. Cleanup stops only the MongoMemoryServer started by that suite and removes its unique temporary database directory.

## Commands

From `backend/`:

```powershell
npm run test:performance:baseline
npm run test:performance:load
npm run test:performance:stress
npm run test:performance
```

The combined command runs all three performance suites. The regular `npm test` command excludes this directory, so a routine backend test run will not accidentally start load or stress workloads.

## Endpoints and access

All requests use `GET` and expect HTTP 200. Role-protected endpoints use synthetic signed JWTs for fixture users created in the isolated database.

| Endpoint | Access | Baseline | Load | Stress |
| --- | --- | --- | --- | --- |
| `/` | Public | Yes | — | Yes |
| `/api/admin/stats` | Admin | Yes | Yes | Yes |
| `/api/admin/activity` | Admin | Yes | — | — |
| `/api/donor` | Donor | Yes | Yes | — |
| `/api/volunteer/tasks` | Volunteer | Yes | Yes | — |
| `/api/volunteer/stats` | Volunteer | Yes | — | — |
| `/api/receiver/deliveries/upcoming` | Receiver | Yes | Yes | — |
| `/api/receiver/deliveries/history` | Receiver | Yes | — | — |

Data fixture size is configurable, with at most 250 synthetic donations/tasks and 20 activity records. This keeps the test isolated and bounded. The benchmark deliberately excludes write routes.

## Workloads and configuration

Defaults are conservative and can be adjusted through environment variables. Duration is applied separately to each endpoint/run; stress applies it separately at each concurrency level.

| Variable | Default | Allowed range / purpose |
| --- | ---: | --- |
| `PERF_BASELINE_SECONDS` | 2 | 1–3 seconds per endpoint, concurrency 1 |
| `PERF_LOAD_SECONDS` | 3 | 1–4 seconds per endpoint |
| `PERF_LOAD_CONNECTIONS` | 10 | 1–50 concurrent connections |
| `PERF_STRESS_SECONDS` | 2 | 1–3 seconds per endpoint at each level |
| `PERF_STRESS_LEVELS` | `5,10,20` | 1–4 levels, each 1–100 concurrent connections |
| `PERF_FIXTURE_RECORDS` | 20 | 1–250 synthetic donations/tasks |
| `PERF_MAX_P99_MS` | 3000 | Baseline/load configurable p99 ceiling |
| `PERF_MAX_ERROR_RATE_PCT` | 1 | Baseline/load configurable error ceiling |
| `PERF_STRESS_MAX_P99_MS` | 5000 | Stress configurable p99 ceiling |
| `PERF_STRESS_MAX_ERROR_RATE_PCT` | 5 | Stress configurable error ceiling |
| `PERF_REPORT_DIR` | `tests/performance/reports` | Report output directory, relative to `backend/` unless absolute |

Example PowerShell configuration for a longer, still bounded load run:

```powershell
$env:PERF_LOAD_SECONDS = '4'
$env:PERF_LOAD_CONNECTIONS = '15'
npm run test:performance:load
Remove-Item Env:PERF_LOAD_SECONDS, Env:PERF_LOAD_CONNECTIONS
```

Stress is a controlled diagnostic workload, not a production-capacity claim. The default maximum is 20 simultaneous connections per endpoint. It is not automatically run by normal `npm test`; invoke its explicit script when appropriate.

## Metrics and pass/fail

- **Average latency**: Autocannon's mean request latency in milliseconds.
- **p50 / p97.5 / p99 latency**: latency at or below which 50%, 97.5%, or 99% of observed requests completed.
- **Requests per second (RPS)**: mean completed request rate.
- **Throughput**: mean response bytes per second.
- **Error rate**: requests with unexpected HTTP statuses or transport failures divided by total requests. Expected endpoint status is 200; other statuses are listed and categorized as authentication/authorization configuration, rate limiting, application 5xx, or other client/protocol response.

Every endpoint must return its expected status for all measured requests. A suite fails if any request fails or if its measured p99/error rate exceeds the configured ceiling. These defaults are local regression guardrails, not universal service-level guarantees; tune them for the machine and intended development workload. Reports include status counts, classified unexpected responses, latency percentiles, throughput, and run settings, but never include tokens.

## Reports and limitations

Each suite writes a readable JSON report (`baseline.json`, `load.json`, or `stress.json`) to `tests/performance/reports/`; the reports directory is ignored by Git. The server uses the actual Express application and routes, but an in-process loopback server and MongoMemoryServer do not represent a deployed network, persistent database, external integrations, production traffic mix, or production capacity. Only the listed read-only endpoints are covered. The application currently has no rate-limiting middleware; if that changes, 429 responses will be reported separately and treated as unexpected unless the expected-status contract is intentionally updated.
