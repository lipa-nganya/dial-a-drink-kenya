# Admin Web & Admin Mobile — Database Calls on Open

**Scope:** “Admin mobile” is the same **admin SPA** (`admin.dialadrinkkenya.com`) on a narrow viewport — same React bundle and API calls as desktop unless noted.

---

## 1. First paint (any authenticated route behind `AdminLayout`)

| Trigger | HTTP API | DB impact (typical) |
|--------|----------|---------------------|
| `App.js` | `GET /api/health` every **5 min** | **None** — minimal app, no DB |
| `AdminLayout` | `GET /api/settings/adminAccessPaywall` on mount + **every 20s** | `SELECT` on `settings` by `key` |
| `AdminContext` (logged in) | `GET /api/admin/stats` | Heavy — see §3 |
| | `GET /api/driver-wallet/cash-submissions/pending?limit=500` | `cash_submissions` + joins (up to 500 rows) |
| | `GET /api/admin/inventory-checks?status=pending` | `inventory_checks` (or equivalent) filtered |
| | Same three + **poll every 30s** | Repeats all of the above |

**Rough steady-state while dashboard is open (per admin tab):**  
- Paywall: **3/min** → settings reads  
- Polling: **2/min** → stats + submissions + inventory checks  

So **~5–6 “burst” API calls every 30 seconds** that touch the database, plus health (no DB).

---

## 2. Dashboard route (`/`) — `AdminOverview.js` on mount

In addition to `AdminContext` above:

| API | DB impact |
|-----|-----------|
| `GET /api/admin/stats` | **Again** (duplicates context fetch on same page load) |
| `GET /api/admin/latest-orders` | `orders`: last 10 by `createdAt` |
| `GET /api/admin/top-inventory-items` | `order_items` aggregation + `drinks` + `categories`; also `orders.count()` |
| `GET /api/admin/latest-transactions` | `transactions` last 10 + optional `orders` join |
| `GET /api/admin/orders` (full list) | **Very heavy** — loads **all orders** with includes, then filters client-side for “today completed” |

Socket: `io()` + `join-admin` — **no SQL** (real-time channel).

---

## 3. `GET /api/admin/stats` (largest single cost)

Implemented as **many separate queries**, including:

- Multiple `Order.count()` / scoped counts  
- `Order.findAll` for **all** `paymentStatus = 'paid'` orders to sum revenue in JS (full scan of paid orders)  
- Similar for “today” paid orders  
- `Transaction.count` for tips  
- Multiple `Drink.count()`  

This endpoint is hit from **AdminContext** (initial + every 30s) and **AdminOverview** (initial + on socket events). **Same session can hit stats 2× on first dashboard paint**, then every 30s.

---

## 4. Mobile-only UI (`QuickActionsMenu`)

- Renders on **xs** breakpoint (`display: { xs: 'flex', md: 'none' }`).  
- When the **menu opens**, it calls `GET /api/admin/orders` again and keeps **5 recent** in UI.  
- “Force complete” flow loads **full** `/admin/orders` once.

So **mobile can add extra full-order-list fetches** when users open the quick menu.

---

## 5. Why Cloud SQL cost is high (admin side)

1. **High frequency:** stats + submissions + inventory **every 30s** per open admin session.  
2. **Heavy stats query:** loading **all paid orders** for revenue sums.  
3. **Duplicate work:** stats fetched from both `AdminContext` and `AdminOverview`.  
4. **Full order list** on dashboard for date filtering (`/admin/orders`) and quick actions.  
5. **Top inventory** aggregation scans `order_items` across history.

---

## 6. Safe Cloud SQL improvements (recommended first)

These **do not change** API behavior or UX — only help the planner use indexes:

- **`orders`:** indexes supporting `ORDER BY "createdAt" DESC`, filters on `"status"`, `"paymentStatus"`, `"createdAt"` ranges (today), and common joins.  
- **`transactions`:** index on `"createdAt"` DESC for latest list; composite for tip counts if needed.  
- **`order_items`:** index on `"drinkId"` for aggregations.  
- **`settings`:** index on `key` (if not already present).  
- **`cash_submissions`:** index on `status` + `createdAt` for pending lists.

See `backend/migrations/add-admin-performance-indexes.sql` (run after reviewing column names in your DB).

---

## 7. Future code optimizations (not in migration — discuss before changing)

| Change | Cost impact | UX risk if wrong |
|--------|-------------|------------------|
| Replace revenue sums with **SQL `SUM()`** in one query | Very high | Low if tested against current numbers |
| **Deduplicate** stats fetch (context vs overview) | Medium | Low |
| **Dedicated** `GET /admin/orders/completed-for-date?date=` instead of full list | High | Medium — must match current filters |
| Increase poll interval 30s → 60s | Medium | Slightly staler badges |
| Shorter cache on settings paywall (or ETag) | Low | Rare stale paywall state |

---

## 8. Customer site

Admin optimizations here **do not** change customer-facing behavior; customer traffic is documented separately in `DATABASE_CALLS_ANALYSIS.md` and `DATABASE_OPTIMIZATION_CHANGES.md`.
