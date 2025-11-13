# Build Limit Policy

## Maximum 1 Build Per Day

To prevent excessive EAS build costs and ensure efficient development, builds are limited to **1 per day**.

## How It Works

- Each build script checks if a build was already done today
- If a build was done today, the script will exit with an error
- The limit resets automatically at midnight (new day)

## Build Scripts with Limit

These scripts automatically enforce the limit:
- `build-local.sh` - Local dev builds
- `rebuild-local-with-ngrok.sh` - Rebuilds with ngrok URL

## Managing Build Limit

### Check Build Status

```bash
./manage-build-limit.sh status
```

Shows:
- Last build date
- Today's date
- Whether building is allowed

### Reset Build Limit (Override)

If you need to build again today:

```bash
./manage-build-limit.sh reset
```

This removes the lock file and allows building again.

### Check Programmatically

```bash
./manage-build-limit.sh check
```

Returns:
- Exit code 0: Build allowed
- Exit code 1: Build limit reached

## Example Usage

### Normal Build (First of the Day)

```bash
./build-local.sh
# ✅ Build allowed - no builds today yet
# 🚀 Building Local Dev APK...
```

### Second Build Attempt (Same Day)

```bash
./build-local.sh
# ❌ Build limit reached!
# A build was already created today (2025-11-13).
# Maximum allowed: 1 build per day.
```

### Override Limit

```bash
./manage-build-limit.sh reset
./build-local.sh
# ✅ Build limit reset - You can build again now
# ✅ Build allowed - no builds today yet
# 🚀 Building Local Dev APK...
```

## Lock File

The build limit is tracked in `.build-lock` file:
- Contains the date of the last build (YYYY-MM-DD format)
- Automatically created when a build starts
- Automatically checked before each build
- Can be manually deleted to reset the limit

**Note:** `.build-lock` is in `.gitignore` and won't be committed to git.

## Why This Limit?

1. **Cost Control**: EAS builds consume build minutes (free tier has limits)
2. **Efficiency**: Encourages testing before building
3. **Resource Management**: Prevents accidental multiple builds

## Bypassing the Limit

If you need to build multiple times in a day:

1. **Reset the limit:**
   ```bash
   ./manage-build-limit.sh reset
   ```

2. **Or manually delete the lock file:**
   ```bash
   rm .build-lock
   ```

3. **Or build directly without scripts:**
   ```bash
   eas build --platform android --profile local-dev
   ```
   (This bypasses the limit check)

## Best Practices

1. **Test before building**: Use Expo Go or development builds for testing
2. **Plan builds**: Build when you have significant changes
3. **Use cloud-dev builds**: For testing cloud features without local builds
4. **Check status**: Use `./manage-build-limit.sh status` before building

## Troubleshooting

### "Build limit reached" but I haven't built today

Check the lock file:
```bash
cat .build-lock
```

If the date is wrong, reset it:
```bash
./manage-build-limit.sh reset
```

### Want to change the limit?

Edit `build-limiter.sh` to modify the limit logic (e.g., 2 per day, weekly limit, etc.)

