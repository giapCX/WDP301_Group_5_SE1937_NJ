# Operator / Driver trip workflow

Operator opens `/operator/dispatch` to assign confirmed bookings, choose the service type, and resolve reassignment cases. Driver trip cards are available on `/driver/dashboard`; assignment cards refresh every 30 seconds and can be refreshed manually.

The API creates `trip_workflows` records and keeps assignment attempts in `trip_assignments`, ordered trip progress in `trip_status_updates`, tour stops in `trip_stops`, and incidents in `incidents`. It checks vehicle schedule and open maintenance, driver approval and licence expiry, overlapping active assignments, and overlap with `driver_unavailability` records (`driver_id`, `start_at`, `end_at`, `status`).

Supported service types are `one_way`, `round_trip`, and `tour`. Round trips require a return pickup time inside the booking window. Tours require route stops and can be completed only in stop order. Driver updates are restricted to the authenticated driver's current assignment. Rejections require a reason. Vehicle failures enter a replacement state; unavailable return drivers can be reassigned by Operator; route changes are routed to booking-change workflow 4. Trip reports record start/end odometers, actual end time, delay, and summary.

## Garage integration boundary

The Garage dashboard is intentionally not included. Driver receipt and vehicle-return confirmation stay pending until Garage records a passed `vehicle_inspections` record for the booking and assigned vehicle (`inspection_type: handover` or `return`). The Driver UI explains these gates; implement the Garage UI and inspection API as a separate workflow.

## Routes

- `GET /api/operator/dispatch`
- `POST /api/operator/dispatch/:bookingId/assign`
- `POST /api/operator/dispatch/:bookingId/replace-vehicle`
- `POST /api/operator/dispatch/:bookingId/reassign-return`
- `POST /api/operator/dispatch/:bookingId/incidents/:incidentId/resolve`
- `GET /api/driver/workflow`
- `POST /api/driver/workflow/:bookingId/accept|reject|vehicle_received|update|report|vehicle_returned`
- `POST /api/driver/workflow/:bookingId/incident`
