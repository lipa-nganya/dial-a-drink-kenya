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
import api from '../services/api';

const PhoneNumberScreen = ({ route, navigation }) => {
  const { forgotPin } = route.params || {};
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);

  const formatPhoneNumber = (phone) => {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');
    
    // If starts with 0, replace with 254
    if (cleaned.startsWith('0')) {
      cleaned = '254' + cleaned.substring(1);
    } else if (!cleaned.startsWith('254')) {
      // If doesn't start with 254 and is 9 digits, add 254
      if (cleaned.length === 9 && cleaned.startsWith('7')) {
        cleaned = '254' + cleaned;
      }
    }
    
    return cleaned;
  };

  const validatePhoneNumber = (phone) => {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length >= 9 && (cleaned.startsWith('07') || cleaned.startsWith('2547') || (cleaned.startsWith('7') && cleaned.length === 9));
  };

  const handleSendOtp = async () => {
    if (!phoneNumber.trim()) {
      Alert.alert('Error', 'Please enter your phone number');
      return;
    }

    if (!validatePhoneNumber(phoneNumber)) {
      Alert.alert('Error', 'Please enter a valid Safaricom phone number');
      return;
    }

    setLoading(true);
    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);
      
      // ALWAYS check database first for PIN existence (not AsyncStorage)
      // This ensures PIN persistence across app reinstalls/builds
      console.log('Checking database for PIN existence for phone:', formattedPhone);
      try {
        const driverResponse = await api.get(`/drivers/phone/${formattedPhone}`);
        
        if (driverResponse.data && driverResponse.data.hasPin) {
          console.log('✅ PIN exists in database for this phone, navigating to PinLogin');
          // Save phone to AsyncStorage for convenience
          await AsyncStorage.setItem('driver_phone', formattedPhone);
          // Don't save PIN to AsyncStorage - always verify against database
          navigation.navigate('PinLogin', { phoneNumber: formattedPhone });
          setLoading(false);
          return;
        } else {
          console.log('ℹ️ No PIN found in database for this phone, proceeding with OTP flow');
        }
      } catch (driverError) {
        console.error('Error checking driver PIN:', driverError);
        console.error('Error details:', {
          status: driverError.response?.status,
          data: driverError.response?.data,
          message: driverError.message,
          url: driverError.config?.url,
          baseURL: driverError.config?.baseURL
        });
        
        // If driver doesn't exist (404), show error with more details
        if (driverError.response?.status === 404) {
          const errorMsg = driverError.response?.data?.error || 'Driver account not found';
          console.error('❌ Driver lookup failed:', {
            phone: formattedPhone,
            apiUrl: driverError.config?.baseURL,
            endpoint: driverError.config?.url,
            error: errorMsg
          });
          Alert.alert('Error', `Driver account not found for ${formattedPhone}. Please contact admin.\n\nAPI: ${driverError.config?.baseURL || 'unknown'}`);
          setLoading(false);
          return;
        }
        // For other errors (network, timeout, etc.), continue with OTP flow
        console.log('⚠️ Network/connection error during driver check, continuing with OTP flow');
        console.log('This might be a connection issue. Will try OTP flow anyway.');
      }
      
      // If forgotPin flag is set, always send OTP (even if PIN exists)
      if (forgotPin && driverResponse.data && driverResponse.data.hasPin) {
        console.log('Forgot PIN flow: Sending OTP to reset PIN');
        const response = await api.post('/auth/send-otp', {
          phone: formattedPhone,
          userType: 'driver'
        });

        if (response.data.success) {
          await AsyncStorage.setItem('driver_phone', formattedPhone);
          navigation.navigate('OtpVerification', { phoneNumber: formattedPhone, forgotPin: true });
          setLoading(false);
          return;
        } else {
          Alert.alert('Error', response.data.error || 'Failed to send OTP');
          setLoading(false);
          return;
        }
      }

      // No PIN exists in database - send OTP for PIN setup/reset
      console.log('Sending OTP for PIN setup/reset');
      const response = await api.post('/auth/send-otp', {
        phone: formattedPhone,
        userType: 'driver'
      });

      if (response.data.success) {
        // Save phone to AsyncStorage for convenience
        await AsyncStorage.setItem('driver_phone', formattedPhone);
        navigation.navigate('OtpVerification', { phoneNumber: formattedPhone, forgotPin: forgotPin || false });
      } else {
        Alert.alert('Error', response.data.error || 'Failed to send OTP');
      }
    } catch (error) {
      console.error('OTP send error:', error);
      Alert.alert(
        'Error',
        error.response?.data?.error || 'Failed to send OTP. Please check your connection and try again.'
      );
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
        <Text style={styles.title}>Enter Your Phone Number</Text>
        <Text style={styles.subtitle}>
          Enter your phone number to continue. If you have a PIN set, you'll be asked to enter it. Otherwise, we'll send you an OTP to set up your PIN.
        </Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="0712345678"
            placeholderTextColor="#666"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
            autoFocus
            editable={!loading}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSendOtp}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#0D0D0D" />
          ) : (
            <Text style={styles.buttonText}>Continue</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.helpText}>
          Make sure you're connected to the internet and the backend server is running.
        </Text>
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
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    color: '#F5F5F5',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    color: '#F5F5F5',
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
  helpText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
  },
});

export default PhoneNumberScreen;





