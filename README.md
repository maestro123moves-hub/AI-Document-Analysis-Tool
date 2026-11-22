# DocuMind AI

**A personal AI-powered document processing and analysis platform** that ingests PDFs, scanned images, Word docs, and plain text — extracts their content via OCR, classifies and summarises them with Google Gemini, indexes semantic embeddings in pgvector, and lets you ask natural-language questions grounded in your documents using Retrieval-Augmented Generation (RAG).

> [!NOTE]
> This is a **personal project** — not released under an open-source licence. The source code is publicly visible for portfolio and educational purposes. See [Licence](#licence) for details.

---

## Application Preview

| Document Library & Upload | AI Classification & Summary |
|:---:|:---:|
| ![Document Library](docs/screenshots/04-dashboard-uploaded.png) | ![AI Summary](docs/screenshots/06-ai-summary.png) |
| **Document Q&A with Similarity Sources** | **Cross-Document Global Search** |
| ![Document Q&A](docs/screenshots/07-document-qa.png) | ![Global Search](docs/screenshots/08-global-search.png) |

<details>
<summary><b>View Additional Screenshots (FastAPI Swagger, Document Detail & Authentication)</b></summary>
<br>

| Interactive Swagger API Docs (`/docs`) | Document Detail & Extracted Text |
|:---:|:---:|
| ![FastAPI Swagger Docs](docs/screenshots/09-swagger-docs.png) | ![Document Detail](docs/screenshots/05-document-detail.png) |

| User Sign In | Account Registration |
|:---:|:---:|
| ![Login Screen](docs/screenshots/01-login.png) | ![Register Screen](docs/screenshots/02-register.png) |

</details>

---

## Features

| Area | What it does |
|------|-------------|
| **Multi-format Upload** | Drag-and-drop or click-to-upload PDFs, DOCX, PNG/JPG/JPEG, and TXT files (up to 20 MB). Real-time upload progress bar. |
| **Text Extraction & OCR** | PyMuPDF for native PDFs, Tesseract OCR fallback for scanned PDFs and images, python-docx for Word files. Automatic scanned-PDF detection (< 100 chars → OCR fallback). |
| **AI Classification & Summarisation** | Gemini structured-output call classifies each document as INVOICE / CONTRACT / RESUME / MEDICAL / BANK_STATEMENT / OTHER with a confidence score, and generates a 2–4 sentence summary — all in one API call. |
| **Semantic Chunking & Embedding** | 500-word overlapping chunks (50-word overlap) embedded via `gemini-embedding-001` (768-dim vectors) with asymmetric task types (`RETRIEVAL_DOCUMENT` for chunks, `RETRIEVAL_QUERY` for questions). |
| **Single-Document Q&A (RAG)** | Ask questions scoped to one document — the system embeds your question, runs cosine-similarity search on pgvector, retrieves the top-k chunks, and generates a grounded answer via Gemini. Source chunks with similarity scores are returned for transparency. |
| **Cross-Document Global Search** | Search across your entire library or select specific documents from a checklist. The same RAG pipeline runs with cross-document chunk retrieval and per-chunk source attribution (filename + document link). |
| **Export to PDF & Excel** | Professional ReportLab PDF reports with metadata tables, AI analysis, extracted text (truncated at 3,000 chars with notice), and page numbers. Multi-sheet Excel workbooks (Overview / AI Analysis / Full Text) with 30,000-char cell chunking to respect Excel limits. |
| **JWT Authentication** | Email/password registration and login, bcrypt password hashing, 24-hour HS256 JWT tokens, `HTTPBearer` token validation on every protected route. |
| **Per-User Data Isolation** | Every query — list, detail, process, ask, export, delete — includes a `WHERE user_id = current_user.id` clause. No user can access another user's documents. |
| **Idempotent Re-processing** | Re-processing a document deletes old chunks before inserting new ones, so you can safely re-run AI analysis without duplicating data. |

---

## System Architecture

```mermaid
flowchart TD
    U[User] --> FE[React 19 Frontend Vite + Tailwind]
    FE -->|Async REST API + Bearer JWT| API[FastAPI Backend Python 3.11]

    subgraph Ingestion["Document Ingestion & AI Indexing"]
        API --> ING[Document Ingestion & Validation]
        ING --> OCR[Text Extraction: PyMuPDF / Tesseract OCR / python-docx]
        OCR --> CLS[Gemini 3.5 Flash: Structured Classification & Summary]
        CLS --> EMB[Chunking 500w/50 overlap & gemini-embedding-001]
        EMB --> DB[(Supabase PostgreSQL + pgvector)]
    end

    subgraph Retrieval["RAG Semantic Retrieval & Grounded Q&A"]
        API --> RET[Query Embedding & Scoped pgvector Cosine Search]
        RET <--> DB
        RET --> CTX[Top-K Document Context Chunks]
        CTX --> GEM[Google Gemini API: Grounded Answer Synthesis]
        GEM --> API
    end

    subgraph Export["Export Pipeline"]
        API --> EXP[ReportLab PDF / openpyxl Excel Generation]
    end

    API --> FE
```

### Data Flow: Upload → OCR → Chunk → Embed → Q&A

```mermaid
flowchart LR
    A["📄 User uploads\nPDF / DOCX / IMG / TXT"] --> B["🔍 Text Extraction\nPyMuPDF or Tesseract OCR"]
    B --> C["💾 Save raw_text\n+ file metadata to DB"]
    C --> D["🤖 Gemini: Classify\n+ Summarise (structured JSON)"]
    D --> E["✂️ Chunk text\n500 words, 50 overlap"]
    E --> F["📊 Gemini Embed\neach chunk → 768-dim vector"]
    F --> G["💾 Store chunks\n+ embeddings in pgvector"]
    G --> H["❓ User asks question"]
    H --> I["📊 Embed question\n(RETRIEVAL_QUERY task type)"]
    I --> J["🔎 Cosine similarity\nsearch on pgvector"]
    J --> K["📝 Top-k chunks\nas grounded context"]
    K --> L["🤖 Gemini: Generate\nanswer from context only"]
    L --> M["💬 Answer + source\nchunks + similarity scores"]
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 19, Vite 8, Tailwind CSS 4 | SPA with protected routes, drag-and-drop upload, real-time chat UI |
| **Backend** | FastAPI, Python 3.11, SQLAlchemy 2 (async), Alembic | Async REST API with auto-generated OpenAPI docs at `/docs` |
| **Database** | PostgreSQL + pgvector (hosted on Supabase) | Relational storage + 768-dim vector similarity search |
| **AI / LLM** | Google Gemini API (`gemini-3.5-flash-lite`, `gemini-embedding-001`) | Classification, summarisation, embeddings, and answer generation |
| **OCR** | Tesseract OCR + PyMuPDF (fitz) | Text extraction from scanned PDFs and images |
| **Document Parsing** | python-docx, PyMuPDF, Pillow | DOCX, PDF, and image file reading |
| **Export** | ReportLab, openpyxl | Professional PDF and Excel report generation |
| **Auth** | python-jose (JWT), passlib + bcrypt | Stateless authentication with Bearer tokens |
| **Containerisation** | Docker, Docker Compose | Reproducible local development environment |
| **Frontend Hosting** | Vercel | Static SPA deployment |
| **Backend Hosting** | Render | Docker-based API hosting |

---

## API Endpoints

FastAPI automatically generates interactive OpenAPI/Swagger documentation at `/docs`:

![FastAPI Swagger Documentation](docs/screenshots/09-swagger-docs.png)

Here is the complete endpoint contract:

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/auth/register` | Create new user account | ✗ |
| `POST` | `/api/auth/login` | Get JWT access token | ✗ |
| `GET` | `/api/auth/me` | Current user profile | ✓ |
| `POST` | `/api/documents/upload` | Upload document (multipart) | ✓ |
| `GET` | `/api/documents/` | List user's documents (paginated) | ✓ |
| `GET` | `/api/documents/{id}` | Document detail + raw text | ✓ |
| `DELETE` | `/api/documents/{id}` | Delete document + file | ✓ |
| `POST` | `/api/documents/{id}/process` | AI classify + summarise + embed | ✓ |
| `POST` | `/api/documents/{id}/ask` | Single-document RAG Q&A | ✓ |
| `POST` | `/api/documents/ask` | Cross-document global RAG Q&A | ✓ |
| `GET` | `/api/documents/{id}/export?format=pdf\|excel` | Export analysis report | ✓ |
| `GET` | `/health` | Health check | ✗ |

> **Tip:** Run the backend locally and visit `http://localhost:8000/docs` for the full interactive Swagger UI where you can try every endpoint.

---

## Design Decisions

<details>
<summary><b>Scoped pgvector Similarity Search (Cross-User Isolation)</b></summary>

Every vector search query explicitly filters by `user_id` and `processing_status = 'completed'` through a SQL JOIN — the user's question never touches another user's embeddings:

```python
# From qa.py — _async_retrieve_global_chunks
query = (
    select(
        DocumentChunk.chunk_index,
        DocumentChunk.chunk_text,
        (1 - DocumentChunk.embedding.cosine_distance(query_embedding)).label("similarity_score"),
        Document.id.label("document_id"),
        Document.original_filename.label("filename"),
    )
    .join(Document, DocumentChunk.document_id == Document.id)
    .where(
        Document.user_id == user_id,                   # ← ownership guard
        Document.processing_status == "completed",     # ← only indexed docs
    )
    .order_by(DocumentChunk.embedding.cosine_distance(query_embedding).asc())
    .limit(top_k)
)
```

This is not just a UI-level filter — it's enforced at the SQL level on every query.

</details>

<details>
<summary><b>Idempotent Re-processing</b></summary>

Re-running AI processing on a document is safe. The processing service deletes all existing chunks for that document before inserting new ones:

```python
# From processing.py — _async_save_results
# Delete old chunks (re-processing safety)
await session.execute(
    delete(DocumentChunk).where(DocumentChunk.document_id == document_id)
)
# Insert new chunks
for chunk_data in chunks:
    chunk = DocumentChunk(
        document_id=document_id,
        chunk_index=chunk_data["chunk_index"],
        chunk_text=chunk_data["chunk_text"],
        embedding=chunk_data["embedding"],
    )
    session.add(chunk)
await session.commit()
```

This means you can safely hit "Re-process" if you change Gemini models or chunking parameters without worrying about duplicate embeddings.

</details>

<details>
<summary><b>422 vs 502 Error Semantics</b></summary>

The API distinguishes between client errors and server errors with intentional HTTP status codes:

- **422 Unprocessable Entity** — the request is valid but the *content* can't be processed. Examples:
  - Unsupported file type (`.exe`)
  - Document has no extractable text (blank image)
  - Question is empty or > 1,000 characters
  - Document hasn't been processed yet (can't Q&A an unindexed doc)

