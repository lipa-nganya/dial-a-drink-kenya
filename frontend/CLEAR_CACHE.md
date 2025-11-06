# Clear Webpack Cache - Manual Steps

If you're still seeing the Eco error, try these steps in order:

1. **Stop the dev server completely** (Ctrl+C or Cmd+C)

2. **Delete all cache directories:**
   ```bash
   cd frontend
   rm -rf node_modules/.cache
   rm -rf .cache
   rm -rf build
   rm -rf .webpack
   rm -rf .eslintcache
   ```

3. **Clear browser cache** or use incognito/private window

4. **Restart the dev server:**
   ```bash
   npm start
   ```

5. **If still failing, try:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   npm start
   ```

**Note:** The production build (`npm run build`) works fine, confirming the code is correct. This is purely a webpack dev server cache issue.

