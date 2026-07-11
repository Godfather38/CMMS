# CMMS — Comedy Material Management System

Organize, tag, search, and compose comedy material. Google Drive is the
source-of-truth for text content; a PostgreSQL database holds the relational
metadata: segments (marked sections of text), categories, tags, cross-document
associations, and colors.

```
frontend/   React 18 + TypeScript + Vite + Tailwind (web app)
backend/    Node.js + Express + TypeScript (REST API, /api/v1)
            PostgreSQL 14+ (metadata), Google Drive/Docs APIs (content)
```

Setup and run instructions are being finalized — see `backend/.env.example`
and `frontend/.env.example` once present.
