import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import ThemeSwitcher from '../components/ThemeSwitcher';
import { Ionicons } from '@expo/vector-icons';

const ProfileScreen = ({ route, navigation }) => {
  const { phoneNumber } = route.params || {};
  const [driverInfo, setDriverInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const { colors, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadDriverData();
  }, []);

  const loadDriverData = async () => {
    try {
      setLoading(true);
      const phone = phoneNumber || await AsyncStorage.getItem('driver_phone');
      
      if (!phone) {
        console.error('No phone number found');
        Alert.alert('Error', 'Phone number not found. Please login again.');
        navigation.replace('PhoneNumber');
        return;
      }

      console.log('Loading driver data for phone:', phone);
      
      // Load driver info
      const driverResponse = await api.get(`/drivers/phone/${phone}`);
      
      if (driverResponse.data) {
        console.log('Driver info loaded:', driverResponse.data.id);
        setDriverInfo(driverResponse.data);
      } else {
        console.error('No driver data in response');
        Alert.alert('Error', 'Driver information not found. Please contact admin.');
      }
    } catch (error) {
      console.error('Error loading driver info:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      if (error.response?.status === 404) {
        Alert.alert('Error', 'Driver account not found. Please contact admin.');
      } else {
        Alert.alert('Error', 'Failed to load driver information. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          onPress: async () => {
            // Clear login state - PIN is stored in database, not AsyncStorage
            // On next login, PhoneNumberScreen will check database for PIN existence
            // If PIN exists in database, driver will be asked to enter PIN, not OTP
            await AsyncStorage.removeItem('driver_logged_in');
            navigation.replace('PhoneNumber');
          },
        },
      ]
    );
  };

  // Ensure we have colors even if theme context fails
  const safeColors = colors || {
    background: '#0D0D0D',
    paper: '#121212',
    textPrimary: '#F5F5F5',
    textSecondary: '#B0B0B0',
    accent: '#00E0B8',
    accentText: '#00E0B8',
    border: '#333',
    error: '#FF3366',
    errorText: '#F5F5F5',
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: safeColors.background }]}>
        <ActivityIndicator size="large" color={safeColors.accent} />
        <Text style={[styles.loadingText, { color: safeColors.textSecondary }]}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: safeColors.background }]}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 100 }} // Add padding to account for logout button and bottom tab
      >
        <View style={styles.content}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={[styles.title, { color: safeColors.textPrimary }]}>Profile</Text>
            <ThemeSwitcher />
          </View>
          
          {driverInfo ? (
            <View style={[styles.infoCard, { backgroundColor: safeColors.paper }]}>
              <Text style={[styles.infoLabel, { color: safeColors.textSecondary }]}>Name:</Text>
              <Text style={[styles.infoValue, { color: safeColors.textPrimary }]}>{driverInfo.name}</Text>
              
              <Text style={[styles.infoLabel, { color: safeColors.textSecondary }]}>Phone:</Text>
              <Text style={[styles.infoValue, { color: safeColors.textPrimary }]}>{driverInfo.phoneNumber}</Text>
              
              <Text style={[styles.infoLabel, { color: safeColors.textSecondary }]}>Status:</Text>
              <Text style={[styles.infoValue, { color: safeColors.accentText }]}>
                {driverInfo.status || 'offline'}
              </Text>
            </View>
          ) : (
            <View style={[styles.infoCard, { backgroundColor: safeColors.paper }]}>
              <Text style={[styles.infoValue, { color: safeColors.textSecondary }]}>
                Loading driver information...
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
      
      {/* Logout button positioned at bottom left above menu */}
      <TouchableOpacity 
        style={[
          styles.logoutButton, 
          { 
            backgroundColor: safeColors.error || '#FF3366',
            bottom: 60 + Math.max(insets.bottom, 10) + 10, // Tab height + safe area + margin
          }
        ]} 
        onPress={handleLogout}
      >
        <Ionicons name="log-out-outline" size={16} color={safeColors.errorText || '#F5F5F5'} />
        <Text style={[styles.logoutText, { color: safeColors.errorText || '#F5F5F5' }]}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 30,
  },
  infoCard: {
    padding: 20,
    borderRadius: 8,
    marginBottom: 30,
  },
  infoLabel: {
    fontSize: 14,
    marginTop: 10,
    marginBottom: 5,
  },
  infoValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  logoutButton: {
    position: 'absolute',
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
    zIndex: 10, // Ensure it's above scroll content
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ProfileScreen;

