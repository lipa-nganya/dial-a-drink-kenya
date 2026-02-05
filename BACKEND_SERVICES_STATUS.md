# Backend Services Status

## Current Services (dialadrink-production project)

### Development Service
- **Name**: `deliveryos-backend`
- **URL**: `https://deliveryos-backend-lssctajjoq-uc.a.run.app`
- **Purpose**: Development backend
- **Serves**: 
  - `https://dialadrink.thewolfgang.tech`
  - `https://dialadrink-admin.thewolfgang.tech`
- **Database**: `dialadrink-db-prod` (currently using production database)
- **Status**: ✅ Running

### Production Service
- **Name**: `deliveryos-backend-prod`
- **URL**: `https://deliveryos-backend-prod-805803410802.us-central1.run.app`
- **Purpose**: Production backend
- **Serves**:
  - `https://ruakadrinksdelivery.co.ke`
  - `https://dial-a-drink-admin.netlify.app`
- **Database**: `dialadrink-db-prod`
- **Status**: ✅ Running

### Old Service (Can be deleted)
- **Name**: `dialadrink-backend-prod`
- **URL**: `https://dialadrink-backend-prod-lssctajjoq-uc.a.run.app`
- **Status**: Duplicate of production service

## Notes

1. **Cloud Run doesn't support renaming services directly**
   - Services are identified by their names
   - To "rename", you need to create a new service and delete the old one

2. **Current Setup**
   - `deliveryos-backend` = Development (serves dev sites)
   - `deliveryos-backend-prod` = Production (serves prod sites)

3. **Next Steps** (Optional)
   - Update `deliveryos-backend` to use development database (`dialadrink-db-dev`)
   - Delete `dialadrink-backend-prod` if no longer needed
   - Update frontend configurations to use new service URLs

## Service URLs Reference

- **Development**: `https://deliveryos-backend-lssctajjoq-uc.a.run.app`
- **Production**: `https://deliveryos-backend-prod-805803410802.us-central1.run.app`
