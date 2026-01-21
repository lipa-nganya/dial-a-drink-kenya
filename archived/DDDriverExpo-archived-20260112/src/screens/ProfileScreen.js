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
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import ThemeSwitcher from '../components/ThemeSwitcher';
import { Ionicons } from '@expo/vector-icons';

const ProfileScreen = ({ route, navigation }) => {
  const { phoneNumber } = route.params || {};
  const [driverInfo, setDriverInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [appInfo, setAppInfo] = useState({ version: 'N/A', otaCount: 0, branch: 'N/A', channel: 'N/A' });
  const { colors, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadDriverData();
    loadAppInfo();
  }, []);

  // Reload app info when screen comes into focus (to update OTA count)
  useEffect(() => {
    if (navigation && navigation.addListener) {
      const unsubscribe = navigation.addListener('focus', () => {
        loadAppInfo();
      });
      return unsubscribe;
    }
  }, [navigation]);

  const loadAppInfo = async () => {
    try {
      // Get app version from Constants
      const baseVersion = Constants?.expoConfig?.version || Constants?.manifest?.version || 'N/A';
      
      // Get actual update ID from Expo Updates API (persists even after data clear)
      let updateId = null;
      let updateManifestId = null;
      let otaCount = 0;
      
      try {
        if (Updates && Updates.isEnabled) {
          // Get update ID from Updates API (this is the actual update ID from Expo)
          updateId = Updates.updateId || null;
          
          // Try to get manifest ID if available
          try {
            const manifest = Updates.manifest;
            if (manifest && manifest.id) {
              updateManifestId = manifest.id;
            }
          } catch (e) {
            console.log('Could not get manifest ID:', e.message);
          }
          
          console.log('📱 OTA Update Info from Expo:', {
            updateId: updateId,
            manifestId: updateManifestId,
            isEnabled: Updates.isEnabled,
            channel: Updates.channel,
            branch: Updates.branch
          });
          
          // Track OTA count using AsyncStorage
          // Check if this is a new update by comparing updateId
          try {
            const lastUpdateId = await AsyncStorage.getItem('last_ota_update_id');
            const storedOtaCount = await AsyncStorage.getItem('ota_update_count');
            
            // If we have a stored count, use it
            if (storedOtaCount) {
              otaCount = parseInt(storedOtaCount, 10) || 0;
            }
            
            // If this is a new update (different updateId), increment the count
            if (updateId && updateId !== lastUpdateId) {
              otaCount = otaCount + 1;
              // Save the new count and update ID
              await AsyncStorage.setItem('ota_update_count', otaCount.toString());
              await AsyncStorage.setItem('last_ota_update_id', updateId);
              console.log('📱 New OTA update detected! Incremented count to:', otaCount);
            } else if (updateId && updateId === lastUpdateId) {
              // Same update, use stored count
              console.log('📱 Same OTA update, using stored count:', otaCount);
            } else if (updateId && !lastUpdateId) {
              // First time seeing this update, but we have a stored count
              // Don't increment, just use stored count
              console.log('📱 First time seeing update, using stored count:', otaCount);
              await AsyncStorage.setItem('last_ota_update_id', updateId);
            }
          } catch (storageError) {
            console.log('Error managing OTA count in storage:', storageError);
            // If storage fails, try to get count from updateId hash as fallback
            if (updateId) {
              const shortId = updateId.substring(updateId.length - 8);
              otaCount = parseInt(shortId, 16) % 10000 || 0;
            }
          }
        } else {
          console.log('📱 Updates not enabled (development mode)');
          // In dev mode, try to get stored count
          try {
            const storedCount = await AsyncStorage.getItem('ota_update_count');
            otaCount = storedCount ? parseInt(storedCount, 10) : 0;
          } catch (storageError) {
            console.log('Error loading OTA count from storage:', storageError);
          }
        }
      } catch (e) {
        console.log('Error getting update info from Expo:', e);
        // Fallback to AsyncStorage if Expo Updates API fails
        try {
          const storedCount = await AsyncStorage.getItem('ota_update_count');
          otaCount = storedCount ? parseInt(storedCount, 10) : 0;
        } catch (storageError) {
          console.log('Error loading OTA count from storage:', storageError);
        }
      }
      
      // Combine base version with OTA count
      // Show numeric OTA count instead of updateId
      let version = baseVersion;
      if (baseVersion !== 'N/A') {
        if (otaCount > 0) {
          version = `${baseVersion} (OTA: ${otaCount})`;
        }
      }
      
      // Determine branch/channel - check multiple sources
      let branch = 'N/A';
      let channel = 'N/A';
      
      // Method 1: Check build profile from environment variable (set at build time)
      const buildProfile = process.env.EXPO_PUBLIC_BUILD_PROFILE || process.env.EAS_BUILD_PROFILE;
      if (buildProfile) {
        // Map build profile to branch name
        if (buildProfile === 'local-dev') {
          branch = 'local';
        } else if (buildProfile === 'cloud-dev') {
          branch = 'cloud-dev';
        } else {
          branch = buildProfile;
        }
        console.log('📱 Branch from build profile:', branch);
      }
      
      // Method 2: Check bundle ID for local builds
      if (branch === 'N/A') {
        const bundleId = Constants?.expoConfig?.ios?.bundleIdentifier || Constants?.expoConfig?.android?.package || '';
        const appName = Constants?.expoConfig?.name || '';
        if (bundleId?.includes('.local') || appName?.includes('Local')) {
          branch = 'local';
          console.log('📱 Branch from bundle ID/app name:', branch);
        }
      }
      
      // Method 3: Check Updates module for branch/channel
      try {
        if (Updates && Updates.isEnabled) {
          const updateBranch = Updates.branch;
          const updateChannel = Updates.channel;
          
          if (updateBranch && updateBranch !== 'N/A') {
            branch = updateBranch;
            console.log('📱 Branch from Updates.branch:', branch);
          }
          
          if (updateChannel && updateChannel !== 'N/A') {
            channel = updateChannel;
            console.log('📱 Channel from Updates.channel:', channel);
          }
          
          // If we have channel but no branch, use channel as branch
          if (branch === 'N/A' && channel !== 'N/A') {
            branch = channel;
            console.log('📱 Using channel as branch:', branch);
          }
        } else {
          console.log('📱 Updates not enabled (development mode)');
        }
      } catch (e) {
        console.log('📱 Updates not available:', e.message);
      }
      
      // Method 4: Check environment variable for explicit indication
      if (branch === 'N/A') {
        if (process.env.EXPO_PUBLIC_USE_LOCAL_BACKEND === 'true' || process.env.EXPO_PUBLIC_ENV === 'local') {
          branch = 'local';
          console.log('📱 Branch from environment variable:', branch);
        }
      }
      
      // Final fallback: if still N/A, show "Development" for dev mode
      if (branch === 'N/A' && __DEV__) {
        branch = 'Development';
        console.log('📱 Branch set to Development (dev mode)');
      }
      
      setAppInfo({ version, otaCount, branch, channel, updateId, updateManifestId });
      console.log('📱 App Info loaded:', { 
        version, 
        baseVersion, 
        otaCount, 
        branch, 
        channel, 
        updateId: updateId?.substring(updateId.length - 8) || 'N/A',
        updateManifestId: updateManifestId?.substring(updateManifestId.length - 8) || 'N/A',
        buildProfile, 
        __DEV__,
        storedCount: storedCountValue
      });
    } catch (error) {
      console.error('Error loading app info:', error);
    }
  };

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

          {/* App Info Section */}
          <View style={[styles.infoCard, { backgroundColor: safeColors.paper }]}>
            <Text style={[styles.sectionTitle, { color: safeColors.textPrimary }]}>App Info</Text>
            
            <Text style={[styles.infoLabel, { color: safeColors.textSecondary }]}>Version:</Text>
            <Text style={[styles.infoValue, { color: safeColors.textPrimary }]}>
              {appInfo.version}
              {appInfo.updateId && (
                <Text style={{ fontSize: 14, color: safeColors.textSecondary }}>
                  {' '}(Update: {appInfo.updateId.substring(appInfo.updateId.length - 8)})
                </Text>
              )}
              {!appInfo.updateId && appInfo.otaCount > 0 && (
                <Text style={{ fontSize: 14, color: safeColors.textSecondary }}>
                  {' '}(OTA: {appInfo.otaCount})
                </Text>
              )}
            </Text>
            
            <Text style={[styles.infoLabel, { color: safeColors.textSecondary }]}>Branch:</Text>
            <Text style={[styles.infoValue, { color: safeColors.accentText }]}>{appInfo.branch}</Text>
            
            {appInfo.channel !== 'N/A' && appInfo.channel !== appInfo.branch && (
              <>
                <Text style={[styles.infoLabel, { color: safeColors.textSecondary }]}>Channel:</Text>
                <Text style={[styles.infoValue, { color: safeColors.textPrimary }]}>{appInfo.channel}</Text>
              </>
            )}
          </View>
        </View>
      </ScrollView>
      
      {/* Logout button positioned at bottom left above menu */}
      <TouchableOpacity 
        style={[
          styles.logoutButton, 
          { 
            backgroundColor: safeColors.error || '#FF3366',
            bottom: 60 + Math.max(insets.bottom, 10) + 30, // Tab height + safe area + more margin (moved lower)
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    marginTop: 5,
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

