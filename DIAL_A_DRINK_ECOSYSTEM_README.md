# Dial A Drink Ecosystem Overview

This document captures the complete Dial A Drink delivery ecosystem across all user touchpoints: customer storefront, admin operations console, driver applications, and the shared backend platform. Use it as a product-and-technology reference when onboarding teammates, planning roadmap work, or auditing end-to-end capabilities.

---

## 1. Product Matrix

| Product | Primary Users | Platform | Key Responsibilities |
| --- | --- | --- | --- |
| Customer Web App | Shoppers | React web (frontend/) | Product discovery, cart & checkout, payments, delivery info capture, offer awareness |
| Admin Dashboard | Operations, Finance, Inventory, Dispatch | React web (admin-frontend/) | Order triage, driver assignment, stock control, financial reconciliation, alerting |
| Driver Apps | Delivery partners | React Native / Expo (DDDriverExpo/) & Legacy React Native (driver-app/) | Order acceptance, navigation hand-off, delivery confirmation, payouts |
| Backend Services | Shared | Node + Express + PostgreSQL (backend/) | APIs, business rules, inventory/state management, payments, notifications, integrations |

---

## 2. Customer Web App (`frontend/`)

### Purpose
Provide a responsive storefront that converts visitor intent into structured orders ready for fulfilment.

### Feature Highlights
- **Product Discovery & Merchandising**: Category landing pages, featured offers, capacity-level pricing, rich product metadata (ABV, origin, notes).
- **Cart & Checkout**:
  - Quantity adjustments, capacity switching, inline offer highlighting.
  - Delivery profile capture with apartment/floor metadata and persistent local storage recall.
  - Automatic delivery-fee logic driven by backend settings (alcohol vs soft-drinks, test mode overrides).
  - Optional tips with guardrails in test mode.
- **Payment Options**: Pay-now (card or mobile money) and pay-on-delivery flows with phone validation for M-Pesa requests.
- **Customer Accounts (lightweight)**: OTP login, saved orders view, order tracking screen with real-time status updates.
- **Notifications & UX Enhancements**: Offer countdown timers, theme switching, address autocomplete hooks.

### Integrations
- `api.js` consumes REST endpoints exposed by the backend for drinks, orders, settings, authentication, and tracking.
- Socket.IO client for live updates (e.g., order confirmations, countdown refreshes).

### Tech Snapshot
- React 18, React Router, Material-UI, Socket.IO client, Axios, Context API for cart/auth/theme state.

---

## 3. Admin Dashboard (`admin-frontend/`)

### Purpose
Deliver a mission-control experience for operations, inventory managers, finance analysts, and dispatch coordinators.

### Feature Highlights
- **Authentication & Access Control**: Invite-based admin onboarding with password setup screens and role enforcement (Admin vs Manager).
- **Real-time Order Board**:
  - Auto-refresh via Socket.IO (`join-admin`) for new orders, status changes, driver responses, and payment confirmations.
  - Rich filtering on order/payment status, driver assignment, search across customer/contact metadata.
- **Driver Assignment Workflow**: Modal-based assignment, driver directory management, driver activation toggles, wallet views.
- **Inventory Management**: CRUD for drinks, capacity pricing matrix editor, availability toggles, offer scheduling.
- **Notifications & Alerts**: Configurable order notification recipients (SMS/email), in-app alert center, archived alerts.
- **Financial Ops**: Transactions ledger, admin wallet summaries, payout export support, reconciliation cues when payments land (M-Pesa receipt integration).
- **Settings Suite**: Delivery fee/test mode switches, email/SMS configuration, system banners, theme toggles.

### Integrations
- Shares the same REST/Socket.IO backend as the customer app.
- Interfaces with SMS/email services via backend triggers.

### Tech Snapshot
- React (Material-UI, Socket.IO client, Axios). Shared UI primitives with customer site to maintain design consistency.

---

## 4. Driver Applications

Dial A Drink maintains two codebases to support different deployment targets:

### 4.1 Expo-powered Driver App (`DDDriverExpo/`)

- **Purpose**: Primary mobile experience delivered via Expo for rapid iteration and OTA updates.
- **Order Intake**: Receives push/socket events; surfaces a full-screen red alert modal with looping siren audio, vibration, and forced acknowledgement before any other interaction.
- **Order Workflow**: Detailed order view, accept/reject actions with reason prompts, navigation hand-off hooks, status transitions (en route, delivered, failed, etc.).
- **Authentication & Security**: Phone+OTP onboarding, PIN setup/validation flows, secure AsyncStorage tokens, session timeout handling.
- **Wallet & Earnings**: Transaction history, balance summary, payout requests, notifications for successful settlements.
- **Profile Management**: Vehicle details, driver availability toggles, support contacts, theme settings.
- **Notifications**: Local snackbars, badge counts, background-friendly audio/vibration management.

