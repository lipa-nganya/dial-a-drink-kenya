# Frontend apps (local)

Dial-a-Drink uses these web frontends:

1. **Customer site** (`frontend/`, port **3000**) – ordering and account flows.
2. **Admin dashboard** (`admin-frontend/`, port **3001**) – internal operations.
3. **Shop agent** (`shop-agent-frontend/`, port **3002**, optional) – shop-side tools; the backend allows this origin in CORS when configured.

## Prerequisites

- Node.js and npm
- Backend running on port **5001** (see `backend/` and `QUICK_START_ALL.md`)

## Run locally

**Backend:**
```bash
cd backend
npm start
```

**Admin:**
```bash
cd admin-frontend
PORT=3001 npm start
```

**Shop agent (optional):**
```bash
cd shop-agent-frontend
PORT=3002 npm start
```

Point the shop agent at your API URL via that app’s env docs (e.g. `REACT_APP_API_URL` / project README).

## Troubleshooting

- **Port in use:** `lsof -ti:<port>` then stop the process or pick another port.
- **CORS:** Ensure `SHOP_AGENT_URL` / `ADMIN_URL` / `FRONTEND_URL` match where you host each app in non-local deployments.
