# Deployment Guide

## Deploying to Fly.io

### Quick Deploy

If you already have Fly.io set up with database and secrets configured:

```bash
fly deploy -a fleurraine
```

The Dockerfile handles everything automatically:
1. Reads OAuth client IDs from `.env`
2. Builds React frontend with Vite
3. Embeds frontend in Go binary
4. Deploys single container

Check status: `fly status -a fleurraine`  
View logs: `fly logs -a fleurraine`

---

## Dev Environment Setup (`fleurraine-dev`)

To configure and launch a completely isolated development environment that mirrors production but keeps your databases and image buckets separated:

### 1. Create Dev App
```bash
fly apps create fleurraine-dev
```

### 2. Create Dev Database
```bash
fly postgres create --name fleurraine-db-dev --region sjc
fly postgres attach fleurraine-db-dev -a fleurraine-dev
```
This automatically sets the dev-specific `DATABASE_URL` secret.

### 3. Create Dev S3-Compatible Storage (Tigris Bucket)
```bash
# Create dev Tigris storage and configure secret mapping
fly secrets set -a fleurraine-dev \
  TIGRIS_BUCKET="fleurraine-bucket-dev" \
  TIGRIS_ACCESS_KEY_ID="<DEV_ACCESS_KEY_ID>" \
  TIGRIS_SECRET_ACCESS_KEY="<DEV_SECRET_ACCESS_KEY>" \
  TIGRIS_ENDPOINT_URL="https://fly.storage.tigris.dev"
```

### 4. Configure Auth Redirects (Google & Facebook)
Google and Facebook OAuth redirects are calculated dynamically using the active `window.location.origin`. Since both use the same credentials but separate redirects, simply add the following URLs to your existing Google and Facebook developer consoles:

- **Google Developer Console (Authorized redirect URIs):**
  - `https://fleurraine-dev.fly.dev/auth/callback?provider=google`
- **Facebook Login (Valid OAuth Redirect URIs):**
  - `https://fleurraine-dev.fly.dev/auth/callback?provider=facebook`

Set the secrets for `fleurraine-dev` with the exact same credential IDs:
```bash
fly secrets set -a fleurraine-dev \
  GOOGLE_CLIENT_ID="..." \
  GOOGLE_CLIENT_SECRET="..." \
  FACEBOOK_APP_ID="..." \
  FACEBOOK_APP_SECRET="..." \
  ALLOWED_ORIGINS="https://fleurraine-dev.fly.dev"
```

### 5. Automated Deployments (CI/CD)
Automated deployments are handled via GitHub Actions:
1. Every time a **Pull Request (merge request)** is opened or updated, the GitHub workflow automatically builds and deploys to `fleurraine-dev`.
2. When changes are merged into the **`main` branch**, the workflow deploys the changes to the production app `fleurraine`.

For GitHub Actions to be able to authenticate and deploy to Fly.io, you **must configure your repository secrets**:

1. **Generate a Fly.io Deploy Token:**
   Run the following command in your terminal to generate a token:
   ```bash
   fly tokens create deploy
   ```
   *(Alternatively, log in to your [Fly.io Dashboard](https://fly.io/), navigate to your account settings, go to the **Access Tokens** section, and create a new token.)*

2. **Add the Secret to GitHub:**
   - Go to your repository on GitHub.
   - Navigate to **Settings** -> **Secrets and variables** -> **Actions**.
   - Click the **New repository secret** button.
   - Set the name to: `FLY_API_TOKEN`
   - Paste the generated token into the Value field and click **Add secret**.

---

## First-Time Setup

### 1. Install Fly CLI

```bash
# macOS
brew install flyctl

# Linux
curl -L https://fly.io/install.sh | sh

# Windows
iwr https://fly.io/install.ps1 -useb | iex
```

Login:

```bash
fly auth login
```

### 2. Create App

```bash
fly apps create fleurraine
```

Or use existing `fly.toml`:

```bash
fly launch --no-deploy
```

### 3. Create PostgreSQL Database

```bash
fly postgres create --name fleurraine-db --region sjc
fly postgres attach fleurraine-db -a fleurraine
```

This automatically sets `DATABASE_URL` secret.

### 4. Create Tigris Storage

```bash
fly storage create -a fleurraine
```

Map the output to TIGRIS variables:

```bash
fly secrets set -a fleurraine \
  TIGRIS_BUCKET="<BUCKET_NAME>" \
  TIGRIS_ACCESS_KEY_ID="<AWS_ACCESS_KEY_ID>" \
  TIGRIS_SECRET_ACCESS_KEY="<AWS_SECRET_ACCESS_KEY>" \
  TIGRIS_ENDPOINT_URL="https://fly.storage.tigris.dev"
```

### 5. Set Application Secrets

See [SECRETS.md](SECRETS.md) for complete list.

Minimum required:

```bash
fly secrets set -a fleurraine \
  ADMIN_EMAILS="your-email@example.com" \
  GOOGLE_CLIENT_ID="..." \
  GOOGLE_CLIENT_SECRET="..." \
  ALLOWED_ORIGINS="https://fleurraine.fly.dev"
```

### 6. Configure OAuth Redirect URIs

Add to your OAuth provider consoles:

**Google:** [Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
- `https://fleurraine.fly.dev/auth/callback?provider=google`

**Facebook:** [Meta Developers](https://developers.facebook.com/apps/)
- `https://fleurraine.fly.dev/auth/callback?provider=facebook`

### 7. Deploy

```bash
fly deploy -a fleurraine
```

---

## Scaling

### Increase Memory

Edit `fly.toml`:

```toml
[[vm]]
  size = "shared-cpu-1x"
  memory = "512mb"  # or "1gb"
```

Then deploy:

```bash
fly deploy -a fleurraine
```

### Add More Instances

```bash
fly scale count 2 -a fleurraine
```

### Change Region

```bash
fly regions add sea -a fleurraine
fly regions remove sjc -a fleurraine
```

---

## Custom Domain

### Add Domain

```bash
fly certs add fleurraine.com -a fleurraine
```

### Check Certificate Status

```bash
fly certs check fleurraine.com -a fleurraine
```

### Update DNS

Add the records shown by `fly certs check`:

```
A     @    <fly-ip-address>
AAAA  @    <fly-ipv6-address>
```

### Update Configuration

After DNS propagates, update:

1. **Secrets:**
   ```bash
   fly secrets set -a fleurraine \
     ALLOWED_ORIGINS="https://fleurraine.com"
   ```

2. **OAuth Redirect URIs:**
   - Google: `https://fleurraine.com/auth/callback?provider=google`
   - Facebook: `https://fleurraine.com/auth/callback?provider=facebook`

---

## Monitoring

### View Logs

```bash
# Real-time logs
fly logs -a fleurraine

# Last 100 lines
fly logs -a fleurraine | tail -100

# Filter by region
fly logs -a fleurraine --region sjc
```

### Check Status

```bash
fly status -a fleurraine
```

### View Metrics

```bash
fly dashboard -a fleurraine
```

Or visit: https://fly.io/apps/fleurraine

---

## Troubleshooting

### App Won't Start

Check logs:
```bash
fly logs -a fleurraine
```

Common issues:
- Missing `DATABASE_URL` secret
- Database not attached
- Invalid OAuth credentials

### Out of Memory

Increase memory in `fly.toml`:
```toml
memory = "512mb"  # or "1gb"
```

### Database Connection Issues

Verify database is attached:
```bash
fly postgres list
fly postgres attach fleurraine-db -a fleurraine
```

### Secrets Not Working

List secrets:
```bash
fly secrets list -a fleurraine
```

Set missing secrets:
```bash
fly secrets set -a fleurraine KEY="value"
```

---

## Rollback

### View Releases

```bash
fly releases -a fleurraine
```

### Rollback to Previous Version

```bash
fly releases rollback -a fleurraine
```

---

## Maintenance

### Restart App

```bash
fly apps restart fleurraine
```

### SSH into Container

```bash
fly ssh console -a fleurraine
```

### Run Database Migrations Manually

Migrations run automatically on startup, but to run manually:

```bash
fly ssh console -a fleurraine
./fleurraine migrate
```