### 4.2 Legacy React Native App (`driver-app/`)

- **Purpose**: Earlier codebase retained for redundancy or devices that require a non-Expo build.
- **Core Features**: Phone/OTP sign-in, PIN-auth flows, simplified home screen for order list and acceptance, minimal wallet features.
- **Status**: Feature-parity gap exists versus Expo app; maintained primarily for backwards compatibility during migration periods.

### Shared Integrations
- Both apps call the backend `/driver-orders`, `/drivers`, `/driver-wallet`, and notification endpoints.
- Socket.IO listeners deliver real-time assignments, while Expo app layers additional local audio/vibration logic using `expo-av` and `react-native` `Vibration` APIs.

---

## 5. Backend Platform (`backend/`)

### Purpose
Serve as the orchestration hub for data consistency, business rules, financial reconciliation, and integrations.

### Core Services
- **API Layer (Express.js)**:
  - `orders`, `admin`, `drivers`, `driver-orders`, `drinks`, `categories`, `transactions`, `countdown`, `settings`, and more.
  - M-Pesa mobile money endpoints (`/mpesa`) handling STK push initiation, callback validation, and payment reconciliation.
  - Auth endpoints for customers, admins, and drivers (OTP generation, token issuance, password management).
- **Real-time WebSockets (Socket.IO)**: Broadcasts order lifecycle events (`new-order`, `order-updated`, `payment-confirmed`, `driver-order-response`) to admin and driver clients.
- **Notification Services**: SMS (via configurable providers) and email (SMTP-based) pipelines with feature flags stored in `Settings` table.
- **Delivery Fee Engine**: Settings-driven computation factoring test mode, alcohol presence, and dynamic fee schedules.
- **Inventory Automation**: Extensive `scripts/` suite for scraping, image processing, imports, and data hygiene to align catalog with Dial A Drink web listings.
- **Persistence Layer**: Sequelize models on PostgreSQL covering categories, subcategories, drinks, orders, order items, drivers, wallets, transactions, OTPs, notifications, countdown timers, and settings.
- **Seeding & Migration**: Automated population scripts (e.g., `seed.js`, `import-dialadrink-*`) and targeted migrations for schema evolution (offer fields, wallet tables, etc.).

### Operational Tooling
- Render deployment configurations, helper scripts for imports/cleanup, log files for diagnostics, and environment setup docs across the repository.

---

## 6. Cross-product Experience

1. **Browse & Order** (Customer): Shopper adds items, the frontend computes delivery fee/tip, and sends order + payment intent to backend.
2. **Confirm & Notify** (Backend): Order persisted, Socket.IO pushes notify admins, optional SMS/email alerts fire, and payment workflows initiate.
3. **Triage & Assign** (Admin): Staff review order, adjust status, assign driver, and monitor payment status. Admin changes immediately propagate via WebSockets.
4. **Pickup & Deliver** (Driver): Assigned driver receives a blocking alert; once accepted, order workflow proceeds through in-progress to completion, updating backend and admin views.
5. **Settle & Reconcile**: Payment confirmations (M-Pesa receipts, cash on delivery status) update transactions tables, admin dashboards, and driver wallets.

Each component is loosely coupled via documented APIs but coordinated through consistent domain models and event streams.

---

## 7. Supporting Assets & Documentation

- `README.md`: High-level project setup and tech stack.
- `DATABASE_SETUP.md`, `IMPORT_SUMMARY.md`, `CLEANUP_SUMMARY.md`: Data operations history.
- `NEXT_STEPS.md`: Recently delivered features and testing checklists.
- `BUILD_*`, `FIX_*`, and `DEBUG_*` guides across app directories for mobile release management.

---

## 8. Future-looking Enhancements

Potential roadmap items derived from existing documentation and code comments:
- Hardened user authentication (accounts for customers, JWT refresh flows).
- Integrated payments (M-Pesa production rollout, card gateway settlement webhooks).
- Customer order tracking map with driver location sharing.
- Push notifications across customer and driver apps.
- Advanced analytics dashboards (cohort, GMV, fulfillment SLAs).
- Inventory-level stock management with purchase order reconciliation.

---

## 9. Getting Started (At a Glance)

1. **Backend**: `cd backend && npm install && npm run dev`
2. **Customer Frontend**: `cd frontend && npm install && npm start`
3. **Admin Frontend**: `cd admin-frontend && npm install && npm start`
4. **Driver (Expo)**: `cd DDDriverExpo && npm install && expo start`

Configure `.env` / `config.js` values (database, SMTP, SMS, M-Pesa, API URLs) before running the stack. Reference component-specific docs for deployment nuances.

---

Maintaining this ecosystem-level README alongside the codebase ensures every stakeholder understands how the products interlock and where to extend functionality safely.
