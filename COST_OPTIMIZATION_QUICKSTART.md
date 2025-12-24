# 💰 Cloud SQL Cost Optimization - Quick Start

## 🎯 Goal
Reduce Cloud SQL costs by 70-90% by optimizing instance tier and connection settings.

## ⚡ Quick Option (Recommended)

**Downgrade existing instance** - Fastest way to reduce costs:

```bash
./scripts/quick-cost-optimization.sh
```

This script will:
- ✅ Downgrade to `db-f1-micro` (smallest tier)
- ✅ Optimize connection pool (max: 5, min: 1)
- ✅ Enable storage auto-increase
- ✅ Update Cloud Run settings

**Estimated Savings**: ~70-90% cost reduction
- Before: ~$50-200/month
- After: ~$7-15/month

## 🔄 Full Migration Option

If you want to create a new optimized instance and migrate data:

```bash
# 1. Migrate to new optimized instance
./scripts/migrate-to-serverless.sh

# 2. Setup auto-pause (optional - stops instance during low-traffic hours)
./scripts/setup-auto-pause.sh
```

## 📋 Manual Steps

### Option 1: Quick Downgrade (5 minutes)

1. **Create backup**:
   ```bash
   gcloud sql backups create --instance=drink-suite-db --project=drink-suite
   ```

2. **Downgrade instance**:
   ```bash
   gcloud sql instances patch drink-suite-db \
     --tier=db-f1-micro \
     --project=drink-suite
   ```

3. **Optimize database settings**:
   ```bash
   gcloud sql instances patch drink-suite-db \
     --database-flags=max_connections=25 \
     --project=drink-suite
   ```

4. **Update Cloud Run connection pool**:
   ```bash
   gcloud run services update dialadrink-backend \
     --region=us-central1 \
     --project=drink-suite \
     --update-env-vars "DB_POOL_MAX=5,DB_POOL_MIN=1"
   ```

### Option 2: Setup Auto-Pause (Additional Savings)

Schedule the instance to stop/start automatically:

```bash
./scripts/setup-auto-pause.sh
```

This creates Cloud Scheduler jobs to:
- **Stop**: Daily at 11:00 PM (low traffic)
- **Start**: Daily at 6:00 AM (before business hours)

**Additional Savings**: ~30% on top of tier downgrade

## ⚠️ Important Notes

1. **Downtime**: Expect 2-5 minutes during tier downgrade
2. **Performance**: Monitor application after changes
3. **Backup**: Full backup created before changes
4. **Rollback**: Keep old configuration for 7 days

## 📊 Cost Comparison

| Configuration | Monthly Cost | Savings |
|--------------|--------------|---------|
| Current (db-n1-standard-1) | ~$50-200 | - |
| Optimized (db-f1-micro) | ~$7-15 | 70-90% |
| Optimized + Auto-pause | ~$5-10 | 80-95% |

## 🔍 Monitoring

After optimization, monitor:
- Application response times
- Database CPU usage
- Connection pool usage
- Error rates

View metrics in: [GCP Console > Cloud SQL](https://console.cloud.google.com/sql/instances)

## 🆘 Troubleshooting

**If application is slow after downgrade:**
1. Check connection pool usage
2. Consider upgrading to `db-g1-small` if needed
3. Review slow query logs

**If instance won't start:**
- Check Cloud Scheduler jobs
- Verify service account permissions
- Review Cloud Function logs

## 📚 Additional Resources

- [Migration Guide](./CLOUD_SQL_SERVERLESS_MIGRATION.md) - Detailed migration steps
- [Cloud SQL Pricing](https://cloud.google.com/sql/pricing) - Current pricing
- [Instance Tiers](https://cloud.google.com/sql/docs/postgres/instance-settings#machine-types) - Available tiers




