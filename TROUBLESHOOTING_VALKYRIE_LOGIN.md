# Troubleshooting Valkyrie Login Issues

## Issue: 401 Unauthorized Error

If you're getting 401 errors when trying to log in to the Valkyrie Console, follow these steps:

### Step 1: Verify User Exists

```bash
cd backend
node -e "
const db = require('./models');
(async () => {
  await db.sequelize.authenticate();
  const user = await db.ValkyriePartnerUser.findOne({
    where: { email: 'admin@demopartner.com' },
    include: [{ model: db.ValkyriePartner, as: 'partner' }]
  });
  if (user) {
    console.log('✅ User found:', user.email);
    console.log('   Status:', user.status);
    console.log('   Partner:', user.partner?.name, '- Status:', user.partner?.status);
  } else {
    console.log('❌ User not found - run seed script');
  }
  process.exit(0);
})();
"
```

### Step 2: Run Seed Script (if user doesn't exist)

```bash
cd backend
node scripts/seed-valkyrie-demo.js
```

### Step 3: Test API Directly

```bash
curl -X POST http://localhost:5001/api/valkyrie/v1/auth/token \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demopartner.com","password":"admin123"}'
```

If this works, the issue is in the frontend. If it doesn't, check backend logs.

### Step 4: Check Backend Logs

```bash
tail -f /tmp/backend.log | grep -i valkyrie
```

Look for authentication attempts and error messages.

### Step 5: Verify Environment Variables

```bash
cd backend
grep ENABLE_VALKYRIE .env
```

Should show: `ENABLE_VALKYRIE=true`

### Step 6: Common Issues

1. **Email has whitespace**: The backend trims email, but check your input
2. **Password case-sensitive**: Make sure you're typing `admin123` exactly
3. **Partner inactive**: Partner status must be 'active'
4. **User inactive**: User status must be 'active'
5. **CORS issues**: Check browser console for CORS errors

### Step 7: Reset Password (if needed)

If you need to reset the password:

```bash
cd backend
node -e "
const db = require('./models');
const bcrypt = require('bcryptjs');
(async () => {
  await db.sequelize.authenticate();
  const user = await db.ValkyriePartnerUser.findOne({
    where: { email: 'admin@demopartner.com' }
  });
  if (user) {
    const newPassword = await bcrypt.hash('admin123', 10);
    await user.update({ password: newPassword });
    console.log('✅ Password reset to: admin123');
  }
  process.exit(0);
})();
"
```

### Demo Credentials

- **Email**: `admin@demopartner.com`
- **Password**: `admin123`

Or use API key authentication (get from seed script output).






