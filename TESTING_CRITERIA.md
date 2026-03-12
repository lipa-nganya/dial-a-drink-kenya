# Testing Criteria by Product, Module & Feature

This document defines test criteria for every product in the Dial-a-Drink suite. The **Android app** supports **3 user types**: **Driver**, **Admin**, and **Shop Agent**—each with distinct modules and access.

---

## 1. Customer Frontend (Web)

**Product:** Customer-facing site (React, `frontend/`).  
**Users:** Anonymous visitors, logged-in customers.

### 1.1 Auth
| Feature | Test criteria |
|--------|----------------|
| Login | Valid **phone + PIN** (or OTP for first-time) logs in; invalid credentials show error; session persists on refresh. |
| Verify email | Link from email opens verify page (`/verify-email?token=...`); valid token confirms; invalid/expired shows error. |
| Protected routes | `/profile` and `/orders` redirect to `/login` when not authenticated (no flash of content). |
| Logout | Session cleared (`customerOrder` and `customerLoggedIn` removed); redirect to home or login. |

#### Manual test results (Auth – 1.1)

| Test | Result | Notes |
|------|--------|------|
| **Login – invalid (no body)** | ✅ Pass | API returns 400, `"Phone number and PIN are required"`. |
| **Login – invalid (unknown phone / no PIN set)** | ✅ Pass | API returns 404/400 with `requiresPinSetup` or "Customer not found" / "PIN not set". |
| **Verify email – missing token** | ✅ Pass | API returns 400, `"Verification token is required"`. |
| **Verify email – invalid token** | ✅ Pass | API returns 404, `"Invalid or expired verification token"`; UI shows error and "Back to Login". |
| **Check PIN status – no phone** | ✅ Pass | API returns 400, `"Phone number is required"`. |
| **Protected routes** | ✅ Pass (after fix) | `/profile` uses `CustomerPrivateRoute` (immediate redirect). `/orders` now also wrapped so unauthenticated users redirect to `/login` without flash. |
| **Logout** | ✅ Pass (after fix) | Profile "Log Out" calls `logout()` then `navigate('/')`. Logout now clears both `customerOrder` and `customerLoggedIn`. |
| **Session persistence** | ✅ Pass | `CustomerContext` loads from `localStorage.customerOrder` on mount; refresh keeps user logged in. |

**Bugs found and fixed**

1. **Doc vs implementation**: Criteria said "Valid email logs in" but login is **phone + PIN** (and OTP for first-time). Criteria updated to match implementation.
2. **Logout left stale key**: `logout()` did not remove `customerLoggedIn` from localStorage. Fixed: `logout()` now removes both `customerOrder` and `customerLoggedIn`.
3. **/orders not route-protected**: `/orders` was not wrapped in `CustomerPrivateRoute`, so unauthenticated users saw a brief loading/error state before `MyOrders` redirected. Fixed: `/orders` now uses `CustomerPrivateRoute` for immediate redirect to `/login`.

### 1.2 Catalog & browsing
| Feature | Test criteria |
|--------|----------------|
| Home | Loads; featured/categories/offers visible; no layout shift on product load. |
| Menu | Categories/subcategories load; products listed; filters/search work. |
| Product page | Product details load; no flicker/shift (description, tasting notes, related products); add to cart works; breadcrumbs correct. |
| Brands | Brand list loads; brand detail shows products; navigation works. |
| Offers / Test offers | Offers page loads; test offers page works when enabled. |

### 1.3 Cart & checkout
| Feature | Test criteria |
|--------|----------------|
| Cart | Add/remove/update quantity; totals correct; empty state shown when empty. |
| Checkout | Delivery details required; order submission succeeds; errors shown for validation/API failure. |
| Order success | Success page shows after order; order ID/reference displayed. |
| Payment success | Shown after payment callback; state consistent with order. |
| Order tracking | Order status displayed for valid order ID; invalid ID handled. |

### 1.4 Account
| Feature | Test criteria |
|--------|----------------|
| Profile | View/edit profile; changes persist; validation on required fields. |
| My orders | List of customer orders; detail view; status and items correct. |

