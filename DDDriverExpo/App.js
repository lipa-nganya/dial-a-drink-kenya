import React, { useState, useEffect, useRef } from 'react';
import { StatusBar, Platform, AppState } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import api from './src/services/api';
import * as Location from 'expo-location';
import PhoneNumberScreen from './src/screens/PhoneNumberScreen';
import OtpVerificationScreen from './src/screens/OtpVerificationScreen';
import PinSetupScreen from './src/screens/PinSetupScreen';
import PinConfirmScreen from './src/screens/PinConfirmScreen';
import PinLoginScreen from './src/screens/PinLoginScreen';
import ActiveOrdersScreen from './src/screens/ActiveOrdersScreen';
import OrderHistoryScreen from './src/screens/CompletedOrdersScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import OrderAcceptanceScreen from './src/screens/OrderAcceptanceScreen';
import OrderDetailScreen from './src/screens/OrderDetailScreen';
import WalletScreen from './src/screens/WalletScreen';
import { registerForPushNotifications, configureNotificationChannel } from './src/services/notifications';
import * as Notifications from 'expo-notifications';
import PushNotificationOverlay from './src/components/PushNotificationOverlay';
import { notificationEvents } from './src/utils/notificationEvents';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Main Tab Navigator for authenticated users
const MainTabs = () => {
  const { isDarkMode, colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.paper,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 60 + Math.max(insets.bottom, 10), // Add safe area bottom padding, minimum 10
          paddingBottom: Math.max(insets.bottom, 10), // Position above phone navigation bar
          paddingTop: 5,
          elevation: 8, // Android shadow
          shadowColor: '#000', // iOS shadow
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        tabBarActiveTintColor: colors.accentText,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={ActiveOrdersScreen}
        options={{
          tabBarLabel: 'Active Orders',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="OrderHistoryTab"
        component={OrderHistoryScreen}
        options={{
          tabBarLabel: 'History',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="WalletTab"
        component={WalletScreen}
        options={{
          tabBarLabel: 'Wallet',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="wallet" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

// MainTabs with background location check - non-blocking
const MainTabsWithLocationGate = ({ route }) => {
  useEffect(() => {
    checkLocationInBackground();
  }, []);

  const checkLocationInBackground = async () => {
    try {
      const phone = route?.params?.phoneNumber || await AsyncStorage.getItem('driver_phone');
      if (!phone) {
        console.log('⚠️ No phone number found for location check');
        return;
      }

      const driverResponse = await api.get(`/drivers/phone/${phone}`);
      if (!driverResponse.data?.id) {
        console.log('⚠️ Driver not found for location check');
        return;
      }

      const driverId = driverResponse.data.id;

      // Check if location was already set
      const locationSet = await AsyncStorage.getItem('driver_location_set');
      if (locationSet === 'true') {
        // Verify location is still valid
        try {
          if (driverResponse.data?.locationLatitude && driverResponse.data?.locationLongitude) {
            console.log('✅ Location already set, skipping background check');
            return;
          }
        } catch (e) {
          console.log('Could not verify location, will try to update');
        }
      }

      // Request location permission (non-blocking, don't wait)
      Location.getForegroundPermissionsAsync().then(async ({ status }) => {
        if (status !== 'granted') {
          // Try to request, but don't block if denied
          const { status: newStatus } = await Location.requestForegroundPermissionsAsync();
          if (newStatus !== 'granted') {
            console.log('⚠️ Location permission not granted - will alert admin');
            alertAdminMissingLocation(driverId);
            return;
          }
        }

        // Get location with timeout (non-blocking)
        try {
          const location = await Promise.race([
            Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
              timeout: 5000, // Shorter timeout
              maximumAge: 60000
            }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Location timeout')), 5000)
            )
          ]);

          const { latitude, longitude } = location.coords;
          console.log(`📍 Background location obtained: ${latitude}, ${longitude}`);

          // Update location on backend
          await api.put(`/drivers/${driverId}/location`, {
            latitude,
            longitude
          });

          console.log('✅ Background location update successful');
          await AsyncStorage.setItem('driver_location_set', 'true');
        } catch (locationError) {
          console.error('⚠️ Background location check failed:', locationError);
          alertAdminMissingLocation(driverId);
        }
      }).catch(error => {
        console.error('Error requesting location permission:', error);
        alertAdminMissingLocation(driverId);
      });
    } catch (error) {
      console.error('Error in background location check:', error);
    }
  };

  const alertAdminMissingLocation = async (driverId) => {
    try {
      // Send alert to admin via API
      await api.post('/admin/driver-location-alert', {
        driverId: driverId,
        message: `Driver ${driverId} does not have location set. Please ensure location services are enabled.`
      });
      console.log('📢 Alerted admin about missing location');
    } catch (error) {
      console.error('Error alerting admin:', error);
    }
  };

  // Always show MainTabs - location check happens in background
  return <MainTabs />;
};

const AppNavigator = ({ initialRoute }) => {
  const { isDarkMode, colors } = useTheme();

  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName={initialRoute}
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.paper,
          },
          headerTintColor: isDarkMode ? colors.accentText : colors.textPrimary,
          headerTitleStyle: {
            fontWeight: 'bold',
            color: colors.textPrimary,
            fontSize: 16, // Reduced font size
          },
        }}
      >
        <Stack.Screen 
          name="PhoneNumber" 
          component={PhoneNumberScreen}
          options={{ title: 'Driver Login' }}
        />
        <Stack.Screen 
          name="OtpVerification" 
          component={OtpVerificationScreen}
          options={{ title: 'Verify OTP' }}
        />
        <Stack.Screen 
          name="PinSetup" 
          component={PinSetupScreen}
          options={{ title: 'Set PIN' }}
        />
        <Stack.Screen 
          name="PinConfirm" 
          component={PinConfirmScreen}
          options={{ title: 'Confirm PIN' }}
        />
        <Stack.Screen 
          name="PinLogin" 
          component={PinLoginScreen}
          options={{ title: 'Enter PIN' }}
        />
        <Stack.Screen 
          name="Home" 
          component={MainTabsWithLocationGate}
          options={{ 
            title: 'Dial a Drink, Kenya',
            headerLeft: () => null, // Hide back button completely
            headerBackVisible: false, // Also hide back button
            gestureEnabled: false, // Disable swipe back gesture
            headerTitleStyle: {
              fontSize: 16, // Reduced font size
              fontWeight: 'bold',
              color: colors.textPrimary,
            },
          }}
        />
        <Stack.Screen 
          name="OrderAcceptance" 
          component={OrderAcceptanceScreen}
          options={{ 
            headerShown: false, // Hide header - Modal will handle full screen
            presentation: 'fullScreenModal', // Full screen modal
            animation: 'none' // No animation for immediate display
          }}
        />
        <Stack.Screen 
          name="OrderDetail" 
          component={OrderDetailScreen}
          options={{ 
            title: 'Order Details',
            headerStyle: { backgroundColor: colors.paper },
            headerTintColor: isDarkMode ? colors.accentText : colors.textPrimary,
          }}
        />
        <Stack.Screen 
          name="ActiveOrders" 
          component={ActiveOrdersScreen}
          options={{ 
            title: 'Active Orders',
            headerStyle: { backgroundColor: colors.paper },
            headerTintColor: isDarkMode ? colors.accentText : colors.textPrimary,
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const App = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState('PhoneNumber');
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showPushOverlay, setShowPushOverlay] = useState(false);
  const [driverName, setDriverName] = useState('Driver');

  // Check for OTA updates
  useEffect(() => {
    checkForUpdates();
  }, []);

  const checkForUpdates = async () => {
    try {
      console.log('🔍 OTA Update Check Started');
      console.log('🔍 __DEV__:', __DEV__);
      console.log('🔍 Updates available:', !!Updates);
      
      // Only check for updates in production builds (not in development)
      if (__DEV__) {
        console.log('⚠️ Development mode - OTA updates are disabled');
        console.log('⚠️ OTA updates only work in production builds (APK installed from EAS Build)');
        console.log('⚠️ To test OTA updates, you need to:');
        console.log('   1. Build a production APK: npm run build:production');
        console.log('   2. Install the APK on your device');
        console.log('   3. Publish an update: ./publish-update.sh production "Your update"');
        checkAuthStatus();
        return;
      }

      // Check if Updates is available
      if (!Updates) {
        console.log('❌ expo-updates module not available');
        checkAuthStatus();
        return;
      }

      console.log('🔍 Updates.isEnabled:', Updates.isEnabled);
      console.log('🔍 Updates.channel:', Updates.channel);
      console.log('🔍 Updates.runtimeVersion:', Updates.runtimeVersion);
      console.log('🔍 Updates.updateId:', Updates.updateId);
      
      if (!Updates.isEnabled) {
        console.log('⚠️ Updates not enabled - this is likely a development build');
        console.log('⚠️ OTA updates only work in production builds from EAS Build');
        checkAuthStatus();
        return;
      }

      console.log('🔄 Checking for OTA updates...');
      const update = await Updates.checkForUpdateAsync();
      
      console.log('🔍 Update check result:', {
        isAvailable: update.isAvailable,
        manifest: update.manifest ? 'exists' : 'none'
      });

      if (update.isAvailable) {
        console.log('✅ Update available! Downloading...');
        console.log('📦 Update manifest:', update.manifest?.id || 'N/A');
        setIsUpdateAvailable(true);
        setIsUpdating(true);
        
        // Download the update in the background
        const fetchResult = await Updates.fetchUpdateAsync();
        console.log('✅ Update downloaded!');
        console.log('📦 Fetch result:', {
          isNew: fetchResult.isNew,
          manifest: fetchResult.manifest?.id || 'N/A'
        });
        
        // Reload the app to apply the update
        console.log('🔄 Reloading app to apply update...');
        await Updates.reloadAsync();
        // App will restart here, so code below won't execute
      } else {
        console.log('✅ App is up to date - no updates available');
        console.log('📱 Current update ID:', Updates.updateId);
        // Continue with normal app startup
        checkAuthStatus();
      }
    } catch (error) {
      console.error('❌ Error checking for updates:', error);
      console.error('❌ Error details:', {
        message: error.message,
        code: error.code,
        name: error.name
      });
      // Don't block app startup if update check fails - continue with auth check
      checkAuthStatus();
    }
  };

  // Configure notification channels immediately on app start
  // This ensures push notifications use the correct channel with MAX importance
  useEffect(() => {
    if (Platform.OS === 'android') {
      configureNotificationChannel().catch(error => {
        console.error('❌ Error configuring notification channels:', error);
      });
      
      // Request overlay permission on first launch (optional, can be done later)
      // import { requestOverlayPermission } from './src/utils/overlayPermission';
      // requestOverlayPermission().catch(error => {
      //   console.error('❌ Error requesting overlay permission:', error);
      // });
    }
  }, []);

  // Set up global push notification listener to show overlay
  useEffect(() => {
    console.log('🔔 Setting up global push notification listener for overlay');
    
    // Load driver name when setting up listeners
    const loadDriverNameForOverlay = async () => {
      try {
        const driverPhone = await AsyncStorage.getItem('driver_phone');
        const isLoggedIn = await AsyncStorage.getItem('driver_logged_in');
        if (driverPhone && isLoggedIn === 'true') {
          const driverResponse = await api.get(`/drivers/phone/${driverPhone}`);
          if (driverResponse.data?.name) {
            setDriverName(driverResponse.data.name);
            console.log('✅ Driver name loaded in notification listener:', driverResponse.data.name);
          }
        }
      } catch (error) {
        console.error('❌ Error loading driver name in notification listener:', error);
      }
    };
    
    // Load driver name immediately
    loadDriverNameForOverlay();
    
    // Listen for notification events from the handler
    const handleNotificationEvent = (notification) => {
      console.log('📱 Notification event received:', notification);
      console.log('📱 Notification data:', notification?.request?.content?.data);
      console.log('📱 Current driverName:', driverName);
      console.log('📱 Showing overlay from event...');
      // Force overlay to show - use setTimeout to ensure state update happens
      setTimeout(() => {
        setShowPushOverlay(true);
        console.log('📱 Overlay state set to true from event (after timeout), driverName:', driverName);
      }, 100);
    };
    
    notificationEvents.on('notification-received', handleNotificationEvent);
    
    // Also listen for notifications received (when app is in foreground)
    const receivedSubscription = Notifications.addNotificationReceivedListener(notification => {
      console.log('📱 Push notification received globally (received):', notification);
      console.log('📱 Notification data:', notification.request?.content?.data);
      console.log('📱 Showing overlay...');
      // Show overlay for any push notification - use setTimeout to ensure state update
      setTimeout(() => {
        setShowPushOverlay(true);
        console.log('📱 Overlay state set to true, showPushOverlay:', true);
      }, 100);
    });

    // Also listen for notification responses (when user taps notification)
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('📱 Push notification tapped globally (response):', response);
      console.log('📱 Notification data:', response.notification?.request?.content?.data);
      console.log('📱 Showing overlay from response...');
      // Use setTimeout to ensure state update happens after navigation
      setTimeout(() => {
        setShowPushOverlay(true);
        console.log('📱 Overlay state set to true from response (after timeout)');
      }, 200);
    });

    // Handle app state changes - check for notifications when app comes to foreground
    const handleAppStateChange = async (nextAppState) => {
      console.log('📱 App state changed to:', nextAppState);
      if (nextAppState === 'active') {
        console.log('📱 App came to foreground, checking for last notification...');
        try {
          // Get the last notification response (if user tapped notification while app was in background)
          const lastNotificationResponse = await Notifications.getLastNotificationResponseAsync();
          if (lastNotificationResponse) {
            console.log('📱 Found last notification response:', lastNotificationResponse);
            console.log('📱 Notification data:', lastNotificationResponse.notification?.request?.content?.data);
            console.log('📱 Showing overlay from last notification...');
            // Use setTimeout to ensure state update happens after app comes to foreground
            setTimeout(() => {
              setShowPushOverlay(true);
              console.log('📱 Overlay state set to true from last notification (after timeout)');
            }, 300);
          } else {
            console.log('📱 No last notification response found');
          }
        } catch (error) {
          console.error('❌ Error getting last notification response:', error);
        }
      }
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    // Check immediately if app is already active and there's a pending notification
    (async () => {
      if (AppState.currentState === 'active') {
        await handleAppStateChange('active');
      }
    })();

    return () => {
      notificationEvents.off('notification-received', handleNotificationEvent);
      receivedSubscription.remove();
      responseSubscription.remove();
      appStateSubscription.remove();
    };
  }, []);

  useEffect(() => {
    // Start with update check, then auth check
    checkForUpdates();
  }, []);

  // Load driver name when app becomes active (if not already loaded)
  useEffect(() => {
    const loadDriverName = async () => {
      try {
        const driverPhone = await AsyncStorage.getItem('driver_phone');
        const isLoggedIn = await AsyncStorage.getItem('driver_logged_in');
        
        console.log('📱 Checking driver name - driverPhone:', driverPhone, 'isLoggedIn:', isLoggedIn, 'current driverName:', driverName);
        
        if (driverPhone && isLoggedIn === 'true') {
          // Always try to load driver name if we have phone and login status
          console.log('📱 Loading driver name for overlay...');
          const driverResponse = await api.get(`/drivers/phone/${driverPhone}`);
          if (driverResponse.data?.name) {
            const newDriverName = driverResponse.data.name;
            console.log('✅ Driver name loaded for overlay:', newDriverName);
            setDriverName(newDriverName);
          } else {
            console.log('⚠️ Driver name not found in response');
          }
        }
      } catch (error) {
        console.error('❌ Error loading driver name:', error);
      }
    };

    // Load driver name when app becomes active
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        loadDriverName();
      }
    });

    // Also load immediately if app is already active
    if (AppState.currentState === 'active') {
      loadDriverName();
    }

    return () => {
      subscription.remove();
    };
  }, []); // Remove driverName from dependencies to avoid infinite loop

  const checkAuthStatus = async () => {
    try {
      const isLoggedIn = await AsyncStorage.getItem('driver_logged_in');
      const driverPhone = await AsyncStorage.getItem('driver_phone');
      
      console.log('App startup check - isLoggedIn:', isLoggedIn, 'driverPhone:', driverPhone);
      
      // If we have a phone number and logged in status, check the database for PIN existence
      // This ensures PIN persistence across app reinstalls/builds
      // PIN is stored in database, not AsyncStorage, so it persists across builds
      if (driverPhone && isLoggedIn === 'true') {
        try {
          const driverResponse = await api.get(`/drivers/phone/${driverPhone}`);
          
          if (driverResponse.data && driverResponse.data.hasPin) {
            console.log('✅ PIN exists in database for this phone, going to Home');
            // Load driver name for overlay
            if (driverResponse.data.name) {
              setDriverName(driverResponse.data.name);
              console.log('✅ Driver name loaded:', driverResponse.data.name);
            }
            setInitialRoute('Home');
            setIsLoading(false);
            return;
          } else {
            console.log('ℹ️ No PIN in database, clearing login state and going to PhoneNumber');
            // Clear login state if PIN doesn't exist in database
            // PhoneNumberScreen will check database and prompt for OTP if no PIN
            await AsyncStorage.removeItem('driver_logged_in');
          }
        } catch (dbError) {
          console.log('⚠️ Error checking database for PIN:', dbError);
          // If database check fails, still go to PhoneNumber screen
          // PhoneNumberScreen will handle the database check again
        }
      }
      
      // Default: start at PhoneNumber screen
      // PhoneNumberScreen will check the database for PIN existence
      console.log('Starting at PhoneNumber screen');
      setInitialRoute('PhoneNumber');
    } catch (error) {
      console.error('Error checking auth status:', error);
      setInitialRoute('PhoneNumber');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return null;
  }

  console.log('🎨 App render - showPushOverlay:', showPushOverlay, 'driverName:', driverName);

  return (
    <ThemeProvider>
      <StatusBar 
        barStyle="light-content" // White text on dark background
        backgroundColor={Platform.OS === 'android' ? '#000000' : undefined} // Pure black background for better contrast
        translucent={false}
      />
      <AppNavigator initialRoute={initialRoute} />
      {/* Render overlay outside NavigationContainer for production builds */}
      <PushNotificationOverlay 
        visible={showPushOverlay} 
        driverName={driverName}
        onClose={() => {
          console.log('🟢 Overlay onClose called, current driverName:', driverName);
          setShowPushOverlay(false);
        }} 
      />
    </ThemeProvider>
  );
};

export default App;





