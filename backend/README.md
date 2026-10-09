# Claims AI Backend — Compact Microservice Architecture

Backend for the insurance claims review capstone.

## Architecture

```text
React UI
   |
   v
[API Service :4000]
  |  JWT/Auth
  |  Claims + MongoDB Atlas
  |  Document metadata + local/multipart upload
  |  Socket.io
  |  Assessment orchestration
  v
[AI Service :4100]
  |  Chroma Cloud retrieval
  |  Local Ollama inference
  v
qwen2.5:1.5b
```

Only two deployable services are used. The API service owns business/domain logic; the AI service owns RAG and model interaction. Socket.io stays in the API service rather than becoming another microservice.

## Requirements

- Node.js 20+
- MongoDB Atlas
- Chroma Cloud
- Ollama running locally with the configured model installed (no Hugging Face credits or token required)

## Setup

1. Configure `backend/.env` with your database and Chroma credentials, plus the Ollama settings listed below.
2. Install dependencies:

```bash
npm install
npm install --workspaces
```

3. Install [Ollama](https://ollama.com/download), start the Ollama application, and download the model once:

```bash
ollama pull qwen2.5:1.5b
ollama list
```

If the Ollama command is not found, reopen your terminal after installation.
Ollama should be reachable at `http://localhost:11434`; use `ollama serve` if the
application is not already running. Do not start a second server on the same port.

Start both backend services:

```bash
npm run dev
```

API: `http://localhost:4000`
AI: `http://localhost:4100`

4. Seed a demo user and claims:

```bash
npm run seed
```

Demo logins (all use password `Password123!`):

- `customer@example.com` (customer), `officer@example.com` and `officer2@example.com` (claims officers), `manager@example.com` (claims manager)

Roles:

- Customers self-register (`POST /auth/register`), submit claims (`POST /api/claims`), upload documents and follow their claim timeline.
- New claims are assigned to claims officers round robin. Officers see only their assigned claims, use AI assessment, request information and approve/reject (approval above `OFFICER_APPROVAL_LIMIT`, default 200000, needs a manager).
- Managers see all claims, handle settlement (`SETTLEMENT_IN_PROGRESS`, `CLOSED`) and create officers (`POST /api/users/officers`).

5. Ingest policy/product documents into Chroma:

```bash
npm run ingest
```

Place JSON documents in `scripts/products.json` or edit the included sample before running ingestion.

## Backend checks

From the `backend` directory, with both services running:

```powershell
powershell -ExecutionPolicy Bypass -File .\check.ps1
```

The script uploads a document and attempts status changes on the selected claim;
run it against demo data. Failed or skipped claim checks produce a nonzero exit.
Claims are returned in the `items` array, and claim-type filtering uses `type`.

Chroma Cloud uses the `X-Chroma-Token` authentication header. Text retrieval and
ingestion require `chromadb-default-embed`, installed with the AI workspace.
After changing service code or environment values, restart the affected service.
If search returns no policies, run `npm run ingest` before rerunning the checks.

## Environment variables

The backend reads:

- `MONGODB_URI` for MongoDB Atlas.
- `OLLAMA_URL` for the local Ollama server, defaulting to `http://localhost:11434`.
- `OLLAMA_MODEL` for an installed local model, defaulting to `qwen2.5:1.5b`.
- `OLLAMA_TIMEOUT_MS` for local generation, defaulting to `180000` (3 minutes). The API allows an additional 30 seconds for retrieval and transport.
- `CHROMA_HOST`, `CHROMA_API_KEY`, `CHROMA_TENANT`, `CHROMA_DATABASE` for Chroma Cloud.

```dotenv
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:1.5b
OLLAMA_TIMEOUT_MS=180000
```

Model generation is local; policy retrieval still uses Chroma Cloud. The first
assessment may take longer while the model loads. Restart both backend services
after changing the timeout or model configuration. Missing models, unavailable
Ollama servers, timeouts, and invalid model output produce advisory degraded
responses rather than saving a successful assessment.

Run the AI regression tests from `backend`:

```bash
npm test -w ai
```

## API

- `POST /auth/login`
- `GET /api/claims`
- `GET /api/claims/:id`
- `PATCH /api/claims/:id/status`
- `GET /api/policies/search?q=...`
- `POST /api/claims/:id/documents` — multipart field `document`; files are stored in `uploads/` for this non-AWS build.
- `POST /api/claims/:id/generate-assessment`
- `GET /health`
- `GET /health/ai`

## Status lifecycle

`NEW -> UNDER_REVIEW -> ADDITIONAL_INFO_REQUIRED -> UNDER_REVIEW -> APPROVED/REJECTED -> SETTLEMENT_IN_PROGRESS -> CLOSED`

The service validates transitions server-side. AI never changes status and never makes the final approval/rejection decision.

## Notes

- AI output is advisory and grounded in retrieved Chroma context.
- The AI service returns retrieved policy references alongside the assessment.
- Missing information is explicitly requested by the prompt and response schema.
- Customer data is not intentionally written to application logs.
- The upload implementation uses local filesystem storage under `uploads/`.