### 1.5 Support & legal
| Feature | Test criteria |
|--------|----------------|
| Suggest drink | Form submits; success/error feedback. |
| Report problem | Form submits; success/error feedback. |
| Privacy policy / Terms of service | Pages load; content readable. |
| Delivery locations | List loads; location detail page works. |
| Pricelist / Sitemap | Pages load; links work. |

### 1.6 Embedded admin (if present)
| Feature | Test criteria |
|--------|----------------|
| Admin login | Admin can log in at `/admin/login`. |
| Admin routes | All `/admin/*` routes (orders, inventory, transactions, drivers, payables, etc.) load when authenticated; redirect when not. |

---

## 2. Admin Frontend (Web)

**Product:** Admin dashboard (React, `admin-frontend/`).  
**Users:** Admins, managers, shop_agent (role-based).

### 2.1 Auth
| Feature | Test criteria |
|--------|----------------|
| Login | Valid credentials log in; invalid show error; session persists. |
| Setup password | Invited user can set password via token; invalid/expired token handled. |
| Private routes | Unauthenticated access to any protected route redirects to login. |

### 2.2 Dashboard
| Feature | Test criteria |
|--------|----------------|
| Admin overview | Summary stats/cards load; links to orders, inventory, etc. work. |

### 2.3 Orders
| Feature | Test criteria |
|--------|----------------|
| Orders list | Orders load; filters/search/pagination work; status updates possible. |
| Orders without driver | List shows only unassigned; assign driver works. |
| Pending orders | Pending list and actions (approve/reject) work. |

### 2.4 Inventory
| Feature | Test criteria |
|--------|----------------|
| Inventory | Stock levels load; edit/update works; low-stock indicators correct. |

### 2.5 Transactions
| Feature | Test criteria |
|--------|----------------|
| Transactions | List loads; filters by date/type; detail view correct. |

### 2.6 Drivers / Riders
| Feature | Test criteria |
|--------|----------------|
| Drivers list | Riders listed; status and basic info correct. |
| Rider detail | Rider profile; orders; cash at hand; sales data. |
| Cash at hand | List of submissions; approve/reject works. |
| Riders dashboard | Summary and per-rider views load. |
| Rider cash at hand detail | Submission detail and approval flow work. |

### 2.7 Payables
| Feature | Test criteria |
|--------|----------------|
| Payables dashboard | Overview loads. |
| Manage payables | List and actions work. |
| Purchases | Purchase list and add purchase work. |
| Supplier invoices | Supplier detail and invoices load. |

### 2.8 Sales
| Feature | Test criteria |
|--------|----------------|
| Sales | Sales views load. |
| Rider profits | Per-rider profits; rider sales and summary pages work. |
| Sales summary | Aggregate summary correct. |

### 2.9 Cash at hand
| Feature | Test criteria |
|--------|----------------|
| Cash at hand list | Submissions list loads. |
| Pending approval | Approve/reject submission works. |

### 2.10 Accounts
| Feature | Test criteria |
|--------|----------------|
| Accounts list | Asset/account list loads. |
| Account detail | Transactions and balance correct. |

### 2.11 Branches & territories
| Feature | Test criteria |
|--------|----------------|
| Branches | List and edit work. |
| Territories | List and edit work. |

### 2.12 Settings
| Feature | Test criteria |
|--------|----------------|
| Settings | All settings sections load; save applies (branding, delivery, M-Pesa, etc.). |

### 2.13 Copilot & reports
| Feature | Test criteria |
|--------|----------------|
| Copilot | Entry and navigation work. |
| Reports by date | Date picker and report load. |
| Reports by rider | Rider selection and report load. |

### 2.14 Other
| Feature | Test criteria |
|--------|----------------|
| Quick actions | Page loads; actions execute. |
| Customers | Customer list and detail work. |
| Order notifications | Notifications list and actions work. |
| Resupply cart | Resupply flow works. |
| Supplier detail | Supplier info and related data load. |

---

## 3. Backend (API)

**Product:** Node/Express API (`backend/`).  
**Consumers:** Customer frontend, admin frontend, Android app.

