# Anna-Setu Backend Acceptance Tests

## Purpose

These Jest/Supertest tests exercise user-visible backend workflows across real Express routes and MongoDB persistence. They complement unit tests (which isolate a function or module) and integration/black-box tests (which focus on component interactions or individual API contracts) by following broader actor and business journeys.

## Suites and scenarios

- `auth-profile.acceptance.test.js`: public donor, receiver, and volunteer registration; public admin-registration rejection; approved and pending login; valid, incorrect, and incomplete credentials; protected profile access and update; missing and invalid tokens; role restrictions.
- `admin.acceptance.test.js`: review pending users, approval and rejection, persisted account state, activity records, dashboard statistics, and login behavior after review.
- `receiver-requests.acceptance.test.js`: receiver account approval, food request submission and persistence, receiver request list, admin review/fulfillment, and invalid request persistence behavior.
- `donation-lifecycle.acceptance.test.js`: donor submission and history, admin review and assignment, volunteer task retrieval and status updates, receiver delivery visibility and confirmation, ownership checks, and final persisted states/statistics.

## Actors, preconditions, and data

Tests use the existing `tests/setup.js` MongoMemoryServer setup and `helpers.js` for unique test emails, account registration/login, and an admin fixture. They do not rely on production data or external services. Publicly registered instant donors are approved by the application; volunteer and receiver accounts are approved through the admin API. Since public admin registration is intentionally disallowed, tests seed an approved admin directly in the isolated test database. Each test clears its database records after execution and each suite stops its own in-memory server.

## Run the acceptance suite

From `backend/`:

```powershell
npx jest tests/acceptance --runInBand --forceExit
```

## How acceptance differs from unit and integration tests

Unit tests isolate individual functions and modules. Integration tests check interactions between selected modules or endpoints. These acceptance tests use HTTP requests through the Express app, authenticate separate actors, follow multi-step user/business workflows, and query MongoDB to confirm outcomes a user or administrator would observe.

## Known limitations and observed behavior

- There is no endpoint for retrieving a single donation by ID. Donors can retrieve their own donation list through `GET /api/donor`; list entries include the donation details used by the application.
- There is no receiver-facing endpoint to browse unassigned/available donations. Assignment is an admin action; receivers can view only assigned upcoming deliveries and completed delivery history.
- Admin assignment updates a pending donation and creates its task, but the implementation does not validate that the supplied volunteer and receiver IDs belong to users with those roles.
- Task statuses have an enum, but the volunteer controller does not enforce transition order. Enum-invalid statuses are rejected by Mongoose but currently surface as HTTP 500. Enum-valid out-of-order status changes can succeed and may desynchronize task and donation status. The lifecycle test follows the frontend-supported order: `Pending Acceptance` → `Accepted` → `Picked Up` → `Delivered` → receiver confirmation to `Completed`.
- Missing required donation/request fields fail persistence but current controllers may return HTTP 500 rather than a client-validation status.
- A login request with a known email but missing password currently returns HTTP 500 because password comparison receives an absent value. The acceptance test expects an HTTP 401 client rejection and keeps this defect visible.
- Donor routes require authentication but do not enforce the donor role. The data query is scoped to the JWT user ID; this is recorded as a current authorization limitation.
