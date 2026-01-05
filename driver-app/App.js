import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PhoneNumberScreen from './src/screens/PhoneNumberScreen';
import OtpVerificationScreen from './src/screens/OtpVerificationScreen';
import PinSetupScreen from './src/screens/PinSetupScreen';
import PinConfirmScreen from './src/screens/PinConfirmScreen';
import PinLoginScreen from './src/screens/PinLoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import WalletScreen from './src/screens/WalletScreen';

const Stack = createNativeStackNavigator();

const App = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState('PhoneNumber');

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const isLoggedIn = await AsyncStorage.getItem('driver_logged_in');
      const driverPhone = await AsyncStorage.getItem('driver_phone');
      const hasPin = await AsyncStorage.getItem('driver_pin');
      
      console.log('App startup check - isLoggedIn:', isLoggedIn, 'driverPhone:', driverPhone, 'hasPin:', hasPin);
      
      // Only go to Home if logged in AND has phone AND has PIN
      // Otherwise always start with phone number entry (will go through OTP → PIN setup)
      if (isLoggedIn === 'true' && driverPhone && hasPin) {
        console.log('User is logged in, going to Home');
        setInitialRoute('Home');
      } else {
        console.log('User not fully logged in, starting at PhoneNumber');
        // Clear any partial data
        if (hasPin && isLoggedIn !== 'true') {
          await AsyncStorage.removeItem('driver_pin');
        }
        setInitialRoute('PhoneNumber');
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      setInitialRoute('PhoneNumber');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return null; // Or a loading screen
  }

  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName={initialRoute}
        screenOptions={{
          headerStyle: {
            backgroundColor: '#121212',
          },
          headerTintColor: '#00E0B8',
          headerTitleStyle: {
            fontWeight: 'bold',
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
          component={HomeScreen}
          options={{ title: 'Driver Dashboard', headerLeft: null }}
        />
        <Stack.Screen 
          name="Wallet" 
          component={WalletScreen}
          options={{ title: 'My Wallet' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default App;





