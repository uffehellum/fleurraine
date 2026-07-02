# ── Stage 1: Build the React frontend ─────────────────────────────────────────
FROM node:22-alpine AS frontend

WORKDIR /app/web

# Read OAuth client IDs from .env file if not provided as build args
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_FACEBOOK_APP_ID
ARG VITE_DEFAULT_PRICE=10

# Copy .env files to extract OAuth IDs if needed
COPY .env* ./
COPY web/.env* ./

# Set environment variables for Vite build
# If build args are provided, they take precedence
# Otherwise, try to read from .env files
RUN if [ -z "$VITE_GOOGLE_CLIENT_ID" ] && [ -f ".env" ]; then \
      export VITE_GOOGLE_CLIENT_ID=$(grep GOOGLE_CLIENT_ID .env | cut -d '=' -f2 | tr -d '"' | tr -d "'"); \
    fi && \
    if [ -z "$VITE_FACEBOOK_APP_ID" ] && [ -f ".env" ]; then \
      export VITE_FACEBOOK_APP_ID=$(grep FACEBOOK_APP_ID .env | cut -d '=' -f2 | tr -d '"' | tr -d "'"); \
    fi

ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ENV VITE_FACEBOOK_APP_ID=$VITE_FACEBOOK_APP_ID
ENV VITE_DEFAULT_PRICE=$VITE_DEFAULT_PRICE

COPY web/package.json web/package-lock.json* ./
RUN npm ci

COPY web/ ./
RUN npm run build

# ── Stage 2: Build the Go binary ──────────────────────────────────────────────
FROM golang:1.25-alpine AS backend

WORKDIR /app

# Copy module files first so this layer is cached when only source changes.
COPY go.mod go.sum* ./
RUN go mod download

# Copy all Go source.
COPY . .

# Overwrite the placeholder static dir with the real compiled frontend.
# The //go:embed directive in cmd/server/main.go embeds cmd/server/static/.
COPY --from=frontend /app/web/dist ./cmd/server/static/

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app/fleurraine ./cmd/server

# ── Stage 3: Minimal runtime image ────────────────────────────────────────────
FROM debian:bookworm-slim AS runtime

# Install CA certificates for HTTPS requests
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

RUN addgroup --system app && adduser --system --ingroup app app

WORKDIR /app

COPY --from=backend /app/fleurraine .

USER app

EXPOSE 8080

CMD ["./fleurraine"]
