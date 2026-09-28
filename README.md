# DocuMind AI

DocuMind AI is an intelligent, enterprise-grade document processing and analysis platform that ingests, parses, and indexes heterogeneous documents (PDFs, scans, images) using multi-modal AI and OCR to enable semantic querying, contextual Q&A, and structured data extraction.

## Project Status

- [x] Architecture
- [x] Auth
- [ ] Upload
- [ ] AI Processing
- [ ] Q&A
- [ ] Export
- [ ] Deploy

---

## Getting Started

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Latest | Runs the backend API + database |
| [Node.js](https://nodejs.org/) + npm | v18+ | Runs the frontend dev server |
| [Git](https://git-scm.com/) | Latest | Version control |

### 1 — Clone the repository

```bash
git clone <your-repo-url>
cd AI-Document-Analysis-Tool
```

### 2 — Configure environment variables

Both the backend and frontend ship a `.env.example` template. Copy each one and fill in your values:

```bash
cp backend/.env.example  backend/.env
cp frontend/.env.example frontend/.env
```

#### `backend/.env`

| Variable | Where to get it | Example |
|----------|----------------|---------|
| `DATABASE_URL` | [Supabase](https://supabase.com/) → Project Settings → Database → Connection string (Transaction pooler, IPv4) | `postgresql+asyncpg://postgres.xxxx:password@aws-0-region.pooler.supabase.com:6543/postgres` |
| `GOOGLE_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) → Create API key | `AIzaSy...` |
| `SECRET_KEY` | Generate one yourself (see below) | `a3f8b2c1...` |
| `UPLOAD_DIR` | Local path for uploaded files (default is fine) | `./uploads` |

**Generate a secure `SECRET_KEY`:**

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

> [!IMPORTANT]
> **Supabase free-tier users:** You must use the **IPv4 pooler** connection string
> (Transaction mode, port `6543`), **not** the direct connection. The free tier's
> direct connection is IPv6-only and will fail from most local Docker setups.
> Find it under Project Settings → Database → Connection string → select
> **"Transaction pooler"** and toggle **"Use connection pooling"**.

#### `frontend/.env`

| Variable | Default | Notes |
|----------|---------|-------|
| `VITE_API_URL` | `http://localhost:8000` | Points to the backend API; the default works for local development |

### 3 — Start the backend

```bash
docker compose up --build
```

This starts the FastAPI backend on **http://localhost:8000**.

### 4 — Run database migrations

In a separate terminal, with the containers running:

```bash
docker compose exec backend alembic upgrade head
```

This creates all the required tables (users, documents, etc.) in your Supabase database.

### 5 — Start the frontend

```bash
cd frontend
npm install
npm run dev
```

The React app will start on **http://localhost:5173** and proxy API calls to the backend.

### 6 — Verify

1. Open **http://localhost:5173** — you should be redirected to the login page.
2. Register a new account, and you'll land on the dashboard.
3. The backend health check is at **http://localhost:8000/health**.

---

## Project Structure

```
AI-Document-Analysis-Tool/
├── backend/               # FastAPI + SQLAlchemy + Alembic
│   ├── app/
│   │   ├── models/        # SQLAlchemy models
│   │   ├── schemas/       # Pydantic schemas
│   │   ├── services/      # Business logic (auth, etc.)
│   │   ├── database.py    # Async engine & session
│   │   └── main.py        # FastAPI app entry point
│   ├── alembic/            # Database migrations
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env.example
├── frontend/              # React + Vite + Tailwind CSS
│   ├── src/
│   │   ├── api/           # Axios client & API functions
│   │   ├── context/       # React Context (Auth)
│   │   ├── components/    # Shared components
│   │   ├── pages/         # Route pages (Login, Register, Dashboard)
│   │   ├── config.js      # Environment config
│   │   ├── App.jsx        # Root component with routing
│   │   └── main.jsx       # Entry point
│   ├── package.json
│   └── .env.example
└── docker-compose.yml
```
