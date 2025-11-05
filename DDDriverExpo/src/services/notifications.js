import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import api from './api';

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Configure notification channel for Android (high priority to wake screen)
async function configureNotificationChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('order-assignments', {
      name: 'Order Assignments',
      description: 'Notifications for new order assignments',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [500, 100, 500, 100, 500],
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
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
export async function scheduleOrderNotification(order) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🚨 New Order Assigned!',
        body: `Order #${order.id} has been assigned to you. Tap to view.`,
        data: {
          orderId: order.id,
          order: order,
          type: 'order-assigned',
        },
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null, // Show immediately
    });
    console.log('✅ Local notification scheduled for order:', order.id);
  } catch (error) {
    console.error('❌ Error scheduling notification:', error);
  }
}

