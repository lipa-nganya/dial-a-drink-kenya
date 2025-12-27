# Quick Start - All Servers

## 🚀 Starting All Servers

Run the start script:

```bash
./start-all-servers.sh
```

Or start manually:

### Terminal 1 - Backend
```bash
cd backend
PORT=5001 npm start
```

### Terminal 2 - Customer Frontend
```bash
cd frontend
npm start
```

### Terminal 3 - Admin Frontend
```bash
cd admin-frontend
PORT=3001 npm start
```

### Terminal 4 - Valkyrie Console
```bash
cd valkyrie-console
PORT=3002 npm start
```

### Terminal 5 - Zeus Console
```bash
cd zeus-console
PORT=3003 npm start
```

## 📋 Server URLs

Once all servers are running:

- **Backend API**: http://localhost:5001
- **Customer Site**: http://localhost:3000
- **Admin Panel**: http://localhost:3001
- **Valkyrie Console**: http://localhost:3002
- **Zeus Console**: http://localhost:3003

## 🔐 Login Credentials

### Admin Panel
- Username: `admin`
- Password: `admin123`

### Valkyrie Console (Partner)
- Email: `admin@demopartner.com`
- Password: `admin123`
- Or use API key from seed script

### Zeus Console (Super Admin)
- Email: `zeus@deliveryos.com`
- Password: `zeus123`

## ⚙️ Environment Variables

Make sure these are set in your backend `.env` or environment:

```bash
ENABLE_VALKYRIE=true
ENABLE_ZEUS=true
JWT_SECRET=your-secret-key-here
DATABASE_URL=your-database-url
```

## 🛑 Stopping All Servers

```bash
pkill -f 'node.*server.js'
pkill -f 'react-scripts'
pkill -f 'ngrok'
```

Or use Ctrl+C in each terminal.

## 📊 Check Server Status

```bash
# Check if ports are in use
lsof -ti:5001,3000,3001,3002,3003

# View logs
tail -f /tmp/backend.log
tail -f /tmp/frontend.log
tail -f /tmp/admin-frontend.log
tail -f /tmp/valkyrie-console.log
tail -f /tmp/zeus-console.log
```

## 🔍 Troubleshooting

### Port Already in Use
```bash
# Find process using port
lsof -ti:5001

# Kill process
kill -9 $(lsof -ti:5001)
```

### Servers Not Starting
1. Check Node.js version: `node --version` (should be 14+)
2. Install dependencies: `npm install` in each directory
3. Check logs in `/tmp/` directory
4. Verify environment variables are set

### API Connection Issues
1. Verify backend is running on port 5001
2. Check `ENABLE_VALKYRIE=true` and `ENABLE_ZEUS=true`
3. Check browser console for CORS errors
4. Verify database connection

## 📝 First Time Setup

1. **Install dependencies**:
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   cd ../admin-frontend && npm install
   cd ../valkyrie-console && npm install
   cd ../zeus-console && npm install
   ```

2. **Run migrations**:
   ```bash
   cd backend
   # Run Valkyrie migration
   node -e "require('./migrations/add-valkyrie-tables').up(...)"
   # Run Zeus migration
   node -e "require('./migrations/add-zeus-tables').up(...)"
   ```

3. **Seed demo data**:
   ```bash
   cd backend
   node scripts/seed-valkyrie-demo.js
   node scripts/seed-zeus-demo.js
   ```

4. **Set environment variables**:
   ```bash
   export ENABLE_VALKYRIE=true
   export ENABLE_ZEUS=true
   export JWT_SECRET=your-secret-here
   ```

5. **Start all servers**:
   ```bash
   ./start-all-servers.sh
   ```

## 🎯 Next Steps

1. Access each console and verify login works
2. Create test orders in Valkyrie Console
3. Manage partners in Zeus Console
4. Set up geofences for partners
5. Test order creation with geofence validation







