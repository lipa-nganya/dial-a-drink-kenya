const { Expo } = require('expo-server-sdk');

const expoClient = new Expo();

function normalizeTokens(input) {
  if (!input) {
    return [];
  }

  if (Array.isArray(input)) {
    return input.filter(Boolean);
  }

  return [input].filter(Boolean);
}

async function sendPushNotification(tokens, message = {}) {
  const pushTokens = normalizeTokens(tokens).filter((token) => Expo.isExpoPushToken(token));

  if (pushTokens.length === 0) {
    return { success: false, delivered: 0, message: 'No valid Expo push tokens provided.' };
  }

  const payload = pushTokens.map((token) => ({
    to: token,
    sound: message.sound || 'default',
    title: message.title || 'Dial A Drink',
    body: message.body || '',
    data: message.data || {},
    priority: message.priority || 'high'
  }));

  const chunks = expoClient.chunkPushNotifications(payload);
  let delivered = 0;

  for (const chunk of chunks) {
    try {
      const receipts = await expoClient.sendPushNotificationsAsync(chunk);
      receipts.forEach((receipt) => {
        if (!receipt || receipt.status !== 'ok') {
          console.warn('Expo push receipt indicates failure:', receipt);
        } else {
          delivered += 1;
        }
      });
    } catch (error) {
      console.error('Error sending Expo push notifications:', error);
    }
  }

  return {
    success: delivered > 0,
    delivered,
    total: pushTokens.length
  };
}

async function sendOrderNotification(pushToken, order) {
  if (!pushToken || !Expo.isExpoPushToken(pushToken)) {
    console.warn('Invalid push token provided for order notification');
    return { success: false, message: 'Invalid push token' };
  }

  const payload = {
    to: pushToken,
    sound: 'default', // Use default sound for maximum compatibility
    title: '🚨 New Order Assigned!',
    body: `Order #${order.id} has been assigned to you. Tap to view.`,
    data: {
      orderId: order.id,
      order: order,
      type: 'order-assigned',
      autoLaunch: true
    },
    priority: 'high', // High priority for immediate delivery
    // Android-specific settings for sound and vibration when screen is off
    channelId: 'order-assignments', // Use the high-priority channel we configured
    // These settings ensure notification works when app is backgrounded or screen is off
    badge: 1
  };

  try {
    const receipts = await expoClient.sendPushNotificationsAsync([payload]);
    const receipt = receipts[0];
    
    if (receipt && receipt.status === 'ok') {
      console.log('✅ Push notification sent successfully for order #' + order.id);
      return { success: true, receipt };
    } else {
      console.warn('⚠️ Push notification receipt indicates failure:', receipt);
      return { success: false, receipt };
    }
  } catch (error) {
    console.error('❌ Error sending push notification:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendPushNotification,
  sendOrderNotification
};


