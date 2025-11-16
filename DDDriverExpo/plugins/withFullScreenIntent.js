/**
 * Expo config plugin to add USE_FULL_SCREEN_INTENT permission for Android
 * This allows notifications to wake the screen and bring app to foreground automatically
 * 
 * Note: This plugin uses Expo's built-in config plugin API
 */
const withFullScreenIntent = (config) => {
  // Check if @expo/config-plugins is available
  let withAndroidManifest;
  try {
    withAndroidManifest = require('@expo/config-plugins').withAndroidManifest;
  } catch (e) {
    // Fallback: Add permission directly to android config
    console.log('⚠️ @expo/config-plugins not found, adding permission via android config');
    if (!config.expo.android) {
      config.expo.android = {};
    }
    if (!config.expo.android.permissions) {
      config.expo.android.permissions = [];
    }
    if (!config.expo.android.permissions.includes('USE_FULL_SCREEN_INTENT')) {
      config.expo.android.permissions.push('USE_FULL_SCREEN_INTENT');
      console.log('✅ Added USE_FULL_SCREEN_INTENT permission to Android config');
    }
    return config;
  }
  
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults.manifest;
    
    // Add USE_FULL_SCREEN_INTENT permission
    if (!androidManifest.usesPermission) {
      androidManifest.usesPermission = [];
    }
    
    const hasPermission = androidManifest.usesPermission.some(
      (perm) => perm.$['android:name'] === 'android.permission.USE_FULL_SCREEN_INTENT'
    );
    
    if (!hasPermission) {
      androidManifest.usesPermission.push({
        $: {
          'android:name': 'android.permission.USE_FULL_SCREEN_INTENT',
        },
      });
      console.log('✅ Added USE_FULL_SCREEN_INTENT permission to AndroidManifest');
    }
    
    return config;
  });
};

module.exports = withFullScreenIntent;

