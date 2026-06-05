# EasleyDunn — Backend API

Production-ready **Node.js + Express + PostgreSQL** REST API.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 18 |
| Framework | Express 4 |
| Database | PostgreSQL via `pg` (promise pool) |
| Security | Helmet, CORS, express-rate-limit |
| Documentation | Swagger (swagger-jsdoc & swagger-ui-express) |
| Logging | Winston (colorised dev / JSON prod) |
| Testing | Jest + Supertest |
| Dev server | Nodemon |

---

## Getting Started

### 1. Prerequisites
- Node.js ≥ 18 installed
- A Supabase project with your PostgreSQL schema initialized

### 2. Clone & Install
```bash
cd backend
npm install
```

### 3. Configure Environment
```bash
cp .env.example .env
# Open .env and fill in your Supabase connection string and other settings
```

> **Never commit `.env` to git.** The `.gitignore` already excludes it.

### 4. Run in Development
```bash
npm run dev
```
Server starts at `http://localhost:5000` (or your configured `PORT`)
View API Documentation at `http://localhost:5000/api-docs`

### 5. Run in Production
```bash
NODE_ENV=production npm start
```

---

## Environment Variables

See [`.env.example`](.env.example) for all available variables and their defaults.

Key variables:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5000` | HTTP server port |
| `NODE_ENV` | `development` | Environment mode |
| `DATABASE_URL` | _(empty)_ | Supabase IPv4 Pooler connection string |
| `DB_SCHEMA` | `easleydunn` | PostgreSQL schema name |
| `DB_CONNECTION_LIMIT` | `10` | Maximum pool connections |
| `API_URL` | `http://localhost:5000` | Base URL for Swagger and logging |
| `CORS_ORIGINS` | `http://localhost:3000` | Allowed origins (comma-separated) |

---

## Project Structure

```
backend/
├── server.js               # Entry point — boots server, graceful shutdown
├── .env                    # Local secrets (git-ignored)
├── .env.example            # Template for teammates
├── package.json
├── googleplay_json/        # Google Play credentials (git-ignored)
├── bigquery_json/          # BigQuery credentials (git-ignored)
├── tests/                  # Integration and unit tests
└── src/
    ├── app.js              # Express app factory (middleware + routes)
    ├── config/
    │   ├── app.config.js   # Server / CORS / rate-limit settings
    │   ├── db.config.js    # PostgreSQL pool settings
    │   └── swagger.config.js # OpenAPI/Swagger definitions
    ├── controllers/        # Request handlers (logic & DB queries)
    ├── db/
    │   └── database.js     # Singleton pg pool + connection listener
    ├── middlewares/
    │   ├── errorHandler.middleware.js
    │   └── notFound.middleware.js
    ├── routes/
    │   ├── index.routes.js  # Mount all routers here
    │   └── ...
    └── utils/
        ├── ApiError.js      # Typed HTTP errors
        ├── asyncHandler.js  # Wraps async handlers for Express
        └── logger.js        # Winston logger
```

---

## API Endpoints

### Health

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Liveness probe |
| `GET` | `/health/db` | Readiness probe (tests DB) |

*(See `/api-docs` for full interactive documentation of all other endpoints!)*

---

## Running Tests

```bash
npm test
```

> Requires a live PostgreSQL connection (the integration tests hit `/health/db`).

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start with Nodemon (auto-reload) |
| `npm start` | Start without auto-reload (production) |
| `npm test` | Run Jest integration tests |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Auto-fix lint issues |
