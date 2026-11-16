# Anna-Setu backend component tests

## Purpose

Component tests exercise one backend component at a time, replacing neighboring dependencies where doing so makes the behavior easier to isolate. They complement the existing white-box controller tests, Supertest/API tests, acceptance journeys, security checks, and performance suite; they are not a replacement for those broader tests.

## Components covered

- **Authentication / password model behavior:** `auth/password-hashing.test.js` executes the real User model's registered save middleware, checks that a password is hashed, and verifies correct and incorrect password comparisons.
- **Controllers:** `controllers/compostController.test.js` covers compost donation queries, sale creation and history, including database-error responses. `controllers/userController.test.js` covers profile query selection, partial updates, missing users, and generic error handling.
- **Models:** `models/*.model.test.js` covers all six actual Mongoose schemas: User, Donation, Task, Request, CompostSale, and Activity. Tests check required paths, enum validation, defaults, trim/cast behavior, and declared references.
- **Middleware:** `middleware/authMiddleware.test.js` verifies the actual `jsonwebtoken` signing/verification interaction for a valid token and a token signed with the wrong secret.

## Isolation and mocks

Controller tests mock their model dependencies so each controller function can be tested without opening a database connection. The User password test constructs a real Mongoose document and invokes its registered save middleware directly; it does not persist data. Schema tests use `validateSync()` on in-memory documents. No test connects to a configured application database, and no production records are read or changed.

`compostController` is tested directly because the existing white-box controller suite covers the parallel compost methods in `adminController`, not this separate controller module. User profile controller tests focus on component-level partial-update and failure branches; security/API suites already verify response field privacy through HTTP. Auth controller, role authorization middleware, and the other business controllers already have substantial white-box coverage, so this suite avoids repeating their existing assertion sets. There is no services, utilities, request-validation middleware, or centralized error-handler module in the backend source tree, so no tests or scripts are added for those categories. Route behavior remains covered by the existing Supertest suites.

## Files

| File | Purpose |
| --- | --- |
| `auth/password-hashing.test.js` | Real password save hook and password comparison |
| `controllers/compostController.test.js` | Compost controller model interactions and error responses |
| `controllers/userController.test.js` | Profile controller partial updates and failure paths |
| `middleware/authMiddleware.test.js` | Real JWT signature verification through middleware |
| `models/User.model.test.js` | User required fields, enums, defaults, and normalization |
| `models/Donation.model.test.js` | Donation required fields, enums, default, and references |
| `models/Task.model.test.js` | Task required references, enum, default, and references |
| `models/Request.model.test.js` | Request required fields, trim, status default/enum, and reference |
| `models/CompostSale.model.test.js` | Sale required fields, numeric casting, trim, and date default |
| `models/Activity.model.test.js` | Activity required fields, enum, and optional user reference |

`helpers.js` contains only reusable test response and Mongoose hook helpers; it does not represent an application utility component.

## Run tests

From the `backend/` directory in PowerShell:

```powershell
npm run test:component
npm run test:component:auth
npm run test:component:controllers
npm run test:component:models
npm run test:component:middleware
```

The component scripts run Jest serially and force Jest to exit, consistent with the existing backend test commands. Performance tests are excluded from the default Jest configuration; these component commands target only `tests/component/`.

## Reading results and limits

Jest reports the number of passing/failing test files and individual assertions. A component test failure indicates either an assertion/setup issue or an implementation behavior change at that component boundary; use the named test and error output to distinguish them. Controller model mocks verify the expected query/mutation calls, not MongoDB server semantics. Schema tests validate Mongoose document behavior without database persistence. Existing API and acceptance tests provide the complementary persistence and route verification.

These component tests do not add new tests for authentication-controller registration/login branches, `authorize`, donor/admin/volunteer/receiver controller functions, services/utilities, or route definitions because those areas are already covered by existing test suites or do not exist as separate application components. They also do not assert new business rules beyond the schemas and controller behavior currently implemented.
