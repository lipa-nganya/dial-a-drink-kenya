import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import api from './api';

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    console.log('📱 Notification handler called:', notification);
    console.log('📱 Notification data:', notification.request.content.data);
    
    return {
      shouldShowAlert: true,
      shouldPlaySound: true, // Play sound even in foreground
      shouldSetBadge: true,
    };
  },
});

// Configure notification channel for Android (high priority for sound and vibration)
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
    
    // Create channel with MAX importance for sound and vibration
    await Notifications.setNotificationChannelAsync('order-assignments', {
      name: 'Order Assignments',
      description: 'Notifications for new order assignments',
      importance: Notifications.AndroidImportance.MAX, // MAX importance for sound and vibration
      vibrationPattern: [500, 100, 500, 100, 500, 100, 500],
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true, // Bypass Do Not Disturb
      playSound: true,
      enableLights: true,
      lightColor: '#00E0B8', // Accent color
    });
    console.log('✅ Configured order-assignments channel with MAX importance');
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

// Schedule a local notification (for immediate display when app is in foreground)
export async function scheduleOrderNotification(order) {
  try {
    // Use custom sound if available, otherwise fallback to default
    const soundFile = Platform.OS === 'android' ? 'driver_sound.wav' : 'default';
    
    const notificationConfig = {
      content: {
        title: '🚨 New Order Assigned!',
        body: `Order #${order.id} has been assigned to you.`,
        data: {
          orderId: order.id,
          order: order,
          type: 'order-assigned',
        },
        sound: soundFile,
        priority: Notifications.AndroidNotificationPriority.MAX,
        badge: 1,
        categoryId: 'order-assignment',
      },
      trigger: null, // Show immediately
      channelId: 'order-assignments', // Use the high-priority channel
    };
    
    // Android: Ensure sound/vibration work
    if (Platform.OS === 'android') {
      notificationConfig.android = {
        priority: 'max',
        channelId: 'order-assignments',
        sound: soundFile,
        vibrate: [500, 100, 500, 100, 500, 100, 500],
        visibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      };
    }
    
    await Notifications.scheduleNotificationAsync(notificationConfig);
    console.log('✅ Local notification scheduled for order:', order.id);
    console.log('🔊 Sound:', soundFile);
  } catch (error) {
    console.error('❌ Error scheduling notification:', error);
    // Fallback to default sound if custom sound fails
    try {
      const fallbackConfig = {
        content: {
          title: '🚨 New Order Assigned!',
          body: `Order #${order.id} has been assigned to you.`,
          data: {
            orderId: order.id,
            order: order,
            type: 'order-assigned',
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

