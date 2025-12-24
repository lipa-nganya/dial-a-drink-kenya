// Dynamic Expo configuration based on environment
module.exports = ({ config }) => {
  // Determine environment from EAS build profile or environment variable
  const buildProfile = process.env.EAS_BUILD_PROFILE || process.env.EXPO_PUBLIC_BUILD_PROFILE || 'development';
  const isLocalDev = buildProfile === 'local-dev' || process.env.EXPO_PUBLIC_ENV === 'local';
  const isCloudDev = buildProfile === 'cloud-dev' || process.env.EXPO_PUBLIC_ENV === 'cloud';
  
  // API Base URLs
  // For local dev: Use ngrok URL if available, otherwise fallback to localhost
  // Note: localhost only works in emulator, not on physical devices
  const ngrokUrl = process.env.EXPO_PUBLIC_API_BASE_URL || process.env.NGROK_URL || 'http://localhost:5001';
  const localApiUrl = process.env.EXPO_PUBLIC_API_BASE_URL || ngrokUrl;
  const cloudApiUrl = 'https://dialadrink-backend-910510650031.us-central1.run.app';
  
  // Choose API URL based on environment
  const apiBaseUrl = isLocalDev ? localApiUrl : (isCloudDev ? cloudApiUrl : cloudApiUrl);
  
  console.log('🔧 Retail Scanner API Configuration:', {
    buildProfile,
    isLocalDev,
    isCloudDev,
    apiBaseUrl,
    envApiUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
    ngrokUrl
  });
  
  // App identifiers - use different bundle IDs for local vs cloud so you can install both
  const localBundleId = 'com.dialadrink.retailscanner.local';
  const cloudBundleId = 'com.dialadrink.retailscanner';
  
  const bundleIdentifier = isLocalDev ? localBundleId : cloudBundleId;
  const packageName = isLocalDev ? 'com.dialadrink.retailscanner.local' : 'com.dialadrink.retailscanner';
  
  // App name suffix for identification
  const appNameSuffix = isLocalDev ? ' (Local)' : isCloudDev ? ' (Dev)' : '';
  
  console.log('📱 Retail Scanner Expo Config:', {
    buildProfile,
    environment: isLocalDev ? 'LOCAL' : isCloudDev ? 'CLOUD-DEV' : 'PRODUCTION',
    apiBaseUrl,
    bundleIdentifier,
    appName: `Retail Scanner${appNameSuffix}`
  });

  return {
    expo: {
      owner: 'dialadrink',
      name: `Retail Scanner${appNameSuffix}`,
      slug: 'retail-scanner',
      version: '1.0.1',
      orientation: 'portrait',
      icon: './assets/icon.png',
      userInterfaceStyle: 'light',
      splash: {
        image: './assets/splash.png',
        resizeMode: 'contain',
        backgroundColor: '#ffffff'
      },
      updates: {
        url: 'https://u.expo.dev/2012aa46-473a-4dd1-8061-0135a89e8cf6',
        fallbackToCacheTimeout: 0
      },
      assetBundlePatterns: [
        '**/*'
      ],
      ios: {
        supportsTablet: true,
        bundleIdentifier: bundleIdentifier
      },
      android: {
        adaptiveIcon: {
          foregroundImage: './assets/adaptive-icon.png',
          backgroundColor: '#ffffff'
        },
        package: packageName,
        permissions: [
          'CAMERA'
        ]
      },
      web: {
        favicon: './assets/favicon.png'
      },
      scheme: 'retailscanner',
      plugins: [
        [
          'expo-camera',
          {
            cameraPermission: 'Allow Retail Scanner to access your camera to scan barcodes.'
          }
        ]
      ],
      extra: {
        apiBaseUrl: apiBaseUrl,
        eas: {
          projectId: '2012aa46-473a-4dd1-8061-0135a89e8cf6'
        }
      },
      runtimeVersion: {
        policy: 'appVersion'
      }
    }
  };
};

