# How to Access Sandbox Partners from Wolfgang Developers

Partners who signed up through the Wolfgang developers portal for sandbox API access are stored in the `valkyrie_partners` table with `environment: 'sandbox'`.

## Method 1: Zeus Console (Recommended)

1. **Open Zeus Console**: http://localhost:3003
2. **Login** with Zeus admin credentials:
   - Email: `zeus@deliveryos.com`
   - Password: `zeus123`
3. **Navigate to Partners** page
4. All partners (including sandbox) will be listed

## Method 2: Zeus API Endpoint

### Get All Partners

```bash
# Step 1: Get authentication token
TOKEN=$(curl -s -X POST http://localhost:5001/api/zeus/v1/auth/token \
  -H "Content-Type: application/json" \
  -d '{"email":"zeus@deliveryos.com","password":"zeus123"}' | \
  python3 -c "import sys, json; print(json.load(sys.stdin)['token'])")

# Step 2: Get all partners
curl -X GET http://localhost:5001/api/zeus/v1/partners \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

### Filter by Environment (Sandbox)

The Zeus API doesn't currently filter by environment, but you can filter the results:

```bash
# Get all partners and filter for sandbox
curl -X GET "http://localhost:5001/api/zeus/v1/partners" \
  -H "Authorization: Bearer $TOKEN" | \
  python3 -c "import sys, json; data=json.load(sys.stdin); \
  sandbox=[p for p in data['partners'] if p.get('environment')=='sandbox']; \
  print(json.dumps({'sandbox_partners': sandbox, 'count': len(sandbox)}, indent=2))"
```

## Method 3: Direct Database Query

```bash
cd backend
node -e "
const db = require('./models');
(async () => {
  await db.sequelize.authenticate();
  const partners = await db.ValkyriePartner.findAll({
    where: { environment: 'sandbox' },
    attributes: ['id', 'name', 'status', 'billingPlan', 'apiRateLimit', 'apiKey', 'createdAt'],
    order: [['createdAt', 'DESC']]
  });
  console.log(JSON.stringify(partners, null, 2));
  console.log('\\nTotal sandbox partners:', partners.length);
  process.exit(0);
})();
"
```

## Method 4: Add Environment Filter to Zeus API

You can enhance the Zeus API to filter by environment. Add this to `/api/zeus/v1/partners`:

```javascript
// In backend/routes/zeus.js, modify the GET /partners endpoint:
const { status, search, environment } = req.query;
const where = {};

if (status) {
  where.status = status;
}

if (environment) {
  where.environment = environment; // Filter by 'sandbox' or 'production'
}

// ... rest of the code
```

Then you can query:
```bash
curl -X GET "http://localhost:5001/api/zeus/v1/partners?environment=sandbox" \
  -H "Authorization: Bearer $TOKEN"
```

## Partner Information Available

Each sandbox partner includes:
- **id**: Partner ID
- **name**: Company/Partner name
- **status**: `active`, `suspended`, or `restricted`
- **billingPlan**: `sandbox` for sandbox partners
- **apiKey**: Sandbox API key (starts with `sk_test_`)
- **apiRateLimit**: API rate limit (typically 100 for sandbox)
- **environment**: `sandbox` or `production`
- **productionEnabled**: Whether production access is enabled
- **createdAt**: Signup date

## Related Partner Users

To see which users are associated with each partner:

```bash
node -e "
const db = require('./models');
(async () => {
  await db.sequelize.authenticate();
  const partners = await db.ValkyriePartner.findAll({
    where: { environment: 'sandbox' },
    include: [{
      model: db.ValkyriePartnerUser,
      as: 'users',
      attributes: ['id', 'email', 'role', 'status']
    }]
  });
  partners.forEach(p => {
    console.log(\`\\nPartner: \${p.name} (ID: \${p.id})\`);
    console.log(\`  Users: \${p.users?.length || 0}\`);
    p.users?.forEach(u => console.log(\`    - \${u.email} (\${u.role})\`));
  });
  process.exit(0);
})();
"
```






