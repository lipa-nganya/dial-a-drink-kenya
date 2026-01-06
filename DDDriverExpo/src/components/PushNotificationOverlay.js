import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  Dimensions,
  Platform,
  StatusBar,
} from 'react-native';

const { width, height } = Dimensions.get('window');

const PushNotificationOverlay = ({ visible, onClose, driverName = 'Driver' }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    console.log('🟢 PushNotificationOverlay: useEffect triggered, visible:', visible, 'driverName:', driverName);
    if (visible) {
      console.log('🟢 PushNotificationOverlay: Starting animation, driverName:', driverName);
      // Animate in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        console.log('🟢 PushNotificationOverlay: Animation completed');
      });

      // Auto close after 3 seconds
      const timer = setTimeout(() => {
        console.log('🟢 PushNotificationOverlay: Auto-closing after 3 seconds');
        handleClose();
      }, 3000);

      return () => clearTimeout(timer);
    } else {
      // Reset animation when hidden
      fadeAnim.setValue(0);
    }
  }, [visible, driverName]);

  const handleClose = () => {
    console.log('🟢 PushNotificationOverlay: Closing overlay');
    // Animate out
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  useEffect(() => {
    if (visible) {
      console.log('🟢 PushNotificationOverlay: visible=true, showing overlay, driverName:', driverName);
    } else {
      console.log('🔴 PushNotificationOverlay: visible=false, hiding overlay');
    }
  }, [visible, driverName]);

  console.log('🟢 PushNotificationOverlay: Render check - visible:', visible, 'driverName:', driverName);

  // Always render Modal (even when not visible) to ensure it works in production builds
  // Modal's visible prop will handle the actual visibility
  console.log('🟢 PushNotificationOverlay: Rendering Modal with visible:', visible, 'driverName:', driverName);

  // Always render Modal, but control visibility
  // This ensures Modal works in production builds (not just Expo Go)
  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent={false}
      presentationStyle="fullScreen"
      hardwareAccelerated={true}
    >
      <StatusBar hidden={true} />
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: fadeAnim,
            zIndex: 999999,
            elevation: 999999, // Android elevation
          },
        ]}
      >
        <Text style={styles.greetingText}>Hi {driverName}</Text>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#90EE90', // Light green
    width: width,
    height: height,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99999,
    elevation: 99999, // Android elevation - ensure it's on top
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        paddingTop: 0,
      },
      android: {
        paddingTop: 0,
        elevation: 99999, // Ensure highest elevation on Android
      },
    }),
  },
  greetingText: {
    fontSize: 64,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
    letterSpacing: 3,
  },
});

export default PushNotificationOverlay;