- **502 Bad Gateway** — the server tried but an *upstream dependency* failed. Examples:
  - Gemini API quota exceeded or unreachable
  - Embedding generation failed
  - Answer generation failed

The frontend handles these distinctly: 422 shows an informational "Not enough readable text" message; 502 shows a "Something went wrong" error with a Retry button.

</details>

<details>
<summary><b>Sync def Routes for Blocking LLM Calls</b></summary>

Routes that call the Gemini SDK (`/process`, `/ask`, `/export`) are defined as plain `def` (not `async def`) so FastAPI dispatches them to a threadpool worker. This prevents a 10-second Gemini call from blocking the async event loop for all other users. Each route uses `asyncio.run()` with a dedicated `NullPool` engine for database operations, avoiding connection pool cross-loop contamination.

</details>

<details>
<summary><b>Asymmetric Embedding Task Types</b></summary>

Chunk embeddings use `task_type="RETRIEVAL_DOCUMENT"` while query embeddings use `task_type="RETRIEVAL_QUERY"`. Both produce identical 768-dimensional vectors, but this asymmetry is [recommended by Google](https://ai.google.dev/gemini-api/docs/embeddings) to improve retrieval quality — the model encodes stored content and search queries differently to maximise cosine similarity for genuine matches.

</details>

---

## Local Setup

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Latest | Runs the backend API + Tesseract OCR |
| [Node.js](https://nodejs.org/) + npm | v18+ | Runs the frontend dev server |
| [Git](https://git-scm.com/) | Latest | Version control |

### 1 — Clone the repository

```bash
git clone https://github.com/maestro123moves-hub/AI-Document-Analysis-Tool.git
cd AI-Document-Analysis-Tool
```

### 2 — Configure environment variables

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

The Docker container installs Tesseract OCR, runs Alembic migrations automatically, and starts the FastAPI server on **http://localhost:8000**.

### 4 — Start the frontend

```bash
cd frontend
npm install
npm run dev
```

The React app starts on **http://localhost:5173** and proxies API calls to the backend.

### 5 — Verify

1. Open **http://localhost:5173** — you should be redirected to the login page.
2. Register a new account, and you'll land on the dashboard.
3. The backend health check is at **http://localhost:8000/health**.
4. Interactive API docs are at **http://localhost:8000/docs**.

---

## Project Structure

```
AI-Document-Analysis-Tool/
├── backend/                       # FastAPI + SQLAlchemy + Alembic
│   ├── app/
│   │   ├── models/                # SQLAlchemy models (User, Document, DocumentChunk)
│   │   ├── schemas/               # Pydantic request/response schemas
│   │   ├── routers/               # API route handlers (auth, documents, processing, qa, export)
│   │   ├── services/              # Business logic
│   │   │   ├── ai_service.py      # Gemini classify/summarise/embed/answer
│   │   │   ├── auth_service.py    # JWT + bcrypt auth
│   │   │   ├── export_service.py  # ReportLab PDF + openpyxl Excel generation
│   │   │   └── text_extractor.py  # Multi-format text extraction + OCR
│   │   ├── database.py            # Async SQLAlchemy engine + session
│   │   ├── config.py              # Pydantic settings from .env
│   │   └── main.py                # FastAPI app + CORS + router registration
│   ├── alembic/                   # Database migration scripts
│   ├── tests/                     # Backend test suite
│   ├── Dockerfile                 # Python 3.11 + Tesseract OCR container
│   ├── entrypoint.sh              # Runs alembic upgrade head → uvicorn
│   ├── requirements.txt
│   └── .env.example
├── frontend/                      # React 19 + Vite 8 + Tailwind CSS 4
│   ├── src/
│   │   ├── pages/                 # Login, Register, Dashboard, DocumentDetail, Search
│   │   ├── components/            # UploadZone, DocumentCard, DocumentChat, ExportButtons
│   │   ├── api/                   # Axios client + typed API functions
│   │   ├── context/               # React Context (AuthProvider with JWT persistence)
│   │   ├── utils/                 # Formatting helpers
│   │   ├── App.jsx                # Route definitions with ProtectedRoute wrapper
│   │   └── main.jsx               # React root entry
│   ├── package.json
│   └── .env.example
├── docker-compose.yml             # Backend service definition
└── README.md
```

---

## Testing

The project includes a backend verification suite (`backend/tests/test_export_verification.py`) that tests:

- PDF and Excel export correctness for processed and unprocessed documents
- Format validation (rejects `format=xml` with 422)
- Cross-user ownership enforcement (returns 404 for another user's documents)
- Filename sanitisation for unsafe characters in Content-Disposition headers
- Long document handling (> 30,000 character Excel cell-chunking)
- Export latency benchmarks (all exports < 1 second)

To run the test suite inside the running container:

```bash
docker compose exec backend python -m backend.tests.test_export_verification
```

---

## Deployment

| Component | Platform | Notes |
|-----------|----------|-------|
| **Frontend** | [Vercel](https://vercel.com/) | `npm run build` → deploy `frontend/dist/`. Set `VITE_API_URL` to your Render backend URL. |
| **Backend** | [Render](https://render.com/) | Deploy as a Docker web service. Add `DATABASE_URL`, `GOOGLE_API_KEY`, and `SECRET_KEY` as environment variables. The `entrypoint.sh` runs migrations automatically on each deploy. |
| **Database** | [Supabase](https://supabase.com/) | Free-tier PostgreSQL with pgvector extension. Use the IPv4 transaction pooler connection string. |

> [!WARNING]
> This project uses **free tiers** of Vercel, Render, and Supabase. The backend may cold-start after inactivity (~50s on Render's free tier), and Supabase pauses databases after 7 days of inactivity on the free plan. These are expected limitations, not bugs.

---

## Roadmap & Known Limitations

### Current Limitations

- **No real-time processing feedback** — AI processing is synchronous; the user waits 8–10 seconds with an animated progress bar but no server-sent updates.
- **Single-threaded chunking** — embedding generation is sequential; large documents with many chunks could benefit from batched/parallel embedding calls.
- **No file-level search** — full-text search on filenames and metadata isn't implemented; only semantic vector search on chunk content.
- **Free-tier cold starts** — Render's free tier sleeps after 15 minutes of inactivity, causing ~50s cold starts.
- **Supabase pause** — free-tier databases pause after 7 days of inactivity and require manual reactivation.
- **No pagination on global search results** — the global Q&A returns top-k chunks in a single response.
- **No streaming responses** — answers are returned as a complete response, not streamed token-by-token.

### Potential Enhancements

- [ ] WebSocket or SSE for real-time processing progress
- [ ] Streaming LLM responses (token-by-token answer delivery)
- [ ] Batch embedding with `embed_content` batch API
- [ ] Multi-modal RAG (image content analysis via Gemini Vision)
- [ ] Document versioning and diff tracking
- [ ] Role-based access control (team workspaces)
- [ ] Full-text metadata search alongside vector search
- [ ] Rate limiting and API key rotation
- [ ] Automated CI/CD pipeline with GitHub Actions

---

## Licence

This repository **does not include an open-source licence**. The source code is publicly visible for portfolio review and educational reference.

Under default copyright law (as [explained by GitHub](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository#choosing-the-right-license)), you retain exclusive copyright. Others may view and fork the repository on GitHub, but may not use, modify, or distribute the code without your explicit permission.

If you are interested in using any part of this project, please reach out first.
