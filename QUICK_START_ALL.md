# Quick Start - All Servers

## Starting all servers

```bash
./start-all-servers.sh
```

Or start manually:

### Terminal 1 - Backend
```bash
cd backend
PORT=5001 npm start
```

### Terminal 2 - Customer frontend
```bash
cd frontend
npm start
```

### Terminal 3 - Admin frontend
```bash
cd admin-frontend
PORT=3001 npm start
```

### Optional - Shop agent frontend (port 3002)
```bash
cd shop-agent-frontend
PORT=3002 npm start
```

## Server URLs

- **Backend API**: http://localhost:5001
- **Customer site**: http://localhost:3000
- **Admin panel**: http://localhost:3001
- **Shop agent** (if started): http://localhost:3002

## Admin credentials (local seed)

- Username: `admin`
- Password: `admin123`

## Environment

Set at least `DATABASE_URL` (or your DB config) and `JWT_SECRET` in `backend/.env` as needed for your environment.

## Stopping servers

```bash
pkill -f 'node.*server.js'
pkill -f 'react-scripts'
pkill -f 'ngrok'
```

## Check status

```bash
lsof -ti:5001,3000,3001,3002
tail -f /tmp/backend.log
tail -f /tmp/frontend.log
tail -f /tmp/admin-frontend.log
```

## First-time setup

```bash
cd backend && npm install
cd ../frontend && npm install
cd ../admin-frontend && npm install
```

Run your usual database migrations for this project, then start the backend.
