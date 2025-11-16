import React, { useState, useEffect } from 'react';
import { StatusBar, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import api from './src/services/api';
// LocationGate removed - causing performance issues
// import LocationGate from './src/components/LocationGate';
import PhoneNumberScreen from './src/screens/PhoneNumberScreen';
import OtpVerificationScreen from './src/screens/OtpVerificationScreen';
import PinSetupScreen from './src/screens/PinSetupScreen';
import PinConfirmScreen from './src/screens/PinConfirmScreen';
import PinLoginScreen from './src/screens/PinLoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import OrderHistoryScreen from './src/screens/CompletedOrdersScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import OrderAcceptanceScreen from './src/screens/OrderAcceptanceScreen';
import OrderDetailScreen from './src/screens/OrderDetailScreen';
import WalletScreen from './src/screens/WalletScreen';
import { registerForPushNotifications, configureNotificationChannel } from './src/services/notifications';

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
        component={HomeScreen}
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

// MainTabs - location gate removed due to performance issues
// Location will be requested when needed (e.g., when accepting orders)
const MainTabsWithLocationGate = () => {
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
            title: 'Liquor OS',
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
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const App = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState('PhoneNumber');
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

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
    }
  }, []);

  useEffect(() => {
    // Start with update check, then auth check
    checkForUpdates();
  }, []);

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

  return (
    <ThemeProvider>
      <StatusBar 
        barStyle="light-content" // White text on dark background
        backgroundColor={Platform.OS === 'android' ? '#000000' : undefined} // Pure black background for better contrast
        translucent={false}
      />
      <AppNavigator initialRoute={initialRoute} />
    </ThemeProvider>
  );
};

export default App;





