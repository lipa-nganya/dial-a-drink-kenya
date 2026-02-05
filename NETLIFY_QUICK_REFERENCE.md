# Netlify Build Settings - Quick Reference

## Production Backend API URL
```
https://dialadrink-backend-prod-805803410802.us-central1.run.app/api
```

---

## Customer Frontend

### Build Settings (Copy-Paste)

**Base directory:**
```
frontend
```

**Build command:**
```
npm install && npm run build
```

**Publish directory:**
```
frontend/build
```

### Environment Variables

| Variable | Value |
|----------|-------|
| `REACT_APP_API_URL` | `https://dialadrink-backend-prod-805803410802.us-central1.run.app/api` |
| `REACT_APP_ENVIRONMENT` | `production` |
| `CI` | `true` |

---

## Admin Frontend

### Build Settings (Copy-Paste)

**Base directory:**
```
admin-frontend
```

**Build command:**
```
npm install && npm run build
```

**Publish directory:**
```
admin-frontend/build
```

### Environment Variables

| Variable | Value |
|----------|-------|
| `REACT_APP_API_URL` | `https://dialadrink-backend-prod-805803410802.us-central1.run.app/api` |
| `REACT_APP_ENVIRONMENT` | `production` |
| `CI` | `true` |

---

## Common Settings for Both

- **Repository**: Your GitHub repository
- **Branch**: `main`
- **Node version**: `18` (or latest LTS - auto-detected)
- **Build timeout**: 15 minutes (default)

---

## After Deployment

Update backend CORS with Netlify URLs:

```bash
gcloud run services update dialadrink-backend-prod \
  --region us-central1 \
  --project dialadrink-production \
  --update-env-vars FRONTEND_URL=<CUSTOMER_NETLIFY_URL> \
  --update-env-vars ADMIN_URL=<ADMIN_NETLIFY_URL>
```

Replace `<CUSTOMER_NETLIFY_URL>` and `<ADMIN_NETLIFY_URL>` with your actual Netlify site URLs.
