# Cerberus PostgreSQL (`cerberus-db`)

Standalone PostgreSQL 16 Docker setup for Cerberus with the consolidated idempotent schema and initial `services` catalog preloaded.

## Files

- `Dockerfile` — `postgres:16-alpine` image with placeholder `POSTGRES_*` environment variables and `/docker-entrypoint-initdb.d/` initialization scripts.
- `001_initial_schema.sql` — Creates all tables (`users`, `services`, `user_service_access`, `log`, `cerberus_admin_tokens`, `session`, `teams`, `team_members`, `audit_events`), indexes, and the append-only trigger guards on `audit_events`.
- `002_seed_services.sql` — Seeds the 11 supported services into `services` idempotently (`ON CONFLICT (service_code) DO NOTHING`).

---

## 1. Build & Run the Database Container

> Replace the placeholder values (`your-db-name`, `your-db-user`, `your-db-password`) at runtime via `-e` or `docker-compose.yml` rather than committing real credentials to `Dockerfile`.

### Option A: `docker build` + `docker run`

From the repository root:

```bash
docker build -t cerberus-db ./cerberus-db

docker run -d \
  --name cerberus-postgres \
  --restart unless-stopped \
  -e POSTGRES_DB=cerberus \
  -e POSTGRES_USER=cerberus_app \
  -e POSTGRES_PASSWORD="replace-with-strong-db-password" \
  -p 127.0.0.1:5432:5432 \
  -v cerberus_pgdata:/var/lib/postgresql/data \
  cerberus-db
```

*(Bind `127.0.0.1:5432:5432` on a server so PostgreSQL is not exposed publicly.)*

### Option B: `docker-compose.yml`

```yaml
services:
  db:
    build: ./cerberus-db
    container_name: cerberus-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: cerberus
      POSTGRES_USER: cerberus_app
      POSTGRES_PASSWORD: replace-with-strong-db-password
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - cerberus_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  cerberus_pgdata:
```

Start it with:

```bash
docker compose up -d db
```

---

## 2. Verify Tables & Seeded Services

Wait a few seconds for initialization on first boot, then check with `psql`:

```bash
docker exec -it cerberus-postgres psql -U cerberus_app -d cerberus -c "\dt" -c "\di" -c "SELECT service_id, service_name, service_code, is_automate FROM services ORDER BY service_id;"
```

You should see all 9 tables, their indexes, and the 11 rows in `services`.

---

## 3. Configure `backend/.env`

Set the database and security environment variables in `backend/.env` **before** seeding the initial admin:

```env
DATABASE_URL="postgresql://cerberus_app:replace-with-strong-db-password@127.0.0.1:5432/cerberus"
DB_SCHEMA=public
DB_SSL=false

# Server / Security
NODE_ENV=production
PORT=5001
SESSION_SECRET=<generate with: openssl rand -base64 48>
PASSWORD_PEPPER=<generate with: openssl rand -base64 32>

# Frontend & API URLs (also used in invite, reset, and Discord links)
CORS_ORIGINS=https://cerberus.yourdomain.com
API_URL=https://api.cerberus.yourdomain.com
```

Notes:
- **`DB_SCHEMA=public`**: Matches the schema where `/docker-entrypoint-initdb.d/` creates the tables.
- **`DB_SSL=false`**: Required when connecting directly to the stock `postgres:16-alpine` container without TLS configured (`backend/src/config/db.config.js` enables SSL unless `DB_SSL=false`).
- **`PASSWORD_PEPPER`**: Set this permanently before creating any accounts; changing it later invalidates stored passwords.
- **`NODE_ENV=production`**: Enables `Secure` session cookies, so serve the app behind HTTPS (Nginx, Caddy, or Cloudflare).

---

## 4. Seed the Single Initial Admin User

Install backend dependencies (if not already installed) and run `backend/scripts/seed-initial-admin.js`:

```bash
npm ci --omit=dev --prefix backend

INITIAL_ADMIN_EMAIL="admin@yourdomain.com" \
INITIAL_ADMIN_PASSWORD="replace-with-strong-admin-password" \
INITIAL_ADMIN_FIRST="System" \
INITIAL_ADMIN_LAST="Admin" \
npm run seed:admin --prefix backend
```

Running it again safely aborts if any user with `Role = 'ADMIN'` already exists.

---

## 5. Start the App

1. Start the backend (`node server.js` via `pm2`, `systemd`, etc.):
   ```bash
   npm start --prefix backend
   ```
   Verify `/health` and `/health/db`.
2. Build and serve the frontend with your production API URL:
   ```bash
   REACT_APP_API_URL=https://api.cerberus.yourdomain.com npm run build --prefix frontend
   ```
   Serve `frontend/build/` behind HTTPS with SPA fallback to `index.html`.

---

## Re-initializing or Applying Manually

- PostgreSQL only runs `/docker-entrypoint-initdb.d/*.sql` when the data directory (`cerberus_pgdata`) is empty. To wipe and re-run from scratch locally:
  ```bash
  docker rm -f cerberus-postgres
  docker volume rm cerberus_pgdata
  ```
- Both `001_initial_schema.sql` and `002_seed_services.sql` are idempotent and can also be run manually against an existing database:
  ```bash
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f cerberus-db/001_initial_schema.sql
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f cerberus-db/002_seed_services.sql
  ```

