# How to Check Backend Console for User Creation Errors

## Steps to Debug the 500 Error

1. **Make sure the backend is running:**
   ```bash
   cd backend
   PORT=5001 node server.js
   ```

2. **Try creating a user in the admin panel**

3. **Look for these log messages in the backend console:**
   - `🚀 POST /users endpoint called` - Confirms the route is being hit
   - `📥 Request body:` - Shows what data is being sent
   - `👤 Admin ID:` and `👤 Admin Role:` - Shows authentication info
   - `📝 Creating new user:` - Shows user data
   - `🔍 Checking for existing user...` - Database query
   - `🔑 Generating invite token...` - Token generation
   - `💾 Creating user in database...` - User creation attempt
   
4. **If there's an error, you'll see:**
   - `❌ Error creating user:` - Main error
   - `❌ Error name:` - Error type (e.g., SequelizeValidationError, SequelizeDatabaseError)
   - `❌ Error message:` - Error description
   - `❌ Error original:` - Database-specific error
   - `❌ Sequelize errors:` - Validation errors if any

## Common Error Causes

1. **Database Schema Issues:**
   - Missing `role` column or ENUM type
   - Missing `inviteToken` or `inviteTokenExpiry` columns
   - Column type mismatches

2. **Validation Errors:**
   - Invalid email format
   - Duplicate username or email
   - Invalid role value

3. **Database Connection Issues:**
   - Database not accessible
   - Connection timeout

## Quick Test

Run this to test the database directly:
```bash
cd backend
node test-user-creation.js
```

This will show you exactly what's failing in the database.

