# Secrets and Environment Variables

## Overview

Fleurraine uses environment variables for configuration. Secrets are managed differently in local development vs production.

- **Local:** `.env` file (backend) and `web/.env.local` (frontend)
- **Production:** Fly.io secrets (backend) and Docker build args (frontend)

---

## Local Development

### Backend (.env)

Copy the example file:

```bash
cp .env.example .env
```

Required variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://postgres:postgres@localhost:5432/fleurraine?sslmode=disable` |
| `ADMIN_EMAILS` | Comma-separated admin emails | `lorraine@example.com,admin@example.com` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | `123456789-abc.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | `GOCSPX-...` |

Optional variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `FACEBOOK_APP_ID` | Facebook OAuth app ID | - |
| `FACEBOOK_APP_SECRET` | Facebook OAuth app secret | - |
| `ANTHROPIC_API_KEY` | Claude AI API key (for photo classification) | - |
| `RESEND_API_KEY` | Resend API key (for emails) | - |
| `TIGRIS_BUCKET` | Tigris/S3 bucket name | - |
| `TIGRIS_ACCESS_KEY_ID` | Tigris/S3 access key | - |
| `TIGRIS_SECRET_ACCESS_KEY` | Tigris/S3 secret key | - |
| `TIGRIS_ENDPOINT_URL` | Tigris/S3 endpoint | `https://fly.storage.tigris.dev` |
| `SESSION_SECRET` | Session encryption key | Auto-generated |
| `ALLOWED_ORIGINS` | CORS allowed origins | `http://localhost:5173` |
| `PORT` | Server port | `8080` |

Load environment variables before starting the server:

```bash
set -a && source .env && set +a
go run ./cmd/server
```

### Frontend (web/.env.local)

Copy the example file:

```bash
cp web/.env.example web/.env.local
```

Required variables:

| Variable | Description |
|----------|-------------|
| `VITE_GOOGLE_CLIENT_ID` | Same as backend `GOOGLE_CLIENT_ID` |
| `VITE_FACEBOOK_APP_ID` | Same as backend `FACEBOOK_APP_ID` (optional) |

These are embedded in the frontend build and are **public** (visible in browser).

---

## Deployment Flows

Fleurraine has two Fly.io apps:
- **`fleurraine-dev`** — dev/staging environment (deploys on every PR)
- **`fleurraine`** — production environment (deploys on merge to `main`)

### Manual Deployment (Dev)

To deploy manually to the dev app:

```bash
fly deploy -a fleurraine-dev
```

Secrets for the dev app are set separately:

```bash
fly secrets set -a fleurraine-dev \
  ADMIN_EMAILS="lorraine@example.com" \
  ADMIN_EMAIL="lorraine@example.com" \
  GOOGLE_CLIENT_ID="..." \
  GOOGLE_CLIENT_SECRET="..." \
  ANTHROPIC_API_KEY="..." \
  RESEND_API_KEY="..." \
  ALLOWED_ORIGINS="https://fleurraine-dev.fly.dev" \
  SESSION_SECRET="$(openssl rand -hex 32)" \
  STRIPE_SECRET_KEY="sk_test_..." \
  STRIPE_WEBHOOK_SECRET="whsec_..." \
  SALES_TAX_RATE="0.09" \
  SALES_TAX_LABEL="Camano Island Sales Tax (9%)" \
  APP_URL="https://fleurraine-dev.fly.dev"
```

### GitHub Actions Deployment

The workflow in `.github/workflows/deploy.yml` automates deployments:

- **Pull Request opened/synced** → deploys to `fleurraine-dev` with `VITE_APP_ENV=development`
- **Push to `main`** (merge) → deploys to `fleurraine` (production) with `VITE_APP_ENV=production`

The only GitHub secret required is:

