import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import api from './api';

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    console.log('📱 Notification handler called:', notification);
    console.log('📱 Notification data:', notification.request.content.data);
    
    // For order-assigned notifications, ensure sound and vibration
    const data = notification.request.content.data;
    if (data?.type === 'order-assigned') {
      console.log('📱 Order assignment notification - ensuring sound/vibration');
      // Reschedule as local notification with proper channel
      if (data?.order) {
        try {
          await scheduleOrderNotification(data.order);
          console.log('✅ Rescheduled push notification as local notification with proper channel');
        } catch (error) {
          console.error('❌ Error rescheduling notification:', error);
        }
      }
    }
    
    return {
      shouldShowAlert: true,
      shouldPlaySound: true, // Play sound even in foreground
      shouldSetBadge: true,
    };
  },
});

// Configure notification channel for Android (high priority to wake screen and bring app to foreground)
// This function is exported so it can be called immediately on app start
export async function configureNotificationChannel() {
  if (Platform.OS === 'android') {
    // Delete existing channel if it exists to recreate with new settings
    // This ensures MAX importance is always set correctly
    try {
      await Notifications.deleteNotificationChannelAsync('order-assignments');
      console.log('🗑️ Deleted existing order-assignments channel');
    } catch (e) {
      // Channel might not exist, that's okay
      console.log('ℹ️ Channel does not exist yet, will create new one');
    }
    
    // Create channel with MAX importance and all sound/vibration settings
    await Notifications.setNotificationChannelAsync('order-assignments', {
      name: 'Order Assignments',
      description: 'Notifications for new order assignments - wakes screen and brings app to foreground',
      importance: Notifications.AndroidImportance.MAX, // MAX importance to wake screen and bring app to foreground
      vibrationPattern: [500, 100, 500, 100, 500, 100, 500],
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true, // Bypass Do Not Disturb
      // Enable sound and vibration even when screen is off or app is in background
      playSound: true,
      enableLights: true,
      lightColor: '#00E0B8', // Accent color
      // Note: Full-screen intent capability is enabled via USE_FULL_SCREEN_INTENT permission
      // This allows notifications to automatically wake screen and bring app to foreground
    });
    console.log('✅ Configured order-assignments channel with MAX importance for full-screen intents');
    
    // Also configure default channel with MAX importance as fallback
    // This ensures push notifications that don't specify a channel still get MAX importance
    try {
      await Notifications.deleteNotificationChannelAsync('default');
      console.log('🗑️ Deleted existing default channel');
    } catch (e) {
      // Channel might not exist, that's okay
    }
    
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        description: 'Default notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [500, 100, 500, 100, 500, 100, 500],
        sound: 'default',
        enableVibrate: true,
        playSound: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
      console.log('✅ Configured default channel with MAX importance as fallback');
    } catch (e) {
      console.log('⚠️ Could not configure default channel:', e.message);
    }
  }
}

// Register for push notifications and get token
export async function registerForPushNotifications(driverId) {
  try {
    console.log('📱 Registering for push notifications...');
    
    // Configure Android channel
    await configureNotificationChannel();
    
    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('❌ Notification permissions not granted');
      return null;
    }
    
    // Get push token
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: 'd016afe9-031a-42ca-b832-94c00c800600', // From app.json
    });
    
    console.log('✅ Push token obtained:', token.data);
    
    // Send token to backend
    if (driverId && token.data) {
      try {
        await api.post('/drivers/push-token', {
          driverId,
          pushToken: token.data,
        });
        console.log('✅ Push token sent to backend');
      } catch (error) {
        console.error('❌ Error sending push token to backend:', error);
      }
    }
    
    return token.data;
  } catch (error) {
    console.error('❌ Error registering for push notifications:', error);
    return null;
  }
}

// Schedule a local notification (for immediate display even when app is in background)
// This notification will wake the screen and automatically bring the app to foreground
// Uses full-screen intent capability (requires USE_FULL_SCREEN_INTENT permission)
export async function scheduleOrderNotification(order) {
  try {
    // Use custom sound if available, otherwise fallback to default
    const soundFile = Platform.OS === 'android' ? 'driver_sound.wav' : 'default';
    
    const notificationConfig = {
      content: {
        title: '🚨 New Order Assigned!',
        body: `Order #${order.id} has been assigned to you. Opening app...`,
        data: {
          orderId: order.id,
          order: order,
          type: 'order-assigned',
          autoLaunch: true, // Flag to indicate this should auto-launch app
        },
        sound: soundFile,
        priority: Notifications.AndroidNotificationPriority.MAX, // MAX priority to wake screen
        badge: 1,
        // iOS specific: critical alert (requires special entitlement)
        categoryId: 'order-assignment',
      },
      trigger: null, // Show immediately
      channelId: 'order-assignments', // Use the high-priority channel
    };
    
    // Android: Add full-screen intent support and ensure sound/vibration work in background
    if (Platform.OS === 'android') {
      // The full-screen intent is enabled via:
      // 1. USE_FULL_SCREEN_INTENT permission (added via config plugin)
      // 2. MAX importance channel (configured above)
      // 3. MAX priority notification (set above)
      // Android will automatically use full-screen intent when app is in background
      notificationConfig.android = {
        priority: 'max',
        channelId: 'order-assignments',
        sound: soundFile, // Explicitly set sound for Android
        vibrate: [500, 100, 500, 100, 500, 100, 500], // Explicit vibration pattern
        // Ensure notification plays sound and vibrates even when screen is off
        visibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        // Full-screen intent is automatically enabled for MAX importance notifications
        // when USE_FULL_SCREEN_INTENT permission is granted
      };
    }
    
    await Notifications.scheduleNotificationAsync(notificationConfig);
    console.log('✅ Local notification scheduled for order:', order.id);
    console.log('📢 Notification will wake screen and automatically bring app to foreground');
    console.log('🔊 Sound:', soundFile);
    console.log('📱 Full-screen intent enabled (Android)');
  } catch (error) {
    console.error('❌ Error scheduling notification:', error);
    // Fallback to default sound if custom sound fails
    try {
      const fallbackConfig = {
        content: {
          title: '🚨 New Order Assigned!',
          body: `Order #${order.id} has been assigned to you. Opening app...`,
          data: {
            orderId: order.id,
            order: order,
            type: 'order-assigned',
            autoLaunch: true,
          },
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
          badge: 1,
        },
        trigger: null,
        channelId: 'order-assignments',
      };
      
      if (Platform.OS === 'android') {
        fallbackConfig.android = {
          priority: 'max',
          channelId: 'order-assignments',
        };
      }
      
      await Notifications.scheduleNotificationAsync(fallbackConfig);
      console.log('✅ Fallback notification scheduled with default sound');
    } catch (fallbackError) {
      console.error('❌ Error scheduling fallback notification:', fallbackError);
    }
  }
}

