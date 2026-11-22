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
