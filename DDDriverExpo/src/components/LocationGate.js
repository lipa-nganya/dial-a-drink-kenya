import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  AppState,
  ActivityIndicator
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

const LocationGate = ({ children }) => {
  const [locationEnabled, setLocationEnabled] = useState(null);
  const [checking, setChecking] = useState(true);
  const { colors, isDarkMode } = useTheme();

  const safeColors = colors || {
    background: '#0D0D0D',
    paper: '#121212',
    textPrimary: '#F5F5F5',
    textSecondary: '#B0B0B0',
    accent: '#00E0B8',
    accentText: '#00E0B8',
    border: '#333',
    error: '#FF3366',
  };

  const checkLocationStatus = async () => {
    try {
      setChecking(true);
      
      // Request permissions first
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        console.log('❌ Location permission denied');
        setLocationEnabled(false);
        setChecking(false);
        return;
      }

      // Check if location services are enabled
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      
      if (!servicesEnabled) {
        console.log('❌ Location services are disabled');
        setLocationEnabled(false);
        setChecking(false);
        return;
      }

      console.log('✅ Location permission granted and services enabled');
      setLocationEnabled(true);
      setChecking(false);
    } catch (error) {
      console.error('❌ Error checking location status:', error);
      setLocationEnabled(false);
      setChecking(false);
    }
  };

  useEffect(() => {
    // Check location status on mount
    checkLocationStatus();

    // Monitor app state changes (when user returns to app)
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        // Re-check location when app becomes active
        checkLocationStatus();
      }
    });

    // Monitor location status periodically
    const interval = setInterval(() => {
      checkLocationStatus();
    }, 5000); // Check every 5 seconds

    return () => {
      subscription?.remove();
      clearInterval(interval);
    };
  }, []);

  const openLocationSettings = async () => {
    if (Platform.OS === 'ios') {
      // On iOS, open app settings
      const url = 'app-settings:';
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        Linking.openURL(url);
      } else {
        // Fallback: try to open general settings
        Linking.openURL('App-Prefs:root=Privacy&path=LOCATION');
      }
    } else {
      // On Android, open app settings
      Linking.openSettings();
    }
  };

  if (checking) {
    return (
      <View style={[styles.container, { backgroundColor: safeColors.background }]}>
        <View style={[styles.card, { backgroundColor: safeColors.paper, borderColor: safeColors.border }]}>
          <ActivityIndicator size="large" color={safeColors.accent} />
          <Text style={[styles.checkingText, { color: safeColors.textSecondary, marginTop: 20 }]}>
            Checking location permissions...
          </Text>
        </View>
      </View>
    );
  }

  if (!locationEnabled) {
    return (
      <View style={[styles.container, { backgroundColor: safeColors.background }]}>
        <View style={[styles.card, { backgroundColor: safeColors.paper, borderColor: safeColors.border }]}>
          <Ionicons name="location-outline" size={80} color={safeColors.error} />
          <Text style={[styles.title, { color: safeColors.textPrimary, marginTop: 20 }]}>
            Location Required
          </Text>
          <Text style={[styles.message, { color: safeColors.textSecondary, marginTop: 16 }]}>
            This app requires location services to be enabled to function properly.
          </Text>
          <Text style={[styles.message, { color: safeColors.textSecondary, marginTop: 12 }]}>
            Please enable location services in your device settings.
          </Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: safeColors.accent, marginTop: 32 }]}
            onPress={openLocationSettings}
            activeOpacity={0.7}
          >
            <Text style={[styles.buttonText, { color: '#0D0D0D' }]}>
              Open Settings
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: 'transparent', borderWidth: 1, borderColor: safeColors.border, marginTop: 12 }]}
            onPress={checkLocationStatus}
            activeOpacity={0.7}
          >
            <Text style={[styles.buttonText, { color: safeColors.accentText }]}>
              Check Again
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Location is enabled, render children
  return children;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  checkingText: {
    fontSize: 16,
    textAlign: 'center',
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default LocationGate;

