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
import api from '../services/api';

const PinLoginScreen = ({ route, navigation }) => {
  const phoneNumber = route?.params?.phoneNumber || '';
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Safety check: If we're on PinLogin but user just verified OTP, redirect to PinSetup
    // This shouldn't happen but protects against navigation issues
    const checkRoute = async () => {
      const isLoggedIn = await AsyncStorage.getItem('driver_logged_in');
      const hasPin = await AsyncStorage.getItem('driver_pin');
      
      console.log('PinLoginScreen mounted - isLoggedIn:', isLoggedIn, 'hasPin:', hasPin);
      
      // If not logged in and no PIN, redirect to PhoneNumber
      if (isLoggedIn !== 'true' && !hasPin) {
        console.log('No PIN found, redirecting to PhoneNumber');
        navigation.replace('PhoneNumber');
      }
    };
    
    checkRoute();
  }, []);

  const handleLogin = async () => {
    if (pin.length !== 4) {
      Alert.alert('Error', 'Please enter your 4-digit PIN');
      return;
    }

    setLoading(true);
    try {
      const savedPin = await AsyncStorage.getItem('driver_pin');
      const savedPhone = await AsyncStorage.getItem('driver_phone') || phoneNumber;

      if (pin === savedPin) {
        // Update driver's last activity
        try {
          await api.patch(`/drivers/phone/${savedPhone}/activity`);
        } catch (error) {
          console.log('Could not update driver activity:', error);
        }

        // Mark as logged in
        await AsyncStorage.setItem('driver_logged_in', 'true');

        // Navigate to home
        navigation.replace('Home', { phoneNumber: savedPhone });
      } else {
        Alert.alert('Error', 'Incorrect PIN. Please try again.');
        setPin('');
      }
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Error', 'Failed to login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPin = () => {
    Alert.alert(
      'Reset PIN',
      'You will need to verify your phone number again with OTP to reset your PIN.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          onPress: async () => {
            await AsyncStorage.removeItem('driver_pin');
            await AsyncStorage.removeItem('driver_logged_in');
            navigation.replace('PhoneNumber');
          },
        },
      ]
    );
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





