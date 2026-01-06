import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, Platform } from 'react-native';
import * as Location from 'expo-location';
import api from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LocationGate = ({ driverId, onLocationSet }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [requestingPermission, setRequestingPermission] = useState(false);

  useEffect(() => {
    checkAndRequestLocation();
  }, [driverId]);

  const checkAndRequestLocation = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check if location was already set
      const locationSet = await AsyncStorage.getItem('driver_location_set');
      if (locationSet === 'true') {
        // Verify location is still valid by checking driver data
        try {
          const driverResponse = await api.get(`/drivers/phone/${await AsyncStorage.getItem('driver_phone')}`);
          if (driverResponse.data?.locationLatitude && driverResponse.data?.locationLongitude) {
            console.log('✅ Location already set, skipping gate');
            onLocationSet();
            return;
          }
        } catch (e) {
          console.log('Could not verify location, will request again');
        }
      }

      // Request location permissions
      let { status } = await Location.getForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        setRequestingPermission(true);
        const { status: newStatus } = await Location.requestForegroundPermissionsAsync();
        
        if (newStatus !== 'granted') {
          setError('Location permission is required to use this app. Please enable location access in your device settings.');
          setLoading(false);
          return;
        }
        setRequestingPermission(false);
      }

      // Get current location
      console.log('📍 Getting current location...');
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeout: 10000,
        maximumAge: 60000
      });

      const { latitude, longitude } = location.coords;
      console.log(`📍 Location obtained: ${latitude}, ${longitude}`);

      // Update driver location on backend
      try {
        const response = await api.put(`/drivers/${driverId}/location`, {
          latitude,
          longitude
        });

        if (response.data.success) {
          console.log('✅ Driver location updated successfully');
          await AsyncStorage.setItem('driver_location_set', 'true');
          onLocationSet();
        } else {
          throw new Error('Failed to update location on server');
        }
      } catch (updateError) {
        console.error('Error updating location:', updateError);
        setError('Failed to update location. Please try again.');
        setLoading(false);
      }
    } catch (err) {
      console.error('Location error:', err);
      setError(err.message || 'Failed to get location. Please ensure location services are enabled.');
      setLoading(false);
    }
  };

  const handleRetry = () => {
    checkAndRequestLocation();
  };

  const handleOpenSettings = () => {
    Alert.alert(
      'Location Permission Required',
      'Please enable location access in your device settings to use this app.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => {
          if (Platform.OS === 'ios') {
            Location.requestForegroundPermissionsAsync();
          } else {
            // Android - user needs to go to settings manually
            Alert.alert('Go to Settings', 'Please go to Settings > Apps > Dial a Drink Kenya Driver > Permissions > Location and enable it.');
          }
        }}
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#00E0B8" />
        <Text style={styles.message}>
          {requestingPermission ? 'Requesting location permission...' : 'Getting your location...'}
        </Text>
        <Text style={styles.subMessage}>
          Location is required to receive orders
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorTitle}>Location Required</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <View style={styles.buttonContainer}>
          <Text style={styles.retryButton} onPress={handleRetry}>
            Retry
          </Text>
          <Text style={styles.settingsButton} onPress={handleOpenSettings}>
            Open Settings
          </Text>
        </View>
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0D0D0D',
    padding: 20
  },
  message: {
    color: '#F5F5F5',
    fontSize: 18,
    marginTop: 20,
    textAlign: 'center'
  },
  subMessage: {
    color: '#B0B0B0',
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center'
  },
  errorTitle: {
    color: '#FF6B6B',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center'
  },
  errorMessage: {
    color: '#F5F5F5',
    fontSize: 16,
    marginBottom: 30,
    textAlign: 'center',
    lineHeight: 24
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 15
  },
  retryButton: {
    backgroundColor: '#00E0B8',
    color: '#000',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
    fontSize: 16,
    fontWeight: 'bold'
  },
  settingsButton: {
    backgroundColor: '#333',
    color: '#F5F5F5',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
    fontSize: 16,
    fontWeight: 'bold'
  }
});

export default LocationGate;
