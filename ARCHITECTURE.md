# System Architecture

## Overview

Fleurraine is a mobile-first Progressive Web App (PWA) for a local flower stand, built with:

- **Backend:** Go 1.23+ with Chi router
- **Frontend:** React 18 + Vite + Tailwind CSS
- **Database:** PostgreSQL 15+
- **Storage:** Tigris (S3-compatible)
- **Hosting:** Fly.io
- **AI:** Anthropic Claude (photo classification)
- **Email:** Resend

---

## System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Users                                │
│  (Mobile browsers, Desktop browsers, PWA installs)          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ HTTPS
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Fly.io Edge                               │
│  (TLS termination, Load balancing, CDN)                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Go HTTP Server (Chi)                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Static Files (React SPA)                            │  │
│  │  - Embedded in binary                                │  │
│  │  - Served at /                                       │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  API Routes (/api/*)                                 │  │
│  │  - Auth (OAuth, sessions)                            │  │
│  │  - Photos (upload, list, manage)                     │  │
│  │  - Orders (create, list, update)                     │  │
│  │  - Subscriptions (create, manage)                    │  │
│  │  - Analytics (track events)                          │  │
│  └──────────────────────────────────────────────────────┘  │
└───┬─────────────┬──────────────┬──────────────┬────────────┘
    │             │              │              │
    │             │              │              │
    ▼             ▼              ▼              ▼
┌────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│Postgres│  │  Tigris  │  │Anthropic │  │ Resend   │
│   DB   │  │ Storage  │  │   API    │  │   API    │
└────────┘  └──────────┘  └──────────┘  └──────────┘
```

---

## Components

### Frontend (React + Vite)

**Location:** `web/src/`

**Key Features:**
- Progressive Web App (installable)
- Mobile-first responsive design
- OAuth authentication (Google, Facebook)
- Photo upload with camera integration
- Real-time order tracking
- Subscription management

**Pages:**
- `/` - Home (latest stand photo)
- `/flowers` - Flower catalog
- `/garden` - Garden rows
- `/bouquets` - Bouquet gallery
- `/orders` - Order history
- `/subscribe` - Subscription plans
- `/admin/*` - Admin dashboard

**Build Process:**
1. Vite builds React app to `web/dist/`
2. Dockerfile copies `dist/` to `cmd/server/static/`
3. Go embeds static files in binary using `embed.FS`

### Backend (Go + Chi)

**Location:** `cmd/server/`, `internal/`

**Packages:**

| Package | Purpose |
|---------|---------|
| `auth` | OAuth (Google, Facebook), session management, admin roles |
| `db` | PostgreSQL connection pool, migrations |
| `photos` | Image processing, EXIF extraction, AI classification |
| `storage` | Tigris/S3 client for photo storage |
| `orders` | Custom flower order management |
| `subscriptions` | Weekly subscription plans |
| `analytics` | Event tracking |
| `email` | Transactional emails via Resend |
| `ai` | Anthropic Claude integration |

**Middleware:**
- CORS (configurable origins)
- Session authentication
- Admin role checking
- Request logging

### Database (PostgreSQL)

**Location:** `internal/db/migrations/`

**Tables:**

| Table | Purpose |
|-------|---------|
| `users` | User accounts (OAuth) |
| `sessions` | Active user sessions |
| `photos` | Photo metadata, storage keys, AI analysis |
| `orders` | Custom flower orders |
| `subscriptions` | Weekly subscription plans |
| `season_selections` | User flower preferences |
| `analytics_events` | Usage tracking |
| `schema_migrations` | Migration version tracking |

**Migrations:**
- Run automatically on server startup
- Idempotent (safe to run multiple times)
- Versioned (001, 002, 003, etc.)

### Storage (Tigris)

**Purpose:** Store photo renditions

**Structure:**
```
photos/
  {uuid}/
    original.jpg    # Original upload
    mobile.jpg      # 1200px wide
    thumb.jpg       # 150px wide
```

**Features:**
- S3-compatible API
- Global CDN
- Automatic backups
- Low latency

### AI (Anthropic Claude)

**Purpose:** Photo classification and species identification

**Features:**
- Categorize photos (stand, bouquet, flower_type, garden_row)
- Identify flower species
- Generate descriptions
- Verify review photos contain flowers
- Pre-fill Wikipedia links and season info

**Models:**
- `claude-3-5-sonnet-20240620` (vision + text)

### Email (Resend)

**Purpose:** Transactional emails

**Use Cases:**
- Order confirmations
- Subscription reminders
- Admin notifications

---

## Data Flow

### Photo Upload

```
1. User selects/captures photo in browser
2. Frontend sends multipart/form-data to /api/photos/upload
3. Backend:
   a. Reads image data
   b. Extracts EXIF metadata (timestamp, GPS, camera)
   c. Auto-orients image based on EXIF
   d. Generates renditions (thumb, mobile)
   e. Computes perceptual hash (duplicate detection)
   f. Sends to Claude AI for classification
   g. Uploads 3 renditions to Tigris
   h. Inserts record in photos table
4. Returns photo metadata to frontend
5. Frontend displays in gallery
```

### OAuth Authentication

```
1. User clicks "Sign in with Google"
2. Frontend redirects to Google OAuth
3. Google redirects back to /auth/callback?provider=google&code=...
4. Frontend sends code to /api/auth/callback
5. Backend:
   a. Exchanges code for access token
   b. Fetches user profile from Google
   c. Upserts user in database
   d. Creates session
   e. Sets session cookie
6. Frontend redirects to home page
7. User is authenticated
```

### Order Creation

```
1. User fills out order form
2. Frontend sends POST to /api/orders
3. Backend:
   a. Validates order data
   b. Inserts order in database
   c. Sends confirmation email via Resend
   d. Tracks analytics event
4. Returns order ID to frontend
5. Frontend shows confirmation
```

---

## Deployment Architecture

### Fly.io Setup

```
┌─────────────────────────────────────────┐
│  Fly.io App (fleurraine)                │
│  - Region: sjc (San Jose)               │
│  - VM: shared-cpu-1x, 512MB RAM         │
│  - Single container                     │
│  - Auto-restart on crash                │
└─────────────────┬───────────────────────┘
                  │
                  ├─► Postgres (fleurraine-db)
                  │   - Region: sjc
                  │   - Attached via DATABASE_URL
                  │
                  └─► Tigris Storage
                      - Global CDN
                      - Attached via TIGRIS_* secrets
```

### Scaling Options

**Vertical (increase resources):**
```bash
# Edit fly.toml
memory = "1gb"

# Deploy
fly deploy -a fleurraine
```

**Horizontal (add instances):**
```bash
fly scale count 2 -a fleurraine
```

**Geographic (add regions):**
```bash
fly regions add sea -a fleurraine
```

---

## Security

### Authentication
- OAuth 2.0 (Google, Facebook)
- Session cookies (HTTP-only, Secure, SameSite)
- 30-day session expiration
- Admin role based on email whitelist

### Authorization
- Public: Home, flowers, garden, bouquets
- Authenticated: Orders, subscriptions, photo reviews
- Admin: Photo management, order management, analytics

### Data Protection
- TLS/HTTPS everywhere (Fly.io handles certificates)
- Secrets stored in Fly.io (not in code)
- Database credentials never exposed
- CORS restricted to allowed origins

### Photo Privacy
- Pending photos not publicly accessible
- Share tokens for private sharing
- Admin approval required for reviews

---

## Performance

### Frontend
- Vite build optimization (code splitting, tree shaking)
- Lazy loading for routes
- Image lazy loading
- Service worker for offline support
- PWA caching strategies

### Backend
- Connection pooling (PostgreSQL)
- Embedded static files (no disk I/O)
- Efficient image processing (streaming)
- Perceptual hashing for duplicate detection

### Database
- Indexes on frequently queried columns
- JSONB for flexible metadata
- Efficient JOIN queries

### Storage
- CDN for global distribution
- Multiple renditions (thumb, mobile, original)
- Lazy loading in galleries

---

## Monitoring

### Logs
```bash
fly logs -a fleurraine
```

### Metrics
- Fly.io dashboard: https://fly.io/apps/fleurraine
- Request rates
- Response times
- Error rates
- Memory usage

### Alerts
- Fly.io health checks
- Auto-restart on crash
- Email notifications (configure in Fly.io)

---

## Dependencies

### Go Packages
- `github.com/go-chi/chi/v5` - HTTP router
- `github.com/jackc/pgx/v5` - PostgreSQL driver
- `github.com/disintegration/imaging` - Image processing
- `github.com/rwcarlsen/goexif` - EXIF extraction
- `github.com/corona10/goimagehash` - Perceptual hashing
- `github.com/aws/aws-sdk-go-v2` - S3/Tigris client

### Frontend Packages
- `react` - UI framework
- `react-router-dom` - Routing
- `tailwindcss` - Styling
- `vite` - Build tool
- `@vitejs/plugin-react` - React support

### External Services
- **Fly.io** - Hosting, database, storage
- **Anthropic** - AI photo classification
- **Resend** - Transactional email
- **Google** - OAuth provider
- **Facebook** - OAuth provider (optional)

---

## Development Workflow

```
1. Make changes to code
2. Test locally:
   - Backend: go run ./cmd/server
   - Frontend: cd web && npm run dev
3. Commit changes
4. Deploy to Fly.io:
   - fly deploy -a fleurraine
5. Monitor logs:
   - fly logs -a fleurraine
6. Verify in production:
   - https://fleurraine.fly.dev
```

---

## Future Enhancements

- [ ] Multi-region deployment
- [ ] Redis caching layer
- [ ] Background job queue
- [ ] Advanced analytics dashboard
- [ ] Mobile apps (iOS, Android)
- [ ] Payment processing (Stripe)
- [ ] Inventory management
- [ ] Customer reviews and ratings
