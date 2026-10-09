# Backend Architecture

## Service boundaries

### 1. Claims API

Owns authentication, claims, lifecycle validation, document uploads, MongoDB persistence, REST endpoints, and Socket.io.

### 2. AI/RAG Service

Owns policy/product retrieval from Chroma, LangGraph orchestration, prompt construction, and local Ollama inference.

This intentionally avoids one microservice per domain. The boundaries are based on operational responsibility rather than individual tables or endpoints.

## Request flow

`React -> Claims API -> MongoDB Atlas`

`React -> Claims API -> AI/RAG Service -> Chroma (policy retrieval) -> Ollama (local generation)`

`React <-> Socket.io on Claims API`

## AI safety boundary

1. Claim data is passed to the AI service.
2. The LangGraph workflow retrieves policy/product context.
3. Empty retrieval is a hard degraded path.
4. Claims do not require a policy number. The semantic retrieval query uses the claim type and incident description; legacy policy numbers remain optional stored metadata, not retrieval constraints.
5. Multiple semantically retrieved policy candidates are passed to Ollama, excluding documents explicitly labeled with a different claim type. There is no one-policy restriction. No matching context produces a degraded response; semantic similarity and product context do not prove individual coverage.
6. Model JSON contains exactly `summary`, `relevantConditions`, `missingInformation`, and `recommendedNextAction`. Each condition contains a retrieved `reference`, a verbatim policy quotation in `condition`, a claim-specific `relevance`, and an `effect`: `SUPPORTS_ACCEPTANCE`, `SUPPORTS_REJECTION`, or `NEEDS_REVIEW`. The schema permits only actual retrieved references, quotations are checked against the cited source with whitespace normalization, and only cited sources are returned. The three finding sections remain unchanged and the summary is capped at 400 characters. Decision authority is added by the server, not the model.
7. The API stores only the assessment summary; status changes remain a separate human-controlled endpoint. Schema validation cannot guarantee factual correctness, so human review remains required.
8. Recommended action may recommend acceptance or rejection for officer review only where explicit quoted coverage or exclusion clauses and known facts justify it. Missing facts, conflicting clauses, or documents without decisive coverage/exclusion terms require further review rather than an invented decision.

## Storage

MongoDB Atlas stores application data. Uploaded documents are stored in the API service's `uploads/` directory and their metadata is stored on the claim.
