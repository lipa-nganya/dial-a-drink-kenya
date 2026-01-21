const admin = require('firebase-admin');

// Initialize Firebase Admin SDK using service account JSON file
let firebaseInitialized = false;
let initializationMethod = 'none';

try {
  const path = require('path');
  const serviceAccountPath = path.join(__dirname, '..', 'firebase-service-account.json');
  
  // Method 1: Try to load service account from JSON file (local development)
  try {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    firebaseInitialized = true;
    initializationMethod = 'service account file';
    console.log('✅ Firebase Admin SDK initialized from service account file');
    console.log('✅ Project ID:', serviceAccount.project_id);
  } catch (fileError) {
    // File doesn't exist or can't be loaded - continue to other methods
    console.log('📋 Service account file not found, trying other methods...');
    
    // Method 2: Try environment variables (Cloud Run, Docker, etc.)
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      try {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          }),
        });
        firebaseInitialized = true;
        initializationMethod = 'environment variables';
        console.log('✅ Firebase Admin SDK initialized from environment variables');
        console.log('✅ Project ID:', process.env.FIREBASE_PROJECT_ID);
      } catch (envError) {
        console.error('❌ Failed to initialize from environment variables:', envError.message);
      }
    }
    
    // Method 3: Try Application Default Credentials (GCP Cloud Run, Compute Engine, etc.)
    if (!firebaseInitialized) {
      try {
        // Try ADC - works on GCP if service account has Firebase Admin SDK permissions
        const credential = admin.credential.applicationDefault();
        const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT;
        
        if (projectId) {
          admin.initializeApp({
            credential: credential,
            projectId: projectId
          });
        } else {
          admin.initializeApp({
            credential: credential
          });
        }
        
        firebaseInitialized = true;
        initializationMethod = 'Application Default Credentials (ADC)';
        console.log('✅ Firebase Admin SDK initialized using Application Default Credentials');
        console.log('✅ Project ID:', projectId || 'auto-detected');
      } catch (adcError) {
        console.error('❌ Failed to initialize from Application Default Credentials:', adcError.message);
        
        // Method 4: Try GOOGLE_APPLICATION_CREDENTIALS path
        if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
          try {
            admin.initializeApp({
              credential: admin.credential.applicationDefault(),
            });
            firebaseInitialized = true;
            initializationMethod = 'GOOGLE_APPLICATION_CREDENTIALS';
            console.log('✅ Firebase Admin SDK initialized from GOOGLE_APPLICATION_CREDENTIALS');
          } catch (gacError) {
            console.error('❌ Failed to initialize from GOOGLE_APPLICATION_CREDENTIALS:', gacError.message);
          }
        }
      }
    }
    
    // If still not initialized, log detailed error information
    if (!firebaseInitialized) {
      console.log('⚠️ Firebase Admin SDK not initialized - all methods failed');
      console.log('⚠️ Checked methods:');
      console.log('   1. Service account file:', serviceAccountPath);
      console.log('   2. Environment variables: FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL');
      console.log('   3. Application Default Credentials (ADC)');
      console.log('   4. GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS || 'not set');
      console.log('❌ Push notifications will not work without Firebase configuration');
      console.log('💡 For GCP Cloud Run: Set FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL as environment variables');
    }
  }
} catch (error) {
  console.error('❌ Error initializing Firebase Admin SDK:', error.message);
  console.error('❌ Error stack:', error.stack);
  console.log('❌ Push notifications will not work without Firebase configuration');
}

function normalizeTokens(input) {
  if (!input) {
    return [];
  }

  if (Array.isArray(input)) {
    return input.filter(Boolean);
  }

  return [input].filter(Boolean);
}

/**
 * Send push notification via Firebase Cloud Messaging (FCM) directly
 * This is for standalone production builds that use native FCM tokens
 */
async function sendFCMNotification(fcmToken, message) {
  if (!firebaseInitialized) {
    console.error('❌ Firebase Admin SDK not initialized - cannot send FCM notification');
    return { success: false, error: 'Firebase not configured' };
  }

  try {
    const payload = {
      notification: {
        title: message.title || 'Dial A Drink',
        body: message.body || '',
      },
      data: {
        ...message.data,
        // Convert data object to string format for FCM
        ...Object.keys(message.data || {}).reduce((acc, key) => {
          acc[key] = typeof message.data[key] === 'object' 
            ? JSON.stringify(message.data[key]) 
            : String(message.data[key]);
          return acc;
        }, {}),
      },
      android: {
        priority: 'high',
        notification: {
          channelId: message.channelId || 'order-assignments',
          sound: message.sound || 'default',
          priority: 'max',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: message.sound || 'default',
            badge: message.badge || 1,
          },
        },
      },
      token: fcmToken,
    };

    console.log(`📤 Sending FCM notification to token: ${fcmToken.substring(0, 20)}...`);
    
    const response = await admin.messaging().send(payload);
    console.log('✅ FCM notification sent successfully:', response);
    return { success: true, messageId: response };
  } catch (error) {
    console.error('❌ Error sending FCM notification:', error);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error message:', error.message);
    
    // Handle specific FCM errors
    if (error.code === 'messaging/registration-token-not-registered') {
      console.error('❌ FCM token not registered - device may have uninstalled app or token expired');
    } else if (error.code === 'messaging/invalid-registration-token') {
      console.error('❌ Invalid FCM token format');
    }
    
    return { success: false, error: error.message };
  }
}

