# Backend Architecture

## Service boundaries

### 1. Claims API
Owns authentication, claims, lifecycle validation, document uploads, MongoDB persistence, REST endpoints, and Socket.io.

### 2. AI/RAG Service
Owns policy/product retrieval from Chroma, LangGraph orchestration, prompt construction, and Hugging Face inference.

This intentionally avoids one microservice per domain. The boundaries are based on operational responsibility rather than individual tables or endpoints.

## Request flow

`React -> Claims API -> MongoDB Atlas`

`React -> Claims API -> AI/RAG Service -> Chroma -> Hugging Face`

`React <-> Socket.io on Claims API`

## AI safety boundary

1. Claim data is passed to the AI service.
2. The LangGraph workflow retrieves policy/product context.
3. Empty retrieval is a hard degraded path.
4. The prompt explicitly prohibits invented policy facts and final decisions.
5. The model must return structured JSON.
6. The API stores only the assessment summary; status changes remain a separate human-controlled endpoint.

## Storage

MongoDB Atlas stores application data. Uploaded documents are stored in the API service's `uploads/` directory and their metadata is stored on the claim.
