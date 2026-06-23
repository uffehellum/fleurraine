# ── Stage 1: Build the React frontend ─────────────────────────────────────────
FROM node:22-alpine AS frontend

WORKDIR /app/web

ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_FACEBOOK_APP_ID
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ENV VITE_FACEBOOK_APP_ID=$VITE_FACEBOOK_APP_ID

COPY web/package.json web/package-lock.json* ./
RUN npm ci

COPY web/ ./
RUN npm run build

# ── Stage 2: Build the Go binary ──────────────────────────────────────────────
FROM golang:1.24-alpine AS backend

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

RUN addgroup --system app && adduser --system --ingroup app app

WORKDIR /app

COPY --from=backend /app/fleurraine .

USER app

EXPOSE 8080

CMD ["./fleurraine"]
