import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import api from './api';
import { notificationEvents } from '../utils/notificationEvents';

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    notificationEvents.emit('notification-received', notification);
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    };
  }
});

// Configure notification channel for Android
export async function configureNotificationChannel() {
  if (Platform.OS === 'android') {
    try {
      await Notifications.deleteNotificationChannelAsync('order-assignments');
    } catch (e) {
      // Channel might not exist
    }
    
    await Notifications.setNotificationChannelAsync('order-assignments', {
      name: 'Order Assignments',
      description: 'Notifications for new order assignments',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [500, 100, 500, 100, 500, 100, 500],
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
      playSound: true,
      enableLights: true,
      lightColor: '#00E0B8',
    });
  }
}

// Helper to send error to backend - uses direct fetch to ensure it always works
async function sendErrorToBackend(driverId, errorMessage, errorCode = 'UNKNOWN', errorName = 'Error') {
  try {
    const baseURL = 'https://homiest-psychopharmacologic-anaya.ngrok-free.dev/api';
    await fetch(`${baseURL}/drivers/push-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      body: JSON.stringify({
        driverId,
        pushToken: null,
        tokenType: 'error',
        error: errorMessage,
        errorCode,
        errorName,
      }),
    });
  } catch (e) {
    // If even fetch fails, at least log it
    console.error('Failed to send error to backend via fetch:', e.message);
  }
}

// Register for push notifications and get token
export async function registerForPushNotifications(driverId) {
  if (!driverId) {
    await sendErrorToBackend(null, 'Function called but driverId is null/undefined', 'MISSING_DRIVER_ID', 'ValidationError');
    return null;
  }

  try {
    // Configure Android channel
    await configureNotificationChannel();
    
    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowAnnouncements: true,
        },
        android: {},
      });
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      await sendErrorToBackend(driverId, `Notification permissions not granted. Status: ${finalStatus}`, 'PERMISSION_DENIED', 'PermissionError');
      return null;
    }
    
    // CRITICAL FIX: Use Expo-managed FCM (removed googleServicesFile from app.json)
    // Expo manages FCM credentials and device registration
    // We always use getExpoPushTokenAsync() - works in both Expo Go and standalone builds
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId || 
                     Constants?.manifest?.extra?.eas?.projectId ||
                     'd016afe9-031a-42ca-b832-94c00c800600';
    
    console.log('🔍 ===== PUSH TOKEN GENERATION =====');
    console.log('🔍 Using Expo-managed FCM (no google-services.json)');
    console.log('🔍 Project ID:', projectId);
    console.log('🔍 appOwnership:', Constants?.appOwnership);
    console.log('🔍 executionEnvironment:', Constants?.executionEnvironment);
    console.log('===================================');
    
    let token = null;
    let tokenType = 'expo';
    
    // Always use Expo push token - Expo manages FCM credentials
    try {
      console.log('🔍 Attempting to get Expo push token...');
      const expoToken = await Notifications.getExpoPushTokenAsync({ projectId });
      
      if (expoToken?.data) {
        token = expoToken.data;
        tokenType = 'expo';
        console.log('✅ Expo push token acquired successfully');
        console.log('✅ Token type:', typeof token);
        console.log('✅ Token length:', token.length);
        console.log('✅ Token preview:', token.substring(0, 50));
      } else {
        throw new Error('Expo token is null or missing data');
      }
    } catch (error) {
      const errorMsg = `Expo push token failed. Error: ${error.message}. Code: ${error.code || 'UNKNOWN'}. Name: ${error.name || 'Error'}. App ownership: ${Constants?.appOwnership || 'unknown'}. Execution environment: ${Constants?.executionEnvironment || 'unknown'}. __DEV__: ${__DEV__}. Platform: ${Platform.OS}. Project ID: ${projectId}.`;
      console.error('❌ getExpoPushTokenAsync error:', error);
      console.error('❌ Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      await sendErrorToBackend(driverId, errorMsg, error.code || 'EXPO_TOKEN_FAILED', error.name || 'Error');
      return null;
    }
    
    // Send token to backend
    if (token) {
      try {
        const baseURL = 'https://homiest-psychopharmacologic-anaya.ngrok-free.dev/api';
        const response = await fetch(`${baseURL}/drivers/push-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
          },
          body: JSON.stringify({
            driverId,
            pushToken: token,
            tokenType: tokenType
          }),
        });
        
        if (!response.ok) {
          throw new Error(`Backend returned ${response.status}`);
        }
        
        return token;
      } catch (error) {
        await sendErrorToBackend(driverId, `Failed to send token to backend: ${error.message}`, 'BACKEND_ERROR', 'NetworkError');
        // Still return token - backend might be temporarily unavailable
        return token;
      }
    }
    
    return null;
  } catch (error) {
    await sendErrorToBackend(driverId, `Unexpected error: ${error.message}`, error.code || 'UNKNOWN', error.name || 'Error');
    return null;
  }
}

// Schedule a local notification (for immediate display when app is in foreground)
export async function scheduleLocalNotification(title, body, data = {}) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger: null, // Show immediately
  });
}