async function sendPushNotification(tokens, message = {}) {
  const pushTokens = normalizeTokens(tokens);

  if (!firebaseInitialized) {
    console.error('❌ Cannot send FCM notifications - Firebase not configured');
    return {
      success: false,
      delivered: 0,
      total: pushTokens.length,
      results: pushTokens.map(() => ({ success: false, error: 'Firebase not configured' }))
    };
  }

  let delivered = 0;
  const results = [];

  // Send FCM notifications
  const fcmResults = await Promise.all(
    pushTokens.map(token => sendFCMNotification(token, message))
  );
  results.push(...fcmResults);
  delivered += fcmResults.filter(r => r.success).length;

  return {
    success: delivered > 0,
    delivered,
    total: pushTokens.length,
    results
  };
}

async function sendOrderNotification(pushToken, order) {
  if (!pushToken) {
    console.warn('❌ No push token provided for order notification');
    return { success: false, message: 'No push token provided' };
  }

  console.log(`📤 Sending push notification to token: ${pushToken.substring(0, 20)}... for order #${order.id}`);
  console.log(`📤 Token type: FCM`);
  console.log(`📤 Full token preview: ${pushToken.substring(0, 50)}...`);
  console.log(`📤 Token length: ${pushToken.length} characters`);

  const message = {
    sound: 'default',
    title: '🚨 New Order Assigned!',
    body: `Order #${order.id} has been assigned to you. Tap to view.`,
    data: {
      orderId: String(order.id),
      type: 'order-assigned',
      autoLaunch: 'true',
      channelId: 'order-assignments',
      // Send as separate fields for direct access in Android app
      customerName: String(order.customerName || 'Customer'),
      deliveryAddress: String(order.deliveryAddress || 'Address not provided'),
      totalAmount: String(order.totalAmount || '0'),
      // Also include as JSON string for compatibility
      order: JSON.stringify({
        id: order.id,
        customerName: order.customerName,
        deliveryAddress: order.deliveryAddress,
        totalAmount: order.totalAmount,
      }),
    },
    priority: 'high',
    badge: 1,
    channelId: 'order-assignments',
  };

  if (!firebaseInitialized) {
    console.error('❌ CRITICAL: Firebase Admin SDK not initialized - cannot send FCM notification');
    console.error('❌ Check that firebase-service-account.json exists in backend directory');
    return { success: false, error: 'Firebase not configured' };
  }
  
  return await sendFCMNotification(pushToken, message);
}

async function sendOrderReassignmentNotification(pushToken, order) {
  if (!pushToken) {
    console.warn('❌ No push token provided for order reassignment notification');
    return { success: false, message: 'No push token provided' };
  }

  console.log(`📤 Sending order reassignment notification to token: ${pushToken.substring(0, 20)}... for order #${order.id}`);
  console.log(`📤 Token type: FCM`);

  const message = {
    sound: 'default',
    title: '⚠️ Order Reassigned',
    body: `Order #${order.id} has been reassigned to another driver.`,
    data: {
      orderId: String(order.id),
      type: 'order-reassigned',
      channelId: 'order-assignments',
      // Include order data as JSON string for FCM compatibility
      order: JSON.stringify({
        id: order.id,
        customerName: order.customerName,
        deliveryAddress: order.deliveryAddress,
        totalAmount: order.totalAmount,
      }),
    },
    priority: 'high',
    badge: 1,
    channelId: 'order-assignments',
  };

  if (!firebaseInitialized) {
    console.error('❌ CRITICAL: Firebase Admin SDK not initialized - cannot send FCM notification');
    console.error('❌ Check that firebase-service-account.json exists in backend directory');
    return { success: false, error: 'Firebase not configured' };
  }
  
  return await sendFCMNotification(pushToken, message);
}

module.exports = {
  sendPushNotification,
  sendOrderNotification,
  sendOrderReassignmentNotification,
  sendFCMNotification
};
