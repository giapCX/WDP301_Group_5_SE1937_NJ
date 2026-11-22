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

The project uses port 27017 and replica set rentalLocal. Transactions require replica-set mode; a default standalone MongoDB installation is not enough.

If MongoDB is already installed as the Windows MongoDB service, run this ONCE in Administrator PowerShell from the project root:

```powershell
powershell -ExecutionPolicy Bypass -File .\BE\scripts\configure-local-mongodb.ps1
```

The script backs up mongod.cfg under BE/storage, adds replSetName: rentalLocal, restarts the service, then initializes the single-member replica set. It retains the existing dbPath and databases. The service restart briefly disconnects local clients. If your service or installation uses a different name/path, pass -ServiceName and -ConfigPath.

For a machine without a running MongoDB service, run npm run db:local from BE. It can start a separate mongod on 27017 with files under BE/storage/mongodb-replica. It never automatically stops or reconfigures another instance occupying that port. MongoDB Server must be installed under Program Files/MongoDB/Server.

Set BE/.env using BE/.env.example:

```dotenv
MONGO_URI=mongodb://127.0.0.1:27017/tourist_car_rental_demo?replicaSet=rentalLocal
```

For a new database run npm run seed. For existing data run npm run db:vehicle-schedule-version; only missing versions are initialized to 0. After reboot the Windows service starts automatically if configured for automatic startup; otherwise run npm run db:local again.

Approval runs inside one transaction/session: read pending booking, increment vehicle schedule_version, check vehicle and overlapping confirmed/in_progress bookings, then confirm. Transient write conflicts are retried by the driver and availability is checked again. Overlap returns 409 and rolls back the version change. All future schedule changes and vehicle replacements must follow this same vehicle-write protocol. Do not execute external side effects inside the retryable callback.

PATCH approval/rejection still requires verified req.user from the authentication module. Current GET endpoints do not enforce authentication.

Tests from BE:

```powershell
npm run test:models
npm run test:booking
npm run test:booking-concurrency
```

The concurrency test uses a uniquely named temporary database and removes only that test database. TEST_MONGO_URI can select another test replica set.
