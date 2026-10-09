# Claims AI Frontend

React/Vite frontend for the Claims AI backend supplied with this project.

## Features
- JWT login using `POST /auth/login`
- Claims dashboard with status/type/priority filters
- Claim detail view
- Status transitions enforced by backend
- Supporting-document upload
- Grounded AI claim assessment
- Policy knowledge-base search
- Socket.IO live claim status updates
- Responsive desktop/mobile UI

## Run

```bash
npm install
cp .env.example .env
npm run dev
```

The default API URL is `http://localhost:4000` and Socket.IO URL is `http://localhost:4000`.

For a production build:

```bash
npm run build
npm run preview
```

## Backend compatibility
The UI targets the routes visible in the supplied backend source, including `/auth/login`, `/api/claims`, `/api/claims/:id`, `/api/claims/:id/status`, `/api/claims/:id/documents`, `/api/claims/:id/generate-assessment`, and `/api/policies/search`.