### 3.1 Auth
| Feature | Test criteria |
|--------|----------------|
| Customer auth | Login, verify-email, token refresh return correct status and payload. |
| Admin auth | Login, session, role checks work. |
| Driver/shop agent auth | Phone check, OTP, PIN login return correct flags (isDriver, isAdmin, isShopAgent). |

### 3.2 Catalog
| Feature | Test criteria |
|--------|----------------|
| Categories / subcategories | GET list and by ID; response shape correct. |
| Brands | GET list, GET by id, import (if used). |
| Products / drinks | GET list, GET by id/slug; filters (category, brand, inStock) work. |

### 3.3 Orders
| Feature | Test criteria |
|--------|----------------|
| Create order | POST creates order; validation rejects invalid payload. |
| List/Get order | Filters and order detail return correct data. |
| Update order | Status/assignment updates persist. |
| Order notifications | CRUD and delivery to drivers work. |

### 3.4 POS
| Feature | Test criteria |
|--------|----------------|
| POS endpoints | Product list, cart, create order work. |

### 3.5 Inventory
| Feature | Test criteria |
|--------|----------------|
| Inventory | GET stock; PATCH update stock; low-stock logic correct. |

### 3.6 Admin & shop agents
| Feature | Test criteria |
|--------|----------------|
| Admin routes | Role-based access; CRUD where applicable. |
| Admin notifications | Create/list/update work. |
| Shop agents | Login, PIN, inventory check endpoints work. |

### 3.7 Settings, countdown, offers
| Feature | Test criteria |
|--------|----------------|
| Settings | GET/PATCH settings; public vs protected correct. |
| Countdown / set-offers | Endpoints return/update correct data. |

### 3.8 Payments
| Feature | Test criteria |
|--------|----------------|
| M-Pesa | Callback receives and processes; STK push initiates. |
| Pesapal / PDQ | Callbacks and status updates work. |

### 3.9 Drivers & wallet
| Feature | Test criteria |
|--------|----------------|
| Drivers | List, detail, notifications; assignment works. |
| Driver orders | List by driver; accept/complete/cancel flow. |
| Driver wallet | Balance, transactions, cash submission create/approve. |

### 3.10 Transactions, branches, territories
| Feature | Test criteria |
|--------|----------------|
| Transactions | List and filters correct. |
| Branches / territories | CRUD and associations correct. |

### 3.11 Partner APIs (Valkyrie / Zeus)
| Feature | Test criteria |
|--------|----------------|
| Partner routes | When enabled: auth and feature endpoints return expected responses. |

---

## 4. Android App (Native) – 3 user types

**Product:** Native Android app (`driver-app-native/`).  
**User types:** **Driver**, **Admin**, **Shop Agent**.

---

### 4.1 Shared (all 3 users)

#### Auth (shared flow)
| Feature | Test criteria |
|--------|----------------|
| Phone entry | Valid phone format; API phone-check called; correct next screen (OTP or user-type selection). |
| User type selection | Shown when phone exists as driver/admin/shop_agent; chosen type leads to correct login path. |
| OTP | Valid OTP verifies; invalid/expired OTP shows error; resend OTP works. |
| PIN setup | New user can set PIN; confirm PIN must match; PIN stored securely. |
| PIN login | Correct PIN opens correct dashboard (driver/admin/shop_agent); wrong PIN shows error. |
| Admin login | Admin-specific PIN/credentials open AdminDashboard. |
| Shop agent login | Shop-agent PIN/credentials open ShopAgentDashboard. |

#### Common UI
| Feature | Test criteria |
|--------|----------------|
| Terms of use | Activity opens; content visible. |
| Privacy policy | Activity opens; content visible. |
| Logout | Clears session; returns to phone entry or user-type selection. |
| Switch user | Logs out current type; returns to user-type selection; can log in as another type. |

---

### 4.2 Driver

