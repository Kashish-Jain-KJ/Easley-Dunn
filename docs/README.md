# Cerberus Access Management — Technical Documentation Index

Welcome to the technical documentation repository for **Cerberus** (Easley-Dunn Access Management System). Cerberus is an automated user access governance and provisioning platform designed to centralize and automate user onboarding and offboarding across third-party developer platforms, cloud infrastructures, analytics tools, and project management applications.

---

## 📚 Master Technical Documentation

- 📄 **[Cerberus Complete Technical Documentation](./CERBERUS_COMPLETE_TECHNICAL_DOCUMENTATION.md)**  
  The primary source of truth for the entire Cerberus application architecture, data models, API reference, security model, environment configuration, onboarding/offboarding workflows, troubleshooting, and extension guides.

---

## 🔌 Individual Integration Guides

Each document below provides a self-contained, in-depth breakdown of a specific third-party integration, including credential lifecycles, SDK/API calls, required provider-side setup, error handling, and step-by-step onboarding/offboarding execution flows:

1. 🟢 **[Google Play Console Integration](./GOOGLE_PLAY_CONSOLE_INTEGRATION.md)** — Android Developer Console user provisioning via Google Android Publisher API v3.
2. 🔵 **[BigQuery Integration](./BIGQUERY_INTEGRATION.md)** — Google Cloud BigQuery dataset & project IAM access governance via Cloud Resource Manager API v3.
3. 🟡 **[Google Drive Integration](./GOOGLE_DRIVE_INTEGRATION.md)** — Automated folder permission management and pre-offboarding file ownership audit checks using Google Drive API v3.
4. 🟠 **[Google Analytics Integration](./GOOGLE_ANALYTICS_INTEGRATION.md)** — GA4 property & account-level access binding administration via Google Analytics Admin API v1alpha.
5. 🍎 **[App Store Connect Integration](./APP_STORE_CONNECT_INTEGRATION.md)** — iOS Developer Team invitations and member removals using native ES256 JWT authentication and Apple Store Connect REST API v1.
6. ☁️ **[Google Cloud IAM Integration](./GOOGLE_CLOUD_INTEGRATION.md)** — Cloud project IAM policy modification and role binding administration via Google Cloud Resource Manager API v3.
7. 🔥 **[Firebase Authentication Integration](./FIREBASE_INTEGRATION.md)** — User identity creation and removal across Firebase projects using Firebase Admin SDK.
8. 📋 **[Kanboard Integration](./KANBOARD_INTEGRATION.md)** — Project member provisioning and automated credentials mailing over Kanboard JSON-RPC 2.0 API & SMTP.
9. 👾 **[Discord Integration](./DISCORD_INTEGRATION.md)** — Community & team member guild role assignment and member kicking via Discord REST API v10.

---

## 🚀 Recommended Reading Order for New Developers

If you are joining the Cerberus project today, follow this recommended sequence to get up to speed quickly:

1. Read **[Cerberus Complete Technical Documentation Section 1 (Executive Overview) & Section 3 (System Architecture)](./CERBERUS_COMPLETE_TECHNICAL_DOCUMENTATION.md#1-executive-overview)** to understand the problem domain and high-level components.
2. Review **[Section 11 (Database & Data Models)](./CERBERUS_COMPLETE_TECHNICAL_DOCUMENTATION.md#11-database-and-data-models)** to see how users, services, access records, and audit logs are persisted in PostgreSQL.
3. Trace **[Section 12 (Onboarding Workflow)](./CERBERUS_COMPLETE_TECHNICAL_DOCUMENTATION.md#12-complete-onboarding-workflow)** and **[Section 13 (Offboarding Workflow)](./CERBERUS_COMPLETE_TECHNICAL_DOCUMENTATION.md#13-complete-offboarding-workflow)** to understand end-to-end request handling.
4. Read **[Section 9 & 10 (Authentication & Secret Management)](./CERBERUS_COMPLETE_TECHNICAL_DOCUMENTATION.md#9-authentication-and-authorization)** to understand service account keys, `.p8` signing keys, and environment variables.
5. Deep-dive into specific **Provider Integration Documents** listed above relevant to your feature task.
