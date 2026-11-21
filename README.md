# SDN302 project

The workspace is split into two independent applications:

```text
WDP_NEW/
├── Back end/     # Express + Mongoose API from the supplied archive
└── front end/    # React + Vite client
```

This is one project with two applications that run together. Install dependencies once in each application directory, then start both from the project root:

```powershell
cd "Back end"
npm install
cd "..\front end"
npm install
cd ..
npm run dev
```

`npm run dev` starts the API and Vite client together. Stop both with Ctrl+C. The backend listens on port `9999` (from `Back end/.env`) and currently exposes `GET /api`; the frontend uses `http://localhost:9999/api` by default. Override the API address in `front end/.env` with `VITE_API_BASE_URL` if needed. Backend configuration keys are documented in `Back end/.env.example`.