| GitHub Secret | Description |
|---------------|-------------|
| `FLY_API_TOKEN` | Fly.io API token for deploying (generate at https://fly.io/app/personal-access-tokens) |

**Important:** GitHub Actions does NOT set application secrets. All app-level secrets (database, OAuth, Stripe, etc.) must be pre-set on each Fly app via `fly secrets set`. The workflow only runs `flyctl deploy` — it does not pass secrets.

### Production Secrets

Set secrets on the production app:

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
  ALLOWED_ORIGINS="https://fleurraine.fly.dev" \
  SESSION_SECRET="$(openssl rand -hex 32)" \
  STRIPE_SECRET_KEY="sk_live_..." \
  STRIPE_WEBHOOK_SECRET="whsec_..." \
  SALES_TAX_RATE="0.09" \
  SALES_TAX_LABEL="Camano Island Sales Tax (9%)" \
  APP_URL="https://fleurraine.fly.dev"
```

### List Secrets

```bash
fly secrets list -a fleurraine
fly secrets list -a fleurraine-dev
```

### Update a Secret

```bash
fly secrets set -a fleurraine KEY="new-value"
fly secrets set -a fleurraine-dev KEY="new-value"
```

### Remove a Secret

```bash
fly secrets unset -a fleurraine KEY
fly secrets unset -a fleurraine-dev KEY
```

---

## OAuth Configuration

### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create OAuth 2.0 Client ID (Web application)
3. Add authorized redirect URIs:
   - Local: `http://localhost:5173/auth/callback?provider=google`
   - Production: `https://fleurraine.fly.dev/auth/callback?provider=google`
4. Copy Client ID and Client Secret

### Facebook OAuth

1. Go to [Meta for Developers](https://developers.facebook.com/apps/)
2. Create a new app (Consumer type)
3. Add Facebook Login product
4. Configure OAuth redirect URIs:
   - Local: `http://localhost:5173/auth/callback?provider=facebook`
   - Production: `https://fleurraine.fly.dev/auth/callback?provider=facebook`
5. Copy App ID and App Secret

---

## Tigris Storage

### Create Storage

```bash
fly storage create -a fleurraine
```

This outputs:

```
BUCKET_NAME=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_ENDPOINT_URL_S3=https://fly.storage.tigris.dev
```

### Map to TIGRIS Variables

```bash
fly secrets set -a fleurraine \
  TIGRIS_BUCKET="<BUCKET_NAME>" \
  TIGRIS_ACCESS_KEY_ID="<AWS_ACCESS_KEY_ID>" \
  TIGRIS_SECRET_ACCESS_KEY="<AWS_SECRET_ACCESS_KEY>" \
  TIGRIS_ENDPOINT_URL="https://fly.storage.tigris.dev"
```

---

## Anthropic AI

### Get API Key

1. Sign up at [Anthropic Console](https://console.anthropic.com/)
2. Create an API key
3. Set the secret:

```bash
fly secrets set -a fleurraine ANTHROPIC_API_KEY="sk-ant-api03-..."
fly secrets set -a fleurraine-dev ANTHROPIC_API_KEY="sk-ant-api03-..."
```

---

## Stripe Payments

### Get API Keys

1. Sign up at [Stripe Dashboard](https://dashboard.stripe.com)
2. Get your API keys from Developers → API keys:
   - **Test mode**: `sk_test_...` (for dev)
   - **Live mode**: `sk_live_...` (for production)
3. Set the secret:

```bash
# Dev (test mode)
fly secrets set -a fleurraine-dev STRIPE_SECRET_KEY="sk_test_..."

# Production (live mode)
fly secrets set -a fleurraine STRIPE_SECRET_KEY="sk_live_..."
```

### Webhook Signing Secret

1. Go to Stripe Dashboard → Developers → Webhooks → Add endpoint
2. Set the endpoint URL:
   - Dev: `https://fleurraine-dev.fly.dev/api/payments/webhook`
   - Prod: `https://fleurraine.fly.dev/api/payments/webhook`
3. Select the `checkout.session.completed` event
4. Copy the signing secret (`whsec_...`) from the endpoint detail page
5. Set it:

```bash
fly secrets set -a fleurraine-dev STRIPE_WEBHOOK_SECRET="whsec_..."
fly secrets set -a fleurraine STRIPE_WEBHOOK_SECRET="whsec_..."
```

### Sales Tax

The app applies a fixed sales tax rate (default 9% for Camano Island):

```bash
fly secrets set -a fleurraine-dev SALES_TAX_RATE="0.09" SALES_TAX_LABEL="Camano Island Sales Tax (9%)"
fly secrets set -a fleurraine SALES_TAX_RATE="0.09" SALES_TAX_LABEL="Camano Island Sales Tax (9%)"
```

### Apple Pay

Stripe Checkout automatically shows Apple Pay as the first payment option on iPhone Safari. No code changes needed — just enable Apple Pay in your Stripe Dashboard settings and verify your domain.

---

## Resend Email

### Get API Key

1. Sign up at [Resend](https://resend.com/)
2. Create an API key
3. Set the secret:

```bash
fly secrets set -a fleurraine RESEND_API_KEY="re_..."
fly secrets set -a fleurraine-dev RESEND_API_KEY="re_..."
```

---

## Security Best Practices

### Never Commit Secrets

Add to `.gitignore`:

```
.env
web/.env.local
*.pem
*.key
```

### Rotate Secrets Regularly

```bash
# Generate new session secret
fly secrets set -a fleurraine SESSION_SECRET="$(openssl rand -hex 32)"

# Rotate OAuth credentials in provider console, then update
fly secrets set -a fleurraine GOOGLE_CLIENT_SECRET="new-secret"
```

### Use Different Secrets for Each Environment

- Local development: Use test/development credentials
- Production: Use production credentials with restricted permissions

### Limit Secret Access

Only admins should have access to:
- Fly.io account
- OAuth provider consoles
- API key dashboards

---

## Troubleshooting

### Secret Not Working

1. Verify secret is set:
   ```bash
   fly secrets list -a fleurraine
   ```

2. Check secret value (be careful, this exposes the secret):
   ```bash
   fly ssh console -a fleurraine -C "env | grep KEY_NAME"
   ```

3. Restart app after setting secrets:
   ```bash
   fly apps restart fleurraine
   ```

### OAuth Redirect Mismatch

Ensure redirect URIs match exactly:
- Protocol (http vs https)
- Domain (localhost vs fly.dev vs custom domain)
- Port (5173 for local dev)
- Path (`/auth/callback?provider=google`)

### Database Connection Failed

Verify `DATABASE_URL` is set:

```bash
fly secrets list -a fleurraine | grep DATABASE_URL
```

If missing, attach database:

```bash
fly postgres attach fleurraine-db -a fleurraine
```
