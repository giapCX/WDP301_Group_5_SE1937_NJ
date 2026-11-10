# Operation Management API

All routes are mounted at `/api/operation`. They require a valid Bearer JWT and the `OPERATION_STAFF` or `ADMIN` role. List endpoints accept `page` (default `1`), `limit` (default `12`, maximum `100`), `q`, `status`, and `sort` (`newest`, `oldest`, `start_asc`, `end_asc`, or `status`) where relevant. Lists return `{ "data": [], "pagination": { "page", "limit", "total", "totalPages" } }`; details and mutations return `{ "data": ... }`. Errors use `{ "error": { "message" } }`.

## Endpoints

| Method | Path | Request | Response | Roles |
|---|---|---|---|---|
| GET | `/dashboard` | — | `data.metrics`: pending bookings, active/overdue rentals, open incidents, violations, disputes, complaints | Operation Staff, Admin |
| GET | `/bookings` | Query filters and pagination | Paginated bookings with renter, vehicle, dates, fees, review information | Operation Staff, Admin |
| GET | `/bookings/:id` | — | Booking detail and status history | Operation Staff, Admin |
| PATCH | `/bookings/:id/decision` | `{ "action": "approve" }` or `{ "action": "reject", "reason": "..." }` | `{ id, status, decision }` | Operation Staff, Admin |
| GET | `/listings` | Query filters and pagination | Paginated rental listings, linked vehicle/owner, price, status | Operation Staff, Admin |
| GET | `/listings/:id` | — | Listing detail, vehicle, owner, rental policy, and photos | Operation Staff, Admin |
| PATCH | `/listings/:id` | Editable `title`, `description`, `dailyPrice`, `securityDepositAmount`, `pickupLocation` | Updated listing fields | Operation Staff, Admin |
| PATCH | `/listings/:id/review` | `{ "action": "approve|reject|activate|deactivate", "reason?": "..." }` | `{ id, status }` | Operation Staff, Admin |
| GET | `/incidents` | Query filters and pagination | Paginated non-violation incident cases | Operation Staff, Admin |
| GET | `/incidents/:id` | — | Case detail, evidence, assignment, timeline, resolution | Operation Staff, Admin |
| POST | `/incidents` | `{ "caseType": "damage|accident|safety|other|overdue|traffic_violation", "description": "...", "bookingId?": "...", "vehicleId?": "..." }` | `201 { id, caseNumber, status }` | Operation Staff, Admin |
| PATCH | `/incidents/:id` | `status?`, `assignedStaffId?`, `note?`, `evidence?: [{ "kind", "fileKey" }]`, `compensationProposal?: { "amount", "responsibility", "note" }` | `{ id, status }` | Operation Staff, Admin |
| GET | `/violations` | Query filters and pagination | Paginated violation cases with evidence/details | Operation Staff, Admin |
| GET | `/violations/:id` | — | Violation detail | Operation Staff, Admin |
| PATCH | `/violations/:id/review` | `{ "decision": "confirm", "penaltyFee": 100000, "note?": "..." }` or `{ "decision": "reject", "note": "..." }` | `{ id, status: "pending_manager", recommendation }` | Operation Staff, Admin |
| GET | `/disputes` | Query filters and pagination | Paginated dispute cases | Operation Staff, Admin |
| GET | `/disputes/:id` | — | Dispute detail and timeline | Operation Staff, Admin |
| PATCH | `/disputes/:id` | `status?`, `assignedStaffId?`, `note?`, `evidence?` | `{ id, status }` | Operation Staff, Admin |
| GET | `/complaints` | Query filters and pagination | Paginated complaint cases | Operation Staff, Admin |
| GET | `/complaints/:id` | — | Complaint detail and timeline | Operation Staff, Admin |
| PATCH | `/complaints/:id` | `status?`, `assignedStaffId?`, `note?`, `evidence?` | `{ id, status }` | Operation Staff, Admin |
| GET | `/staff` | — | Active Operation Staff/Admin choices for assignment | Operation Staff, Admin |
| GET | `/overdue` | Query filters and pagination | Overdue rentals with duration, fee estimate, and renter contact | Operation Staff, Admin |
| POST | `/overdue/:id/actions` | `{ "action": "remind|handled", "note?": "..." }` | `{ id, action, handledAt }` | Operation Staff, Admin |

Booking approval persists as `confirmed` in the existing booking lifecycle and as `review_info.decision = approved`; rejection uses status `rejected`. Listing approval publishes the listing; rejection archives it. Invalid or stale transitions return HTTP `409`; invalid requests return `400`, missing records `404`, and authenticated users without an allowed role `403`.

Operation investigates cases, records notes and evidence, and may submit a responsibility/cost proposal. Submitting a proposal appends a pending claim and moves the case to `pending_manager`; Operation cannot resolve disputes or close a case with a pending Manager decision. Manager reviews the proposal through the manager incident workspace, and the final decision is recorded separately from Operation's recommendation. A reported incident can enter `in_progress`; a reported dispute can enter `under_review`; unresolved cases can wait for a party response; resolved cases can close where permitted. Every update appends an operation timeline event. Evidence uses private storage keys (`fileKey`); the API accepts metadata and does not upload binary files. Overdue reminders create an in-app `notifications` record for the renter.

## Code map

| Location | Responsibility |
|---|---|
| `BE/src/modules/operation/operation.routes.js` | HTTP route registration |
| `BE/src/modules/operation/operation.controller.js` | HTTP request/response adapters |
| `BE/src/modules/operation/operation.service.js` | Composes workflow services |
| `BE/src/modules/operation/operation-*-service.js` | Dashboard, booking, listing, case, and overdue workflows, kept beside the router |
| `BE/src/modules/operation/operation.context.js` | Shared audit, identity, record mapping, and Operation role authorization |
| `BE/src/modules/operation/operation.validator.js` | Request validation and normalization |
| `BE/src/modules/operation/operation.repository.js` | MongoDB access adapter |
| `FE/src/features/operation/pages/OperationPage.js` | Navigation, page state, data loading, and composition |
| `FE/src/features/operation/components/` | Dashboard, work queue, and case detail views |
| `FE/src/features/operation/hooks/useOperationActions.js` | Queue actions and calls to workflow APIs |
| `FE/src/features/operation/operationConfig.js` | Queue definitions, labels, and shared formatting |
| `FE/src/features/operation/operationViewModel.js` | API records mapped to the common queue row shape |

## Persistence

No new collection or migration is required. The module uses existing `bookings`, `vehicle_listings`, `incident_cases`, `users`, `roles`, `notifications`, and `audit_logs` collections. Timestamps and handler identifiers use the repository’s persisted `snake_case` convention (`created_at`, `updated_at`, `handled_by`, `handled_at`). Booking decisions and overdue handling add operation-specific fields to existing documents.

## Run and verify

From the repository root:

```powershell
npm run db:seed
npm run dev
npm test --prefix BE
npm test --prefix FE -- --watchAll=false --runInBand
npm run build --prefix FE
```

Seeded demo accounts use the default demo password `123456`:

| Role | Email |
|---|---|
| Operation Staff | `operation17@example.com` |
| Operation Staff | `operation18@example.com` |
| Admin | `admin20@example.com` |

Example request after login:

```powershell
curl.exe -H "Authorization: Bearer YOUR_JWT" "http://127.0.0.1:5000/api/operation/bookings?status=pending&page=1&limit=10&sort=newest"
```
