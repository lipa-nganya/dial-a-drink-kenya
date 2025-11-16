# EAS Build Limits and How to Increase Them

## Current Situation

Expo's free tier has a limit of **1 build per day** for production builds. This can be limiting when you need to rebuild the production app multiple times.

## How to Increase Build Limits

### Option 1: Upgrade to Expo Paid Plan (Recommended)

1. **Go to Expo Dashboard**: https://expo.dev/accounts/[your-account]/settings/billing
2. **Upgrade to a paid plan**:
   - **Starter Plan**: $29/month - 30 builds/month
   - **Production Plan**: $99/month - 100 builds/month
   - **Enterprise Plan**: Custom pricing - Unlimited builds

### Option 2: Use Preview/Development Builds (Free)

For testing purposes, you can use preview or development builds which have higher limits:
- **Preview builds**: Higher limit than production
- **Development builds**: Unlimited (for development only)

```bash
# Build preview instead of production
eas build --platform android --profile preview

# Build development
eas build --platform android --profile development
```

### Option 3: Request Limit Increase (Free Tier)

You can contact Expo support to request a limit increase:
1. Go to: https://expo.dev/support
2. Explain your use case
3. Request a temporary or permanent limit increase

## Preventing Build Limit Issues

### 1. Use OTA Updates Instead of Rebuilds

**Most code changes can be pushed via OTA updates without rebuilding:**

```bash
# Publish OTA update instead of rebuilding
./publish-update.sh production "Your update message"
```

**OTA updates work for:**
- JavaScript/TypeScript code changes
- React component updates
- UI/UX changes
- Business logic changes
- API endpoint changes

**OTA updates DON'T work for:**
- Native code changes
- New native modules
- App permissions changes
- app.json configuration changes

### 2. Test Thoroughly Before Production Builds

- Use preview builds for testing
- Use local-dev builds for local testing
- Only build production when absolutely necessary

### 3. Use Build Profiles Strategically

- **local-dev**: For local testing (unlimited)
- **preview**: For internal testing (higher limit)
- **production**: For live app (1 build/day on free tier)

## Current Configuration

Your `eas.json` is configured with:
- **local-dev**: Uses ngrok/localhost API
- **cloud-dev**: Uses cloud-dev API
- **production**: Uses cloud-dev API
- **development**: Uses cloud-dev API

## Best Practices

1. **Use OTA updates for most changes** - They're instant and don't count against build limits
2. **Only rebuild when necessary** - Native changes, permissions, etc.
3. **Test in preview first** - Before building production
4. **Monitor build usage** - Check Expo dashboard regularly

## Checking Build Usage

```bash
# Check your build history
eas build:list

# Check your account limits
# Visit: https://expo.dev/accounts/[your-account]/settings/billing
```

## Summary

- **Free tier**: 1 production build/day
- **Solution**: Use OTA updates for most changes, only rebuild when necessary
- **Upgrade**: Consider paid plan if you need more builds
- **Current fix**: API URL resolution now checks update channel first, so OTA updates work correctly