| Module | Feature | Test criteria |
|--------|--------|----------------|
| Dashboard | Home cards | Pending, active, completed, cancelled counts correct; tap navigates to correct list. |
| Dashboard | Shift toggle | Toggle on/off reflects backend; driver availability updated. |
| Orders | Pending list | Pending orders load; accept/decline works. |
| Orders | Active (in progress) | Active orders list; start delivery, complete, cancel work. |
| Orders | Completed | Completed list and detail correct. |
| Orders | Cancelled | Cancelled list visible. |
| Orders | Order detail | All order fields and customer info; actions (start, complete) work. |
| Orders | Order acceptance | From FCM tap: order detail opens; accept/decline work. |
| Wallet | Cash at hand | Form to submit cash; submission creates and shows in history. |
| Wallet | My wallet | Balance and transaction list correct. |
| Notifications | List | Notifications load; tap opens detail. |
| Notifications | Detail | Body and actions (e.g. open order) work. |
| Profile | View/edit | Profile data loads; edit saves. |
| Bottom nav (MainActivity) | Tabs | Active orders, Order history, Wallet, Profile switch correctly. |

---

### 4.3 Admin

| Module | Feature | Test criteria |
|--------|--------|----------------|
| Admin dashboard | Home cards | POS, Assign rider, Pending, In progress, Completed, Request payment, Loans, Switch to driver visible and navigate. |
| POS | Product list | Products load; add to cart works. |
| POS | Cart | Cart contents; quantity; place order succeeds. |
| POS | Completed | POS completed orders list. |
| Orders | Assign rider | Unassigned orders list; assign rider to order works. |
| Orders | Pending | Pending list; approve/reject or assign works. |
| Orders | In progress | In-progress list and detail. |
| Orders | Completed | Admin completed orders list. |
| Payments | Request payment | Request payment flow works. |
| Riders | Loans | Loans list; rider details open. |
| Riders | Rider details | Rider info and driver transactions load. |
| Profile & settings | Admin profile | Profile data and logout. |
| Profile & settings | Admin settings | Settings load and save. |
| Switch to driver | Re-auth as driver | Logs out admin; returns to driver login; driver dashboard after PIN. |

---

### 4.4 Shop Agent

| Module | Feature | Test criteria |
|--------|--------|----------------|
| Dashboard | Home | Inventory check, Inventory check history, Switch user cards; navigation correct. |
| Inventory check | New check | Start check; scan/select items; submit check; success feedback. |
| Inventory check | Checked items | List of items in current check; correct counts. |
| History | Inventory check history | Past checks list; detail view correct. |
| Menu | Terms, Privacy, Logout | Same as shared; Logout returns to auth. |
| Switch user | Re-auth | Returns to user-type selection; can log in as driver or admin. |

---

## 5. Android App (React Native – driver only)

**Product:** React Native driver app (`driver-app/`).  
**User type:** Driver only (no admin/shop_agent).

| Module | Feature | Test criteria |
|--------|--------|----------------|
| Auth | Phone → OTP → PIN setup → PIN confirm → PIN login | Full flow reaches Home. |
| Home | Home screen | Loads; main actions visible. |
| Wallet | Wallet screen | Balance and transactions load. |

---

## 6. Cross-product / regression

| Area | Test criteria |
|------|----------------|
| API contract | Customer frontend, admin frontend, and Android use same API; no breaking changes without versioning. |
| Auth consistency | Same admin/driver/shop_agent accounts work on web admin and Android with correct roles. |
| Orders E2E | Customer places order → appears in admin → driver sees in app → driver completes → customer sees status. |
| Cash at hand | Driver submits cash → admin sees pending → approval updates driver wallet. |

---

## Summary: Android 3 users

| User type    | Purpose           | Main modules |
|-------------|-------------------|--------------|
| **Driver**  | Deliver orders    | Dashboard, Orders (pending/active/completed/cancelled), Wallet (cash at hand, my wallet), Notifications, Profile, Bottom nav. |
| **Admin**   | Manage operations | Admin dashboard, POS, Assign rider, Orders (pending/in progress/completed), Request payment, Loans/Rider details, Profile, Settings, Switch to driver. |
| **Shop agent** | Inventory checks | Dashboard, Inventory check (new check, checked items), Inventory check history, Terms, Privacy, Logout, Switch user. |

Use this document for manual test checklists, regression suites, and to define automated test scope per product and module.
