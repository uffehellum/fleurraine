# Fleurraine

A mobile-first Progressive Web App (PWA) for a local flower stand — photo galleries, custom orders, and weekly subscriptions.

**Stack:** Go + React + PostgreSQL + Tigris + Fly.io

---

## Quick Start

### Local Development

1. **Prerequisites:** Go 1.23+, Node.js 22+, PostgreSQL 15+
2. **Setup:** Copy `.env.example` to `.env` and configure
3. **Run:**
   ```bash
   # Terminal 1: Backend
   set -a && source .env && set +a
   go run ./cmd/server
   
   # Terminal 2: Frontend
   cd web && npm install && npm run dev
   ```
4. **Open:** http://localhost:5173

See [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md) for detailed instructions.

### Deploy to Production

```bash
fly deploy -a fleurraine
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for first-time setup.

---

## Documentation

- **[LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md)** - Running locally, OAuth setup, troubleshooting
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Deploying to Fly.io, scaling, custom domains
- **[SECRETS.md](SECRETS.md)** - Environment variables, API keys, security
- **[DATABASE.md](DATABASE.md)** - Connecting to database, common queries, backups
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System design, data flow, dependencies
- **[PHOTO_WORKFLOW.md](PHOTO_WORKFLOW.md)** - Photo upload, AI classification, management
- **[IMAGE_SYSTEM.md](IMAGE_SYSTEM.md)** - Image processing, EXIF, renditions

---

## Features

- 📸 **Photo Management** - AI-powered classification, EXIF extraction, duplicate detection
- 🌻 **Flower Catalog** - Species identification, Wikipedia links, seasonal info
- 🛒 **Custom Orders** - Order tracking, email notifications
- 📅 **Subscriptions** - Weekly flower delivery plans
- 👤 **User Accounts** - OAuth (Google, Facebook), profile management
- 🔒 **Admin Dashboard** - Photo approval, order management, analytics
- 📱 **Progressive Web App** - Installable, offline support, mobile-first

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, Tailwind CSS, TypeScript |
| Backend | Go 1.23+, Chi router |
| Database | PostgreSQL 15+ |
| Storage | Tigris (S3-compatible) |
| AI | Anthropic Claude 3.5 Sonnet |
| Email | Resend |
| Hosting | Fly.io |
| Auth | OAuth 2.0 (Google, Facebook) |

---

## Project Structure

```
├── cmd/server/              # Go HTTP server
├── internal/                # Backend packages
│   ├── auth/               # OAuth & sessions
│   ├── db/                 # Database & migrations
│   ├── photos/             # Image processing
│   ├── storage/            # Object storage
│   ├── orders/             # Order management
│   ├── subscriptions/      # Subscription plans
│   ├── analytics/          # Event tracking
│   ├── email/              # Email service
│   └── ai/                 # AI integration
├── web/                     # React frontend
│   ├── src/                # Source code
│   └── public/             # Static assets
├── fly.toml                 # Fly.io config
├── Dockerfile               # Production build
└── *.md                     # Documentation
```

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally
5. Submit a pull request

---

## License

Private project for Fleurraine flower stand.

---

## Support

For issues or questions:
- Check the documentation in `*.md` files
- Review [ARCHITECTURE.md](ARCHITECTURE.md) for system design
- Check [DATABASE.md](DATABASE.md) for database queries
- See [DEPLOYMENT.md](DEPLOYMENT.md) for deployment issues
