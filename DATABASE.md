# Database Guide

## Connecting to the Database

### Local Development

Connect to your local PostgreSQL:

```bash
psql postgres://postgres:postgres@localhost:5432/fleurraine
```

Or using Docker:

```bash
docker exec -it fleurraine-pg psql -U postgres -d fleurraine
```

### Production (Fly.io)

Connect to the production database:

```bash
fly postgres connect -a fleurraine-db
```

Once connected, switch to the app database:

```sql
\c fleurraine
```

## Common Queries

### List all tables

```sql
\dt
```

### View users

```sql
SELECT id, email, display_name, provider, created_at 
FROM users 
ORDER BY created_at DESC;
```

### View photos with uploader info

```sql
SELECT 
  p.id, 
  p.category, 
  p.status,
  p.uploaded_at,
  u.email, 
  u.display_name 
FROM photos p 
LEFT JOIN users u ON p.uploaded_by = u.id 
ORDER BY p.uploaded_at DESC 
LIMIT 10;
```

### Count photos by category

```sql
SELECT category, COUNT(*) 
FROM photos 
GROUP BY category 
ORDER BY COUNT(*) DESC;
```

### View recent orders

```sql
SELECT 
  o.id,
  o.status,
  o.total_amount,
  o.created_at,
  u.email
FROM orders o
LEFT JOIN users u ON o.user_id = u.id
ORDER BY o.created_at DESC
LIMIT 10;
```

### View active subscriptions

```sql
SELECT 
  s.id,
  s.status,
  s.frequency,
  s.next_delivery_date,
  u.email
FROM subscriptions s
LEFT JOIN users u ON s.user_id = u.id
WHERE s.status = 'active'
ORDER BY s.next_delivery_date;
```

## Database Schema

### Core Tables

- **users** - User accounts (OAuth)
- **sessions** - Active user sessions
- **photos** - Photo metadata and storage keys
- **orders** - Custom flower orders
- **subscriptions** - Weekly subscription plans
- **season_selections** - User flower preferences
- **analytics_events** - Usage tracking

### Key Relationships

```
users (1) ─── (many) photos
users (1) ─── (many) orders
users (1) ─── (many) subscriptions
users (1) ─── (many) sessions
```

## Migrations

Migrations run automatically on server startup. Migration files are in:

```
internal/db/migrations/
```

To check migration status:

```sql
SELECT * FROM schema_migrations ORDER BY version;
```

## Backup and Restore

### Backup production database

```bash
fly postgres connect -a fleurraine-db -c "pg_dump fleurraine" > backup.sql
```

### Restore from backup

```bash
fly postgres connect -a fleurraine-db -c "psql fleurraine" < backup.sql
```

## Performance

### Check table sizes

```sql
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### View slow queries (if enabled)

```sql
SELECT 
  query,
  calls,
  total_time,
  mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```
