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

module.exports = {
  sendPushNotification
};

