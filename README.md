# 🛡️ Easley-Dunn (Cerberus Access Management Platform)

> A centralized, automated user access governance and identity lifecycle management platform.

Cerberus centralizes user onboarding, role delegation, active access protection, and multi-platform offboarding across external cloud infrastructure, developer consoles, analytics tools, and team collaboration applications.

---

## 🌟 Key Features & Capabilities

- **🔐 Password-Based Authentication**: Secure authentication system using password login (`/auth/login`) with session management.
- **🛡️ Active Access Protection**: Users with active third-party software permissions (`user_service_access`) cannot be marked as `Inactive` until all software accesses are cleanly offboarded.
- **🔄 Default Role Reset**: Deactivating a user automatically resets their system role to `MEMBER`.
- **📊 Central Audit Logger (`logUtils.js`)**: Standardized activity logger (`logActivity`) recording all `ONBOARD` and `OFFBOARD` operations (`SUCCESS` / `FAILED`) with error details and timestamps in the PostgreSQL `log` table.
- **🔑 Centralized Credential Loader (`credentialUtils.js`)**: Uniform, secure loading of service account `.json` and `.p8` credential files across all provider integrations.
- **🔌 Multi-Software Provisioning & Deprovisioning**: Integrated support for:
  - **Google Play Console** (`GOOGLE_PLAY_CONSOLE`)
  - **BigQuery** (`BIG_QUERY`)
  - **Google Drive** (`GOOGLE_DRIVE`)
  - **Google Analytics** (`GOOGLE_ANALYTICS`)
  - **App Store Connect** (`APPLE_STORE_CONNECT`)
  - **Google Cloud IAM** (`GOOGLE_CLOUD`)
  - **Firebase Auth** (`FIREBASE`)
  - **Kanboard** (`KANBOARD`)
  - **Discord Guilds** (`DISCORD`)

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 18, Vanilla CSS / Custom Modern Component Styling, Toast Notifications |
| **Backend** | Node.js, Express.js (CommonJS), Morgan, Helmet, CORS |
| **Database** | PostgreSQL (`pg` connection pool) with `easleydunn.users` schema |
| **Testing** | Jest, Supertest (100% passing test suite across 66 integration tests) |
| **Documentation** | Swagger / OpenAPI 3.0 (`/docs`), Markdown docs in `docs/` |

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **PostgreSQL**: v14.0 or higher (or Supabase PostgreSQL instance)

### 2. Environment Configuration
Create a `.env` file inside the `backend/` directory:

```env
PORT=5001
NODE_ENV=development
DATABASE_URL=postgresql://postgres:password@localhost:5432/easleydunn
AUTH_JWT_SECRET=your-secret-key-change-in-production
CORS_ORIGIN=http://localhost:3000

# Provider Credentials Directories (placed in backend/):
# - googleplay_json/
# - googlecloud_json/
# - googledrive_json/
# - googleanalytics_json/
# - firebase_json/
# - apple_key/
```

### 3. Installation

Install dependencies for both backend and frontend:

```bash
# Backend dependencies
cd backend
npm install

# Frontend dependencies
cd ../frontend
npm install
```

### 4. Running locally

Start both backend and frontend development servers concurrently from the **root directory**:

```bash
# Install root launcher dependencies
npm install

# Start both backend (http://localhost:5001) and frontend (http://localhost:3000) concurrently
npm run dev
```

Alternatively, you can run them individually:

```bash
# Start backend server only
npm run dev:backend

# Start frontend app only
npm run dev:frontend
```

---

## 🧪 Testing & Verification

Run the full integration test suite in the backend:

```bash
cd backend
npm test
```

Build the frontend production bundle:

```bash
cd frontend
npm run build
```

---

## 📂 Project Directory Structure

```
easleydunn/
├── backend/
│   ├── src/
│   │   ├── app.js               # Express application factory
│   │   ├── server.js            # HTTP listener startup
│   │   ├── config/              # App & DB configuration
│   │   ├── controllers/         # Software integration & admin controllers
│   │   ├── db/                  # PostgreSQL pool initialization
│   │   ├── middlewares/         # Auth, RBAC, input validation & error handlers
│   │   ├── routes/              # Express feature routers
│   │   └── utils/               # Central logUtils, credentialUtils, userUtils
│   └── tests/
│       └── integration/         # Comprehensive Jest integration tests
├── frontend/
│   ├── src/
│   │   ├── App.js               # Main React dashboard layout
│   │   ├── components/          # Role management, access cards & Toast notifications
│   │   └── index.css            # Global CSS custom styles & tokens
└── docs/                        # Complete technical documentation index
```

---

## 📖 Comprehensive Documentation

For detailed technical guides, API specs, database schemas, and provider setup guides, see the [Technical Documentation Index](file:///Users/kj/Desktop/easleydunn/docs/README.md).