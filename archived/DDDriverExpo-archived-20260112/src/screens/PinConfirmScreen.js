import React, { useState } from 'react';
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

const PinConfirmScreen = ({ route, navigation }) => {
  const { phoneNumber, pin, forgotPin } = route.params;
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (confirmPin.length !== 4) {
      Alert.alert('Error', 'PIN must be 4 digits');
      return;
    }

    // Compare PINs - make sure we're comparing the same values
    console.log('Comparing PINs:', { confirmPin, pin, match: confirmPin === pin });
    
    if (confirmPin !== pin) {
      Alert.alert('Error', 'PINs do not match. Please try again.');
      setConfirmPin('');
      return;
    }

    setLoading(true);
    try {
      // Save PIN to database (hashed on backend)
      const pinResponse = await api.post(`/drivers/phone/${phoneNumber}/set-pin`, {
        pin: confirmPin
      });
      
      if (!pinResponse.data.success) {
        throw new Error('Failed to save PIN to database');
      }
      
              // Save phone and login status to AsyncStorage (PIN is stored in database, not AsyncStorage)
              // PIN verification always happens against database for security and persistence
              await AsyncStorage.setItem('driver_phone', String(phoneNumber));

      // Mark as logged in
      await AsyncStorage.setItem('driver_logged_in', 'true');
      
      console.log('PIN confirmed and saved to database successfully');

      // Register for push notifications after PIN setup - REQUIRED
      let pushTokenGenerated = false;
      try {
        const driverResponse = await api.get(`/drivers/phone/${phoneNumber}`);
        if (driverResponse.data?.id) {
          const driverId = driverResponse.data.id;
          console.log('📱 ===== REGISTERING FOR PUSH NOTIFICATIONS AFTER PIN SETUP =====');
          console.log('📱 Driver ID:', driverId);
          console.log('📱 Driver phone:', phoneNumber);
          
          const token = await registerForPushNotifications(driverId);
          
          if (token) {
            console.log('✅ ✅ ✅ Push notifications registered successfully after PIN setup');
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
            pushTokenGenerated = false;
          }
        } else {
          console.error('❌ Driver response missing ID:', driverResponse.data);
          pushTokenGenerated = false;
        }
      } catch (error) {
        console.error('❌ ❌ ❌ CRITICAL ERROR registering for push notifications after PIN setup:');
        console.error('❌ Error message:', error.message);
        console.error('❌ Error stack:', error.stack);
        console.error('❌ Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        pushTokenGenerated = false;
      }

      // If push token was not generated, log user out immediately
      if (!pushTokenGenerated) {
        console.error('❌ ❌ ❌ PUSH TOKEN NOT GENERATED - LOGGING USER OUT');
        console.error('❌ User must log in again to generate push token');
        
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

      // Check for OTA updates after PIN setup (ensures user gets latest version)
      try {
        if (!__DEV__ && Updates && Updates.isEnabled) {
          console.log('🔄 Checking for OTA updates after PIN setup...');
          const update = await Updates.checkForUpdateAsync();
          if (update.isAvailable) {
            console.log('✅ Update available after PIN setup! Downloading...');
            const fetchResult = await Updates.fetchUpdateAsync();
            if (fetchResult.isNew) {
              console.log('✅ New update downloaded after PIN setup, reloading app...');
              await Updates.reloadAsync();
              return; // App will reload, don't continue
            }
          } else {
            console.log('✅ App is up to date after PIN setup');
          }
        }
      } catch (error) {
        console.error('❌ Error checking for OTA updates after PIN setup:', error);
        // Don't block navigation if OTA check fails
      }

      // Navigate to home only if push token was generated
      console.log('✅ ✅ ✅ Push token generated successfully - navigating to Home');
      navigation.replace('Home', { phoneNumber });
    } catch (error) {
      console.error('Error saving PIN:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to save PIN. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Confirm Your PIN</Text>
        <Text style={styles.subtitle}>
          Enter your PIN again to confirm
        </Text>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.pinInput}
            placeholder="0000"
            placeholderTextColor="#666"
            value={confirmPin}
            onChangeText={(text) => {
              const numericText = text.replace(/\D/g, '').slice(0, 4);
              setConfirmPin(numericText);
            }}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            autoFocus
            editable={!loading}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, (confirmPin.length !== 4 || loading) && styles.buttonDisabled]}
          onPress={handleConfirm}
          disabled={confirmPin.length !== 4 || loading}
        >
          {loading ? (
            <ActivityIndicator color="#0D0D0D" />
          ) : (
            <Text style={styles.buttonText}>Confirm PIN</Text>
          )}
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
});

export default PinConfirmScreen;





