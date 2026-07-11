# CMMS — Comedy Material Management System

Organize, tag, search, and compose comedy material. Google Drive is the
source-of-truth for text content; a PostgreSQL database holds the relational
metadata. The core unit is the **segment** — a marked span of text inside a
Google Doc with a category (what it *is*: one-liner, bit, set…), tags (what
it's *about*), a color, and associations linking it to its derivatives and
callbacks in other documents.

```
┌─────────────────────────┐      ┌──────────────────────────────┐
│ frontend/  React 18 SPA │─────▶│ backend/  Express REST API   │
│ Vite + Tailwind + TSQ   │ /api │ TypeScript + zod + JWT auth  │
└─────────────────────────┘      └──────┬───────────────┬───────┘
                                        ▼               ▼
                              ┌──────────────┐  ┌───────────────────┐
                              │ PostgreSQL   │  │ Google Drive/Docs │
                              │ metadata,    │  │ APIs (documents,  │
                              │ FTS, colors  │  │ named ranges)     │
                              └──────────────┘  └───────────────────┘
```

## Features

- **Segments** with categories, tags, auto-assigned colors, and full-text search
  (PostgreSQL `tsvector` + `ts_headline` highlighting, faceted results)
- **Associations** between segments (derivative / callback / reference);
  recoloring a segment propagates through its whole association cluster
- **Color algorithm**: distinct colors within a document, least-recently-used
  rotation, same segment = same color everywhere
- **Google integration**: OAuth 2.0 sign-in, per-user token storage with
  automatic refresh, document registration via Drive, sync of segment marker
  positions from Google Docs named ranges (`cmms_segment_<uuid>`)
- **Dev login** so the whole stack runs without any Google credentials

## Prerequisites

- Node.js ≥ 20
- PostgreSQL ≥ 14 (or Docker for the compose file)
- A Google Cloud OAuth client (optional — only for real Drive/Docs features)

## 1. Database

Local PostgreSQL:

```bash
sudo -u postgres psql -c "CREATE USER cmms PASSWORD 'cmms'" \
                      -c "CREATE DATABASE cmms OWNER cmms"
psql postgres://cmms:cmms@localhost:5432/cmms -f backend/schema.sql
```

Or with Docker (applies the schema automatically on first start):

```bash
docker compose up -d postgres
```

## 2. Backend

```bash
cd backend
cp .env.example .env    # then edit values (see below)
npm install
npm run dev             # http://localhost:3001
```

`.env` values:

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | e.g. `postgres://cmms:cmms@localhost:5432/cmms` |
| `JWT_SECRET` | any random string ≥ 32 chars (`openssl rand -hex 32`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | from Google Cloud (placeholders keep the server bootable) |
| `GOOGLE_REDIRECT_URI` | must byte-match the URI registered in Google Cloud |
| `FRONTEND_URL` | where the SPA runs (`http://localhost:5173` in dev) |
| `ALLOW_DEV_LOGIN` | `true` enables `POST /api/v1/auth/dev-login` (ignored in production) |

## 3. Frontend

```bash
cd frontend
cp .env.example .env    # VITE_ALLOW_DEV_LOGIN=true shows the dev-login button
npm install
npm run dev             # http://localhost:5173 (proxies /api to :3001)
```

Open http://localhost:5173 and either **Sign in with Google** (needs real
credentials) or **Dev Login** (no Google account; Drive-dependent features
return a clean "Google account not connected" error).

## 4. Google Cloud setup (for real Drive/Docs integration)

1. Create a project at https://console.cloud.google.com and enable the
   **Google Drive API** and **Google Docs API**.
2. Configure the OAuth consent screen with these scopes:
   - `https://www.googleapis.com/auth/drive.file`
   - `https://www.googleapis.com/auth/drive.metadata.readonly`
   - `https://www.googleapis.com/auth/documents`
   - `openid`, `email`, `profile`
3. Create an **OAuth 2.0 Client ID** (type: *Web application*) with authorized
   redirect URI `http://localhost:3001/api/v1/auth/google/callback`.
4. Put the client ID and secret in `backend/.env`.

The app uses the privacy-preserving `drive.file` scope: it can only access
files it created or that you explicitly registered — never your whole Drive.

## Testing

```bash
cd backend && npm test          # vitest unit tests (color algorithm, Docs parsing, errors)
./scripts/smoke.sh              # end-to-end API regression against a running backend
```

The smoke script uses dev login and covers seeding, tag/segment CRUD, color
auto-assignment and cluster propagation, associations, faceted search, and
graceful Drive failures.

## API overview

All endpoints live under `/api/v1` and require `Authorization: Bearer <jwt>`
(from the Google callback or dev login). Highlights:

| Area | Endpoints |
| --- | --- |
| Auth | `GET /auth/google`, `GET /auth/google/callback`, `GET/PATCH /auth/me`, `POST /auth/dev-login` |
| Documents | `GET/POST /documents`, `POST /documents/from-selection`, `POST /documents/:id/sync`, `DELETE /documents/:id` |
| Segments | `GET/POST /segments`, `GET /segments/:id`, `GET /segments/:id/associations`, `POST /segments/:id/associate`, `PUT /segments/:id`, `PUT /segments/:id/color`, `PUT /segments/:id/markers`, tag add/remove, `DELETE /segments/:id` |
| Categories | CRUD + `PUT /categories/reorder` + delete-with-migrate |
| Tags | CRUD + `POST /tags/bulk` + `GET /tags/autocomplete` |
| Search | `POST /search` (full-text + filters + facets) |
| Sync | `POST /sync/full`, `POST /sync/document/:id`, `GET /sync/status` |
| Colors | `GET /colors/suggest?document_id=` |

## Production notes

- Serve the built SPA (`frontend/dist`) same-origin with the API, or configure
  CORS and an absolute API base URL.
- `ALLOW_DEV_LOGIN` is ignored when `NODE_ENV=production`, but leave it unset
  there anyway.
- Google tokens are stored per-user in `user_google_tokens`; rotating the
  OAuth client secret only requires updating `backend/.env`.

## Roadmap (spec phases not yet built)

- Chrome extension / Google Docs sidebar (marker placement, quick tagging,
  insert-from-library)
- Drive webhooks for push-based sync
- Set composition tools, analytics, sharing, export
