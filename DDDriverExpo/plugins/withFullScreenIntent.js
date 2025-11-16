/**
 * Expo config plugin to add USE_FULL_SCREEN_INTENT permission for Android
 * This allows notifications to wake the screen and bring app to foreground automatically
 */
const { withAndroidManifest } = require('@expo/config-plugins');

const withFullScreenIntent = (config) => {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults.manifest;
    
    // Add USE_FULL_SCREEN_INTENT permission
    if (!androidManifest.usesPermission) {
      androidManifest.usesPermission = [];
    }
    
    const hasPermission = androidManifest.usesPermission.some(
      (perm) => perm.$ && perm.$['android:name'] === 'android.permission.USE_FULL_SCREEN_INTENT'
    );
    
    if (!hasPermission) {
      androidManifest.usesPermission.push({
        $: {
          'android:name': 'android.permission.USE_FULL_SCREEN_INTENT',
        },
      });
    }
    
    return config;
  });
};

module.exports = withFullScreenIntent;

