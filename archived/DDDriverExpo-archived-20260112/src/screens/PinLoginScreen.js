import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import api from '../services/api';
import { registerForPushNotifications } from '../services/notifications';
import { runPushTokenDiagnostics } from '../services/pushTokenDiagnostics';

const PinLoginScreen = ({ route, navigation }) => {
  const phoneNumber = route?.params?.phoneNumber || '';
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Safety check: Verify we have the necessary data for PIN login
    const checkRoute = async () => {
      if (!phoneNumber) {
        // No phoneNumber param - check if we're already logged in
        const isLoggedIn = await AsyncStorage.getItem('driver_logged_in');
        const driverPhone = await AsyncStorage.getItem('driver_phone');
        
        if (isLoggedIn === 'true' && driverPhone) {
          console.log('Already logged in, going to Home');
          navigation.replace('Home', { phoneNumber: driverPhone });
        } else {
          console.log('Not logged in, redirecting to PhoneNumber');
          navigation.replace('PhoneNumber');
        }
      } else {
        // We have phoneNumber param - verify PIN exists in database
        try {
          const driverResponse = await api.get(`/drivers/phone/${phoneNumber}`);
          if (!driverResponse.data || !driverResponse.data.hasPin) {
            console.log('PIN not found in database, redirecting to PhoneNumber');
            navigation.replace('PhoneNumber');
          }
        } catch (error) {
          console.log('Error checking driver PIN:', error);
          navigation.replace('PhoneNumber');
        }
      }
    };
    
    checkRoute();
  }, [phoneNumber]);

  const handleLogin = async () => {
    if (pin.length !== 4) {
      Alert.alert('Error', 'Please enter your 4-digit PIN');
      return;
    }

    setLoading(true);
    try {
      const savedPhone = phoneNumber || await AsyncStorage.getItem('driver_phone');
      
      if (!savedPhone) {
        Alert.alert('Error', 'Phone number not found. Please start over.');
        navigation.replace('PhoneNumber');
        return;
      }

      // Verify PIN with database
      const verifyResponse = await api.post(`/drivers/phone/${savedPhone}/verify-pin`, {
        pin: pin
      });

      if (verifyResponse.data.success) {
        // Save phone and login status to AsyncStorage (PIN is stored in database, not AsyncStorage)
        // This is just for convenience - actual PIN verification always happens against database
        await AsyncStorage.setItem('driver_phone', savedPhone);
        await AsyncStorage.setItem('driver_logged_in', 'true');
        // Don't save PIN to AsyncStorage - always verify against database for security

        console.log('✅ PIN verified successfully against database');
        
        // Register for push notifications after successful login - REQUIRED
        // NO SAFEGUARD - will loop forever until fixed
        let pushTokenGenerated = false;
        
        try {
          const driverResponse = await api.get(`/drivers/phone/${savedPhone}`);
          if (driverResponse.data?.id) {
            const driverId = driverResponse.data.id;
            console.log('📱 ===== REGISTERING FOR PUSH NOTIFICATIONS AFTER LOGIN =====');
            console.log('📱 Driver ID:', driverId);
            console.log('📱 Driver phone:', savedPhone);
            
            // Run diagnostics BEFORE attempting registration
            console.log('🔍 Running push token diagnostics...');
            await runPushTokenDiagnostics(driverId);
            
            const token = await registerForPushNotifications(driverId);
            
            if (token) {
              console.log('✅ ✅ ✅ Push notifications registered successfully after login');
              console.log('✅ Token received (first 50 chars):', token.substring(0, 50));
              pushTokenGenerated = true;
              
              // Verify token was saved to backend
              try {
                const tokenStatusResponse = await api.get(`/drivers/${driverId}/push-token-status`);
                if (tokenStatusResponse.data?.hasPushToken) {
                  console.log('✅ ✅ ✅ Push token verified in backend');
                  pushTokenGenerated = true;
                } else {
                  console.error('❌ Push token not found in backend after registration');
                  pushTokenGenerated = false;
                }
              } catch (verifyError) {
                console.error('❌ Error verifying push token in backend:', verifyError.message);
                // Assume it worked if we got a token, but verification failed
                pushTokenGenerated = true;
              }
            } else {
              console.error('❌ ❌ ❌ Push notification registration returned NULL token');
              console.error('❌ This means registration failed - check logs above for errors');
              console.error('❌ Diagnostics have been sent to backend - check backend logs');
              pushTokenGenerated = false;
            }
          } else {
            console.error('❌ Driver response missing ID:', driverResponse.data);
            pushTokenGenerated = false;
          }
        } catch (error) {
          console.error('❌ ❌ ❌ CRITICAL ERROR registering for push notifications after login:');
          console.error('❌ Error message:', error.message);
          console.error('❌ Error stack:', error.stack);
          console.error('❌ Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
          pushTokenGenerated = false;
        }
        
        // If push token was not generated, log user out immediately - NO EXCEPTIONS
        if (!pushTokenGenerated) {
          console.error('❌ ❌ ❌ PUSH TOKEN NOT GENERATED - LOGGING USER OUT');
          console.error('❌ User must log in again to generate push token');
          console.error('❌ This will loop until push token generation is fixed');
          
          // Clear login state
          await AsyncStorage.removeItem('driver_logged_in');
          await AsyncStorage.removeItem('driver_phone');
          
          // Show alert and redirect to phone number screen
          Alert.alert(
            'Push Notification Required',
            'Push notifications are required to receive orders. Please log in again and grant notification permissions.',
            [
              {
                text: 'OK',
                onPress: () => {
                  navigation.replace('PhoneNumber');
                }
              }
            ],
            { cancelable: false }
          );
          return;
        }
        
        // Navigate to home only if push token was generated
        console.log('✅ ✅ ✅ Push token generated successfully - navigating to Home');
        navigation.replace('Home', { phoneNumber: savedPhone });
      } else {
        Alert.alert('Error', 'Incorrect PIN. Please try again.');
        setPin('');
      }
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = error.response?.data?.error || 'Failed to verify PIN. Please try again.';
      Alert.alert('Error', errorMessage);
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPin = async () => {
    // Navigate to PhoneNumber screen with forgotPin flag
    // This will trigger the forgot PIN flow: phone → OTP → set new PIN → auto login
    await AsyncStorage.removeItem('driver_logged_in');
    navigation.replace('PhoneNumber', { forgotPin: true });
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Enter Your PIN</Text>
        <Text style={styles.subtitle}>
          Enter your 4-digit PIN to continue
        </Text>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.pinInput}
            placeholder="0000"
            placeholderTextColor="#666"
            value={pin}
            onChangeText={(text) => {
              const numericText = text.replace(/\D/g, '').slice(0, 4);
              setPin(numericText);
            }}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            autoFocus
            editable={!loading}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, (pin.length !== 4 || loading) && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={pin.length !== 4 || loading}
        >
          {loading ? (
            <ActivityIndicator color="#0D0D0D" />
          ) : (
            <Text style={styles.buttonText}>Login</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.forgotButton}
          onPress={handleForgotPin}
        >
          <Text style={styles.forgotText}>Forgot PIN?</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#00E0B8',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#B0B0B0',
    marginBottom: 40,
    textAlign: 'center',
  },
  inputContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  pinInput: {
    width: 200,
    height: 60,
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    fontSize: 32,
    textAlign: 'center',
    color: '#00E0B8',
    fontWeight: 'bold',
    letterSpacing: 20,
  },
  button: {
    backgroundColor: '#00E0B8',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#0D0D0D',
    fontSize: 18,
    fontWeight: 'bold',
  },
  forgotButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  forgotText: {
    color: '#00E0B8',
    fontSize: 16,
  },
});

export default PinLoginScreen;





