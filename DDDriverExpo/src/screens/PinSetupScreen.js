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
import api from '../services/api';

const PinSetupScreen = ({ route, navigation }) => {
  const { phoneNumber, forgotPin } = route.params || {};
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    console.log('PinSetupScreen mounted with phoneNumber:', phoneNumber);
    if (!phoneNumber) {
      console.error('No phoneNumber in route params, navigating back');
      navigation.replace('PhoneNumber');
    }
  }, []);

  const handleContinue = () => {
    if (pin.length !== 4) {
      Alert.alert('Error', 'PIN must be 4 digits');
      return;
    }

    // Pass the PIN as a string to ensure consistency
    console.log('PIN setup complete, navigating to PinConfirm with PIN:', pin, 'forgotPin:', forgotPin);
    navigation.navigate('PinConfirm', { phoneNumber, pin: String(pin), forgotPin: forgotPin || false });
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Set Your PIN</Text>
        <Text style={styles.subtitle}>
          Create a 4-digit PIN for secure login
        </Text>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.pinInput}
            placeholder="0000"
            placeholderTextColor="#666"
            value={pin}
            onChangeText={(text) => {
              // Only allow numbers and limit to 4 digits
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
          onPress={handleContinue}
          disabled={pin.length !== 4 || loading}
        >
          {loading ? (
            <ActivityIndicator color="#0D0D0D" />
          ) : (
            <Text style={styles.buttonText}>Continue</Text>
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

export default PinSetupScreen;





