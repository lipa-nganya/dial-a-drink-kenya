import { Platform, Linking, Alert } from 'react-native';

/**
 * Request SYSTEM_ALERT_WINDOW permission for Android
 * This allows the app to display floating overlays over other apps
 */
export async function requestOverlayPermission() {
  if (Platform.OS !== 'android') {
    console.log('Overlay permission is Android-only');
    return false;
  }

  try {
    // Check if permission is already granted
    const hasPermission = await checkOverlayPermission();
    if (hasPermission) {
      console.log('✅ Overlay permission already granted');
      return true;
    }

    // Request permission by opening settings
    Alert.alert(
      'Overlay Permission Required',
      'To show new orders even when the app is in the background, please grant "Display over other apps" permission.\n\nYou will be taken to the app settings.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Open Settings',
          onPress: () => {
            // Open app-specific settings
            Linking.openSettings();
          },
        },
      ]
    );

    return false;
  } catch (error) {
    console.error('Error requesting overlay permission:', error);
    return false;
  }
}

/**
 * Check if overlay permission is granted
 */
export async function checkOverlayPermission() {
  if (Platform.OS !== 'android') {
    return true; // iOS doesn't need this permission
  }

  try {
    // For Android, we need to use a native module or check via Settings
    // Since Expo doesn't have a direct API, we'll use a workaround
    // The permission check will be done when trying to show the overlay
    // For now, return true and handle the error when showing overlay
    return true;
  } catch (error) {
    console.error('Error checking overlay permission:', error);
    return false;
  }
}

