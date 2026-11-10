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
| GET | `/vehicles` | Query filters and pagination | Paginated vehicles awaiting Operation screening with owner, documents, and any open inspection assignment | Operation Staff, Admin |
| GET | `/vehicles/:id` | — | Vehicle registration and owner details | Operation Staff, Admin |
| PATCH | `/vehicles/:id/screen` | `{ "action": "request_revision", "note": "..." }` or `{ "action": "schedule_inspection", "garageStaffId": "...", "scheduledFor": "...", "note": "..." }` | Screening result or inspection assignment | Operation Staff, Admin |
| GET | `/garage-staff` | Optional `q`, pagination | Active Garage Staff with `vehicle.inspect` permission | Operation Staff, Admin |
| GET | `/incidents` | Query filters and pagination | Paginated non-violation incident cases | Operation Staff, Admin |
| GET | `/incidents/:id` | — | Case detail, evidence, assignment, timeline, resolution | Operation Staff, Admin |
| POST | `/incidents` | `{ "caseType": "damage|accident|safety|other|overdue|traffic_violation", "description": "...", "bookingId?": "...", "vehicleId?": "..." }` | `201 { id, caseNumber, status }` | Operation Staff, Admin |
| PATCH | `/incidents/:id` | `status?`, `assignedStaffId?`, `note?`, `evidence?: [{ "kind", "fileKey" }]` | `{ id, status }` | Operation Staff, Admin |
| GET | `/violations` | Query filters and pagination | Paginated violation cases with evidence/details | Operation Staff, Admin |
| GET | `/violations/:id` | — | Violation detail | Operation Staff, Admin |
| PATCH | `/violations/:id/review` | `{ "decision": "confirm", "penaltyFee": 100000, "note?": "..." }` or `{ "decision": "reject", "note": "..." }` | `{ id, status, decision }` | Operation Staff, Admin |
| GET | `/disputes` | Query filters and pagination | Paginated dispute cases | Operation Staff, Admin |
| GET | `/disputes/:id` | — | Dispute detail and timeline | Operation Staff, Admin |
| PATCH | `/disputes/:id` | `status?`, `assignedStaffId?`, `note?`, `evidence?` | `{ id, status }` | Operation Staff, Admin |
| GET | `/complaints` | Query filters and pagination | Paginated complaint cases | Operation Staff, Admin |
| GET | `/complaints/:id` | — | Complaint detail and timeline | Operation Staff, Admin |
| PATCH | `/complaints/:id` | `status?`, `assignedStaffId?`, `note?`, `evidence?` | `{ id, status }` | Operation Staff, Admin |
| GET | `/staff` | — | Active Operation Staff/Admin choices for assignment | Operation Staff, Admin |
| GET | `/overdue` | Query filters and pagination | Overdue rentals with duration, fee estimate, and renter contact | Operation Staff, Admin |
| POST | `/overdue/:id/actions` | `{ "action": "remind|handled|escalate", "note?": "..." }` | `{ id, action, handledAt }` | Operation Staff, Admin |

Booking requests remain `pending` for at most two hours. Operation approval checks that pickup is at least two hours away and changes the booking to `awaiting_payment` with a new 15-minute payment deadline; payment and signed-contract verification are required elsewhere before `confirmed`. Stale requests and payment holds are marked `expired` and release the booking hold. Rejection requires a reason. Listing approval publishes only when the Manager-approved vehicle has been received into the garage under a fully signed, active management agreement and completed intake.

Operation can screen submitted vehicle files, request revisions, and schedule an onboarding inspection with an active Garage Staff member authorized for `vehicle.inspect`; it cannot approve the vehicle. Operation investigates and submits violation recommendations to Manager rather than deciding penalties, and cannot resolve complaints/disputes or unsettled compensation claims. Evidence uses private storage keys (`fileKey`); the API accepts metadata and does not upload binary files. Overdue reminders create an in-app notification for the renter; after four hours, a Manager escalation also notifies the Manager and vehicle owner. Late-fee estimates apply the 30-minute grace period and are estimates, not settlement entries.

## Persistence

No new collection or migration is required. The module uses existing `bookings`, `vehicle_listings`, `incident_cases`, `users`, `roles`, `notifications`, and `audit_logs` collections. Timestamps and handler identifiers use the repository’s persisted `snake_case` convention (`created_at`, `updated_at`, `handled_by`, `handled_at`). Booking decisions and overdue handling add operation-specific fields to existing documents.

## Code map

The Operation feature is organized by layer and by staff workflow:

| Location | Responsibility |
|---|---|
| `BE/src/modules/operation/operation.routes.js` | Route registration grouped by booking, listing, vehicle onboarding, cases, and overdue follow-up |
| `BE/src/modules/operation/operation.controller.js` | HTTP request/response adapters, kept separate from business rules |
| `BE/src/modules/operation/operation.service.js` | Operation Staff permissions and workflows: booking review, listing publication, vehicle screening, case investigation, overdue escalation |
| `BE/src/modules/operation/operation.validator.js` | Input validation grouped by workflow |
| `BE/src/modules/operation/operation.repository.js` | Mongoose access adapter for existing domain models |
| `FE/src/features/operation/operationConfig.js` | Queue names, status labels, filters, and shared display formatters |
| `FE/src/features/operation/hooks/useOperationActions.js` | User actions grouped by the queue they update |
| `FE/src/features/operation/operationViewModel.js` | API records mapped to the common queue table shape |
| `FE/src/features/operation/components/` | Dashboard, queue/table actions, and record detail presentation |
| `FE/src/features/operation/pages/OperationPage.js` | Page state, navigation, loading, authorization display, and composition of the workflow UI |

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
