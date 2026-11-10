# Renter requirements and unresolved rules

Sources: supplied Template2 SRS and Classdiagram. Scope: UC01–UC12, UC22–UC23. Existing MongoDB collections and controller/service/repository boundaries are retained.

## Policy authority

Runtime reads active `platform_policies` within their effective dates and selects the latest effective version of each type. Seed JSON is never a runtime fallback. Listing prices, deposits and mileage terms come from MongoDB. Booking terms snapshot policy versions/configurations.

The current development connection uses local MongoDB at `127.0.0.1:27018`, replica set `rs0`, database `xedi`. The empty local database was initialized with the existing seed script (276 documents). Policies are now read from that local database; cloud connectivity is not required. Previous environment settings are retained in the ignored `BE/.env.atlas-backup` file.

## Missing or conflicting requirements

- Cancellation: SRS mentions 24 hours; MongoDB takes precedence by user instruction. Missing late cancellation percentages/fees require operational review, not an invented charge.
- Approval: renter flow specifies a 15 minute hold before signing/payment; Operation describes manual review within 2 hours. `booking.config.review_required` controls review if set; otherwise follow the renter reservation flow. No owner approval is inferred.
- Holds: 15 minutes as specified. Legacy pending records without expiry continue blocking. New holds expire by timestamp even before cleanup.
- Discounts: one active MongoDB `discount_codes` entry, fixed VND or percentage, optional minimum subtotal/usage limit, no stacking. These rules are implementation assumptions because detailed coupon rules are missing.
- Delivery radius/fee, insurance premium and service fee formula are unspecified. Offer garage pickup and listing price only until configured; no invented surcharges.
- Search: 2 hours advance, 1 hour minimum interval. Booking: 24 hour minimum, per SRS.
- OTP, eKYC and gateway providers/credentials/callbacks were not supplied. Integrations are unavailable by default. Explicit `RENTER_DEMO_SERVICES=true` outside production enables labelled development simulations persisted in MongoDB; demo OTP is returned only in this mode. No real verification or funds movement occurs.
- Cancellation records refund requests, never claims funds were returned. Post-rental deposit refunds require verified reconciliation and manager workflow.
- OTP validity: 120 seconds contact/registration and 180 seconds signing per SRS. Additional assumptions: 60 second resend cooldown, 5 attempts maximum.
- Reviews/chat/disputes/extension appear in class diagram beyond SRS renter UC scope. Show existing reviews; do not silently add those extra workflows.
- eKYC uploads are private MongoDB records; real submissions stay pending until a verifier approves. Clients cannot set verification status.

## Access and consistency

Only the renter owning a resource may read/change it. Vehicle writes serialize overlapping reservations inside MongoDB transactions. Signing/payment enforce expiry and workflow order. Payment/cancellation are idempotent. Prices and policy decisions are calculated server-side. Incidents require an ongoing owned booking, GPS, ODO at least pickup reading and 2–10 owned evidence files.


## Running and reviewing

- Run `npm run db:local` before starting the application. `BE/.env` currently selects the local replica set; transactions are required for consistent bookings/payments. Local data is independent of any previously configured cloud database.
- Start with the root `npm run dev`. Signing in as RENTER opens `/#/renter`, the renter homepage with trip summaries, profile/verification, booking/payment and incident navigation, plus vehicle search and reservation. Dedicated pages are at `/#/renter/cars`, `/#/renter/profile`, `/#/renter/bookings` and `/#/renter/incidents`. Vehicle cards open the reservation panel inside the renter workspace.
- Default external integrations are unavailable. For a local demonstration with test data only, set `RENTER_DEMO_SERVICES=true` in `BE/.env` and restart the backend. Never enable this against production data; production ignores this setting.
- New renter APIs are under `/api/renter`; `/api/auth/login` and shared staff/owner APIs are preserved.
- New private collections: `renter_challenges`, `renter_contact_keys`, `renter_files`, `renter_file_chunks`; promotions read `discount_codes`. Indexes are created lazily before mutations. No application database reseed or migration is run automatically.
- Registration currently collects both email and phone to match the existing schema and UI. SRS field descriptions also allow either contact alone; that alternative needs a separate schema/contact-verification decision.
- Booking history filters operate across all MongoDB records before pagination. Details poll every 15 seconds; history refreshes every 30 seconds while the browser is visible.
- A real eKYC submission remains pending when no provider is configured. Completing real onboarding, OTP delivery, payment authorization and refunds still requires the provider integration; demo records do not prove real verification/payment.

## Verification commands

`npm run build --prefix FE`

`CI=true npm test --prefix FE -- --watchAll=false --runInBand` (PowerShell: `$env:CI='true'` first)

`node --test test/renter.test.js test/models.test.js test/auth.test.js test/listings-search.test.js test/garage-workflows.test.js` from BE. Tests create a uniquely named temporary MongoDB replica set/database and remove only their own temporary data.
