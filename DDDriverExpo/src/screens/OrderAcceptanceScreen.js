import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  AppState,
  Platform,
  StatusBar,
  Modal,
  Dimensions,
} from 'react-native';
import { Audio } from 'expo-av';
import { Vibration } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import Snackbar from '../components/Snackbar';

const { width, height } = Dimensions.get('window');

const OrderAcceptanceScreen = ({ route, navigation }) => {
  const { order, driverId, playSound = true } = route.params || {};
  const [loading, setLoading] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarType, setSnackbarType] = useState('info');
  const appState = useRef(AppState.currentState);
  const soundIntervalRef = useRef(null);
  const vibrationIntervalRef = useRef(null);
  const soundObjectRef = useRef(null);

  useEffect(() => {
    console.log('🚨 OrderAcceptanceScreen mounted, playSound:', playSound);
    console.log('🚨 Order:', order?.id);
    
    // Start vibration IMMEDIATELY, even before sound setup
    try {
      Vibration.vibrate([500, 100, 500, 100, 500, 100], true);
      console.log('📳 Vibration started in useEffect');
    } catch (vibError) {
      console.log('Vibration error:', vibError);
    }
    
    if (!playSound) {
      console.log('⚠️ playSound is false, skipping sound setup');
      return; // Don't play sound if flag is false, but vibration will still work
    }
    
    let soundObject = null;
    let soundLoopInterval = null;
    let vibrationInterval = null;
    
    // Set up audio mode for background playback - ensures sound plays even in silent/vibration mode
    const setupAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true, // Play even when phone is on silent (iOS)
          staysActiveInBackground: true, // Keep playing in background
          shouldDuckAndroid: false, // Don't reduce volume of other apps
          playThroughEarpieceAndroid: false, // Use speaker, not earpiece
          interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX, // Don't mix with other audio (iOS)
          interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX, // Don't mix with other audio (Android)
        });
        console.log('✅ Audio mode set up - will play even in silent/vibration mode');
      } catch (error) {
        console.warn('Could not set audio mode:', error);
      }
    };

    // Play driver sound continuously
    const playDriverSound = async () => {
      try {
        // Start continuous vibration IMMEDIATELY and keep it going
        // This ensures vibration works alongside sound
        Vibration.vibrate([500, 100, 500, 100, 500, 100], true);
        console.log('📳✅ Initial vibration started');
        
        // Set up vibration interval to keep it going continuously alongside sound
        vibrationInterval = setInterval(() => {
          Vibration.vibrate([500, 100, 500, 100], true);
        }, 1000);
        vibrationIntervalRef.current = vibrationInterval;
        console.log('📳✅ Vibration interval set up - will continue alongside sound');
        
        // Load and play the local driver sound file
        try {
          // Load the sound file from assets
          const { sound } = await Audio.Sound.createAsync(
            require('../../assets/driver_sound.wav'),
            { 
              shouldPlay: false, 
              volume: 1.0, 
              isLooping: true, // Loop continuously
              isMuted: false,
            }
          );
          
          soundObject = sound;
          soundObjectRef.current = sound; // Store in ref for cleanup
          
          // Set volume to maximum
          await sound.setVolumeAsync(1.0);
          
          // Play the sound - it will loop automatically
          await sound.playAsync();
          
          console.log('🔊 Driver sound playing continuously WITH vibration');
        } catch (localSoundError) {
          console.error('❌ Could not load local driver sound file:', localSoundError);
          console.error('Error details:', {
            message: localSoundError.message,
            code: localSoundError.code,
            name: localSoundError.name
          });
          // Even if sound fails, keep vibration going
          console.log('📳 Keeping vibration active even though sound failed');
        }
      } catch (error) {
        console.warn('Could not play driver sound:', error);
        // Ensure vibration continues even on error
        Vibration.vibrate([500, 100, 500, 100], true);
        if (!vibrationIntervalRef.current) {
          vibrationInterval = setInterval(() => {
            Vibration.vibrate([500, 100, 500, 100], true);
          }, 1000);
          vibrationIntervalRef.current = vibrationInterval;
        }
      }
    };

    setupAudio();

    // Start driver sound and vibration immediately
    // playDriverSound() now handles both sound AND vibration setup with intervals
    playDriverSound();
    
    console.log('✅ Sound and vibration setup complete - both will run continuously');

    // Handle app state changes to ensure sound continues in background
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      appState.current = nextAppState;
      // Ensure vibration continues in background
      if (nextAppState === 'background') {
        Vibration.vibrate([500, 100, 500, 100], true);
      }
    });

    return () => {
      // Clean up all intervals and vibration when component unmounts
      console.log('🧹 Cleaning up OrderAcceptanceScreen - stopping all sound and vibration');
      
      // Cancel all vibration
      Vibration.cancel();
      
      // Clear all vibration intervals
      if (vibrationInterval) {
        clearInterval(vibrationInterval);
      }
      if (vibrationIntervalRef.current) {
        clearInterval(vibrationIntervalRef.current);
        vibrationIntervalRef.current = null;
      }
      
      // Stop and unload sound
      if (soundObject) {
        soundObject.stopAsync().catch(() => {});
        soundObject.unloadAsync().catch(() => {});
      }
      if (soundObjectRef.current) {
        soundObjectRef.current.stopAsync().catch(() => {});
        soundObjectRef.current.unloadAsync().catch(() => {});
        soundObjectRef.current = null;
      }
      
      // Force cancel vibration one more time
      setTimeout(() => {
        Vibration.cancel();
      }, 100);
      
      subscription?.remove();
    };
  }, [playSound]);

  const handleResponse = async (accepted) => {
    if (!order || !driverId) {
      Alert.alert('Error', 'Missing order or driver information');
      return;
    }

    // Stop ALL sound/vibration immediately when driver responds
    console.log('🛑 Stopping all sound and vibration...');
    
    // Cancel all vibration patterns
    Vibration.cancel();
    
    // Clear vibration interval in this screen
    if (vibrationIntervalRef.current) {
      clearInterval(vibrationIntervalRef.current);
      vibrationIntervalRef.current = null;
      console.log('✅ Cleared OrderAcceptanceScreen vibration interval');
    }
    
    // Also clear any vibration intervals that might be running from HomeScreen
    // We need to access the socket ref from HomeScreen, but we can't directly
    // So we'll rely on Vibration.cancel() which should stop all patterns
    
    // Stop sound
    if (soundObjectRef.current) {
      try {
        await soundObjectRef.current.stopAsync();
        await soundObjectRef.current.unloadAsync();
        console.log('✅ Stopped sound');
      } catch (e) {
        console.log('Error stopping sound:', e);
      }
      soundObjectRef.current = null;
    }
    
    // Force stop vibration one more time to be sure
    setTimeout(() => {
      Vibration.cancel();
    }, 100);

    setLoading(true);
    try {
      const response = await api.post(`/driver-orders/${order.id}/respond`, {
        driverId: driverId,
        accepted: accepted
      });

      if (response.data.success) {
        // Ensure vibration is completely stopped before navigating
        Vibration.cancel();
        if (vibrationIntervalRef.current) {
          clearInterval(vibrationIntervalRef.current);
          vibrationIntervalRef.current = null;
        }
        
        // Navigate back to home IMMEDIATELY (before snackbar) to prevent re-triggering
        // This ensures we're on Home screen before any socket events can re-trigger
        navigation.replace('Home', { 
          phoneNumber: route.params?.phoneNumber,
          showSnackbar: true,
          snackbarMessage: accepted 
            ? 'Order accepted successfully. You can view it in your orders list.'
            : 'Order rejected.',
          snackbarType: accepted ? 'success' : 'info'
        });
        
        // Force stop vibration one more time after navigation
        setTimeout(() => {
          Vibration.cancel();
        }, 200);
      }
    } catch (error) {
      console.error('Error responding to order:', error);
      Alert.alert(
        'Error',
        error.response?.data?.error || 'Failed to respond to order. Please try again.'
      );
      // Restart sound if error occurred - vibration will continue via interval in useEffect
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Log when component renders
  console.log('🔴 OrderAcceptanceScreen component rendering');
  console.log('🔴 Order exists:', !!order);
  console.log('🔴 Order ID:', order?.id);
  console.log('🔴 Driver ID:', driverId);
  console.log('🔴 playSound:', playSound);
  console.log('🔴 Route params:', route.params);

  if (!order) {
    console.error('❌ No order data - cannot render blue screen');
    return (
      <View style={styles.blueOverlay}>
        <Text style={styles.alertTitle}>ERROR</Text>
        <Text style={styles.orderNumberText}>No order data</Text>
        <TouchableOpacity
          style={styles.acceptButton}
          onPress={() => navigation.replace('Home', { phoneNumber: route.params?.phoneNumber })}
        >
          <Text style={styles.acceptButtonText}>GO BACK</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <Modal
      visible={true}
      animationType="none"
      transparent={false}
      statusBarTranslucent={false}
      onRequestClose={() => {}} // Prevent closing by back button
      presentationStyle="fullScreen" // iOS: ensure full screen
      hardwareAccelerated={true} // Android: hardware acceleration
    >
             <StatusBar barStyle="dark-content" backgroundColor="#00E0B8" translucent={false} />
      <View style={styles.blueOverlay}>
        <View style={styles.contentContainer}>
          <Text style={styles.alertTitle}>NEW ORDER ASSIGNED</Text>
          <Text style={styles.orderNumberText}>Order #{order.id}</Text>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.rejectButton, loading && styles.buttonDisabled]}
              onPress={() => handleResponse(false)}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="large" />
              ) : (
                <Text style={styles.rejectButtonText}>REJECT</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.acceptButton, loading && styles.buttonDisabled]}
              onPress={() => handleResponse(true)}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#000000" size="large" />
              ) : (
                <Text style={styles.acceptButtonText}>ACCEPT</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  blueOverlay: {
    flex: 1,
    backgroundColor: '#00E0B8', // Aqua green - matching site color
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    // Ensure it covers everything including status bar area
    ...Platform.select({
      ios: {
        paddingTop: 0,
      },
      android: {
        paddingTop: 0,
      },
    }),
  },
  contentContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingTop: Platform.OS === 'ios' ? 50 : 0, // Leave space for status bar
  },
  alertTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 40,
    textTransform: 'uppercase',
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  orderNumberText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 80,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  buttonContainer: {
    width: '100%',
    gap: 20,
    marginTop: 40,
  },
  rejectButton: {
    width: '100%',
    backgroundColor: '#000000',
    paddingVertical: 25,
    paddingHorizontal: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
    minHeight: 70,
  },
  rejectButtonText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 3,
  },
  acceptButton: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    paddingVertical: 25,
    paddingHorizontal: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#000000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
    minHeight: 70,
  },
  acceptButtonText: {
    color: '#000000',
    fontSize: 28,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 3,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  content: {
    padding: 20,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    color: '#FF3366',
    marginBottom: 20,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#00E0B8',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#0D0D0D',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default OrderAcceptanceScreen;

