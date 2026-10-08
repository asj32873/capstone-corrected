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
  |  Hugging Face Inference API
  v
Qwen/Qwen2.5-Coder-3B-Instruct:nscale
```

Only two deployable services are used. The API service owns business/domain logic; the AI service owns RAG and model interaction. Socket.io stays in the API service rather than becoming another microservice.

## Requirements

- Node.js 20+
- MongoDB Atlas
- Chroma Cloud
- Hugging Face token with access to the configured model

## Setup

1. Copy `.env.example` to `.env` and fill in your credentials.
2. Install dependencies:

```bash
npm install
npm install --workspaces
```

3. Start both services:

```bash
npm run dev
```

API: `http://localhost:4000`
AI: `http://localhost:4100`

4. Seed a demo user and claims:

```bash
npm run seed
```

Demo login:

- email: `officer@example.com`
- password: `Password123!`

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
- `HF_TOKEN` or `HUGGINGFACEHUB_API_KEY` for Hugging Face.
- `HF_MODEL` for the model, defaulting to `Qwen/Qwen2.5-Coder-3B-Instruct:nscale`.
- `CHROMA_HOST`, `CHROMA_API_KEY`, `CHROMA_TENANT`, `CHROMA_DATABASE` for Chroma Cloud.

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
