# SDN302 project

The workspace is split into two independent applications:

```text
WDP_NEW/
├── BE/     # Express + Mongoose API from the supplied archive
└── FE/    # React + Vite client
```

This is one project with two applications that run together. Install dependencies once in each application directory, then start both from the project root:

```powershell
cd "BE"
npm install
cd "..\FE"
npm install
cd ..
npm run dev
```

`npm run dev` starts the API and Vite client together. Stop both with Ctrl+C. The backend listens on port `9999` (from `BE/.env`) and currently exposes `GET /api`; the frontend uses `http://localhost:9999/api` by default. Override the API address in `FE/.env` with `VITE_API_BASE_URL` if needed. Backend configuration keys are documented in `BE/.env.example`.

## Local MongoDB transactions

The project uses port 27018 and replica set rentalLocal. The existing MongoDB service on 27017 stays unchanged. Transactions require replica-set mode.

Start the dedicated local replica from BE:

```powershell
npm run db:local
```

This starts mongod on 127.0.0.1:27018 using BE/storage/mongodb-replica (ignored by Git). MongoDB Server must be installed under Program Files/MongoDB/Server. No Windows service reconfiguration or Administrator PowerShell is required.

Set BE/.env using BE/.env.example:

```dotenv
MONGO_URI=mongodb://127.0.0.1:27018/tourist_car_rental_demo?replicaSet=rentalLocal
```

For a new database run npm run seed. For existing data run npm run db:vehicle-schedule-version; only missing versions are initialized to 0. After reboot run npm run db:local again to start the replica set.

Approval runs inside one transaction/session: read pending booking, increment vehicle schedule_version, check vehicle and overlapping confirmed/in_progress bookings, then confirm. Transient write conflicts are retried by the driver and availability is checked again. Overlap returns 409 and rolls back the version change. All future schedule changes and vehicle replacements must follow this same vehicle-write protocol. Do not execute external side effects inside the retryable callback.

PATCH approval/rejection still requires verified req.user from the authentication module. Current GET endpoints do not enforce authentication.

Tests from BE:

```powershell
npm run test:models
npm run test:booking
npm run test:booking-concurrency
```

The concurrency test uses a uniquely named temporary database and removes only that test database. TEST_MONGO_URI can select another test replica set.
