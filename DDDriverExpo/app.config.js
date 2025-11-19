// Dynamic Expo configuration based on environment
// This allows separate local and cloud builds without additional costs

module.exports = ({ config }) => {
  // Determine environment from EAS build profile or environment variable
  const buildProfile = process.env.EAS_BUILD_PROFILE || process.env.EXPO_PUBLIC_BUILD_PROFILE || 'development';
  const isLocalDev = buildProfile === 'local-dev' || process.env.EXPO_PUBLIC_ENV === 'local';
  const isCloudDev = buildProfile === 'cloud-dev' || process.env.EXPO_PUBLIC_ENV === 'cloud';
  
  // API Base URLs
  // For local dev: Use ngrok URL if available, otherwise fallback to localhost
  // Note: localhost only works in emulator, not on physical devices
  const ngrokUrl = process.env.EXPO_PUBLIC_API_BASE_URL || process.env.NGROK_URL || 'https://homiest-psychopharmacologic-anaya.ngrok-free.dev';
  const localApiUrl = process.env.EXPO_PUBLIC_API_BASE_URL || ngrokUrl;
  const cloudApiUrl = 'https://dialadrink-backend-910510650031.us-central1.run.app';
  
  // Choose API URL based on environment
  // For local-dev, always use ngrok URL (localhost doesn't work on physical devices)
  const apiBaseUrl = isLocalDev ? localApiUrl : cloudApiUrl;
  
  console.log('🔧 API Configuration:', {
    buildProfile,
    isLocalDev,
    apiBaseUrl,
    envApiUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
    ngrokUrl
  });
  
  // App identifiers - use different bundle IDs for local vs cloud so you can install both
  const localBundleId = 'com.dialadrink.driver.local';
  const cloudBundleId = 'com.dialadrink.driver';
  
  const bundleIdentifier = isLocalDev ? localBundleId : cloudBundleId;
  const packageName = isLocalDev ? 'com.dialadrink.driver.local' : 'com.dialadrink.driver';
  
  // App name suffix for identification
  const appNameSuffix = isLocalDev ? ' (Local)' : isCloudDev ? ' (Dev)' : '';
  
  console.log('📱 Expo Config:', {
    buildProfile,
    environment: isLocalDev ? 'LOCAL' : isCloudDev ? 'CLOUD-DEV' : 'PRODUCTION',
    apiBaseUrl,
    bundleIdentifier,
    appName: `DD Driver${appNameSuffix}`
  });

  return {
    expo: {
      name: `DD Driver${appNameSuffix}`,
      slug: 'dddriver',
      version: '1.0.35',
      orientation: 'portrait',
      icon: './assets/icon.png',
      userInterfaceStyle: 'dark',
      splash: {
        image: './assets/splash.png',
        resizeMode: 'contain',
        backgroundColor: '#0D0D0D'
      },
      updates: {
        enabled: true,
        checkAutomatically: 'ON_LOAD',
        fallbackToCacheTimeout: 0,
        url: 'https://u.expo.dev/d016afe9-031a-42ca-b832-94c00c800600'
      },
      assetBundlePatterns: [
        '**/*'
      ],
      plugins: [],
      ios: {
        supportsTablet: true,
        bundleIdentifier: bundleIdentifier,
        infoPlist: {
          NSLocationWhenInUseUsageDescription: 'This app requires location access to assign orders to the nearest driver and provide accurate delivery tracking.',
          NSLocationAlwaysAndWhenInUseUsageDescription: 'This app requires location access to assign orders to the nearest driver and provide accurate delivery tracking.',
          NSLocationAlwaysUsageDescription: 'This app requires location access to assign orders to the nearest driver and provide accurate delivery tracking.'
        }
      },
      android: {
        adaptiveIcon: {
          foregroundImage: './assets/adaptive-icon.png',
          backgroundColor: '#0D0D0D'
        },
        package: packageName,
        permissions: [
          'INTERNET',
          'ACCESS_NETWORK_STATE',
          'ACCESS_FINE_LOCATION',
          'ACCESS_COARSE_LOCATION',
          'ACCESS_BACKGROUND_LOCATION'
        ]
      },
      web: {
        favicon: './assets/favicon.png'
      },
      extra: {
        apiBaseUrl: apiBaseUrl,
        environment: isLocalDev ? 'local' : isCloudDev ? 'cloud-dev' : 'production',
        eas: {
          projectId: 'd016afe9-031a-42ca-b832-94c00c800600'
        }
      },
      runtimeVersion: {
        policy: 'appVersion'
      }
    }
  };
};

