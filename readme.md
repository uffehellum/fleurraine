# Fleurraine

A mobile-first PWA for Lorraine's flower stand — photo galleries, custom orders, and weekly subscriptions. The stack is a Go API (`chi`) with a React + Vite frontend, PostgreSQL, and Tigris object storage, deployed on [Fly.io](https://fly.io).

## Prerequisites

- **Go** 1.23+
- **Node.js** 22+ and npm
- **PostgreSQL** 15+ (local install or Docker)
- **Fly CLI** — [install flyctl](https://fly.io/docs/hands-on/install-flyctl/) (for deployment)

Optional for full functionality:

- Google and/or Facebook OAuth apps
- Tigris / S3-compatible storage (for photo uploads)
- Anthropic API key (AI photo categorization)
- Resend API key (order/subscription emails)

---

## Run locally

Local development runs the Go API and Vite dev server separately. Vite proxies `/api` requests to the Go server.

### 1. PostgreSQL

Start a local database (Docker example):

```bash
docker run --name fleurraine-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=fleurraine \
  -p 5432:5432 \
  -d postgres:16
```

Connection string:

```
postgres://postgres:postgres@localhost:5432/fleurraine?sslmode=disable
```

### 2. Environment variables

Copy the example files and fill in values:

```bash
cp .env.example .env
cp web/.env.example web/.env.local
```

**Backend** (`.env`) — minimum to start the server:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `ADMIN_EMAILS` | Comma-separated admin emails (e.g. Lorraine's Google email) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth (backend token exchange) |
| `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` | Facebook OAuth (optional) |

See `.env.example` for the full list (Tigris, Anthropic, Resend, etc.).

**Frontend** (`web/.env.local`) — public OAuth client IDs:

| Variable | Description |
|----------|-------------|
| `VITE_GOOGLE_CLIENT_ID` | Same Client ID as `GOOGLE_CLIENT_ID` |
| `VITE_FACEBOOK_APP_ID` | Same App ID as `FACEBOOK_APP_ID` (optional) |

The Go server does not load `.env` automatically. Export variables before starting the backend:

```bash
set -a && source .env && set +a
```

### 3. OAuth redirect URIs

Register these redirect URIs in your OAuth provider consoles:

| Provider | Redirect URI |
|----------|--------------|
| Google | `http://localhost:5173/auth/callback?provider=google` |
| Facebook | `http://localhost:5173/auth/callback?provider=facebook` |

- Google: [Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
- Facebook: [Meta app creation](https://developers.facebook.com/apps/creation/) → Facebook Login → Valid OAuth Redirect URIs

### 4. Start the backend

From the repository root:

```bash
set -a && source .env && set +a
go run ./cmd/server
```

The API listens on **http://localhost:8080**. Migrations run automatically on startup.

### 5. Start the frontend

In a second terminal:

```bash
cd web
npm install
npm run dev
```

Open **http://localhost:5173**. The Vite dev server proxies `/api/*` to port 8080.

### 6. Verify auth

1. Add your Google email to `ADMIN_EMAILS` in `.env`.
2. Restart the Go server.
3. Click **Sign in** → **Sign in with Google**.
4. After redirect, you should see your name in the header and admin links (Queue, Orders, Analytics).

---

## Deploy to Fly.io

The production image is built by the multi-stage `Dockerfile`: it compiles the React app, embeds it in the Go binary, and runs a single container on Fly.

### 1. Install and log in

```bash
fly auth login
```

### 2. Create the app (first time only)

The repo already includes `fly.toml` with `app = "fleurraine"`. If the app does not exist yet:

```bash
fly apps create fleurraine
```

Or run `fly launch --no-deploy` and keep the existing `fly.toml` settings (region `sea`, shared-cpu-1x, 256 MB).

### 3. PostgreSQL

Create and attach a Fly Postgres cluster:

```bash
fly postgres create --name fleurraine-db --region sea
fly postgres attach fleurraine-db -a fleurraine
```

This sets `DATABASE_URL` on the app automatically.

### 4. Tigris object storage

From the project directory:

```bash
fly storage create -a fleurraine
```

Fly sets `BUCKET_NAME`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_ENDPOINT_URL_S3`. This app reads **`TIGRIS_*`** variables instead, so map them:

```bash
fly secrets set -a fleurraine \
  TIGRIS_BUCKET="<BUCKET_NAME from output>" \
  TIGRIS_ACCESS_KEY_ID="<AWS_ACCESS_KEY_ID from output>" \
  TIGRIS_SECRET_ACCESS_KEY="<AWS_SECRET_ACCESS_KEY from output>" \
  TIGRIS_ENDPOINT_URL="https://fly.storage.tigris.dev"
```

Use the values printed when you ran `fly storage create`.

### 5. Application secrets

Set remaining secrets (adjust values):

```bash
fly secrets set -a fleurraine \
  ADMIN_EMAILS="lorraine@example.com" \
  ADMIN_EMAIL="lorraine@example.com" \
  GOOGLE_CLIENT_ID="..." \
  GOOGLE_CLIENT_SECRET="..." \
  FACEBOOK_APP_ID="..." \
  FACEBOOK_APP_SECRET="..." \
  ANTHROPIC_API_KEY="..." \
  RESEND_API_KEY="..." \
  ALLOWED_ORIGINS="https://fleurraine.fly.dev"
```

Add production OAuth redirect URIs in Google/Facebook:

- `https://fleurraine.fly.dev/auth/callback?provider=google`
- `https://fleurraine.fly.dev/auth/callback?provider=facebook`

When you add a custom domain, update `ALLOWED_ORIGINS` and the OAuth redirect URIs to match.

### 6. Frontend build variables (OAuth)

OAuth client IDs are embedded in the frontend at **Docker build time**. Pass them as build arguments when deploying:

```bash
fly deploy -a fleurraine \
  --build-arg VITE_GOOGLE_CLIENT_ID="your-google-client-id" \
  --build-arg VITE_FACEBOOK_APP_ID="your-facebook-app-id"
```

The Dockerfile must declare `ARG`/`ENV` for these (see `Dockerfile` frontend stage). If build args are omitted, the production bundle will not include working sign-in buttons.

### 7. Deploy

```bash
fly deploy -a fleurraine
```

Check status and logs:

```bash
fly status -a fleurraine
fly logs -a fleurraine
```

The app will be available at **https://fleurraine.fly.dev** (or your configured app name).

### 8. Custom domain (optional)

```bash
fly certs add fleurraine.com -a fleurraine
```

Follow the DNS instructions from `fly certs check`, then update `ALLOWED_ORIGINS` and OAuth redirect URIs to `https://fleurraine.com`.

---

## Project layout

```
cmd/server/          Go HTTP server (embeds built frontend)
internal/
  auth/              OAuth, sessions, admin role
  db/                PostgreSQL pool and migrations
  photos/            Image processing (EXIF, renditions, hashing)
  storage/           Tigris/S3 client
web/                 React + Vite + Tailwind PWA
  src/               Frontend source
fly.toml             Fly.io app configuration
Dockerfile           Multi-stage production build
.env.example         Backend environment template
web/.env.example     Frontend environment template
```

## Useful commands

| Task | Command |
|------|---------|
| Run Go tests | `go test ./...` |
| Run photo package tests | `go test ./internal/photos/...` |
| Build frontend | `cd web && npm run build` |
| Build production binary locally | `cd web && npm run build && cp -r dist ../cmd/server/static && go build -o fleurraine ./cmd/server` |
