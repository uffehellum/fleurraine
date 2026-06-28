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
