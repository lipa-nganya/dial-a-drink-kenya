/**
 * Expo config plugin to add permissions for overlay and full-screen notifications
 * - USE_FULL_SCREEN_INTENT: Allows notifications to wake screen and show full-screen
 * - SYSTEM_ALERT_WINDOW: Allows app to draw over other apps (for floating overlay)
 */
const { withAndroidManifest } = require('@expo/config-plugins');

const withFullScreenIntent = (config) => {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults.manifest;
    
    // Initialize usesPermission array if it doesn't exist
    if (!androidManifest.usesPermission) {
      androidManifest.usesPermission = [];
    }
    
    // Add USE_FULL_SCREEN_INTENT permission (for full-screen notifications)
    const hasFullScreenPermission = androidManifest.usesPermission.some(
      (perm) => perm.$ && perm.$['android:name'] === 'android.permission.USE_FULL_SCREEN_INTENT'
    );
    
    if (!hasFullScreenPermission) {
      androidManifest.usesPermission.push({
        $: {
          'android:name': 'android.permission.USE_FULL_SCREEN_INTENT',
        },
      });
    }
    
    // Note: SYSTEM_ALERT_WINDOW is a runtime permission and cannot be declared in manifest
    // It must be requested at runtime via Settings. The overlayPermission utility handles this.
    
    // Add FOREGROUND_SERVICE permission (for background service)
    const hasForegroundService = androidManifest.usesPermission.some(
      (perm) => perm.$ && perm.$['android:name'] === 'android.permission.FOREGROUND_SERVICE'
    );
    
    if (!hasForegroundService) {
      androidManifest.usesPermission.push({
        $: {
          'android:name': 'android.permission.FOREGROUND_SERVICE',
        },
      });
    }
    
    // Add WAKE_LOCK permission (to keep screen on)
    const hasWakeLock = androidManifest.usesPermission.some(
      (perm) => perm.$ && perm.$['android:name'] === 'android.permission.WAKE_LOCK'
    );
    
    if (!hasWakeLock) {
      androidManifest.usesPermission.push({
        $: {
          'android:name': 'android.permission.WAKE_LOCK',
        },
      });
    }
    
    return config;
  });
};

module.exports = withFullScreenIntent;

