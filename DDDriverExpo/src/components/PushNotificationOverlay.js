import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
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

  // Use View with absolute positioning instead of Modal for production builds
  // Modal outside NavigationContainer doesn't work reliably in production builds
  // Always render the container but control visibility with opacity and pointerEvents
  console.log('🟢 PushNotificationOverlay: Rendering overlay with View (production build compatible), visible:', visible, 'driverName:', driverName);

  return (
    <View
      style={[
        styles.modalContainer,
        {
          opacity: visible ? 1 : 0,
          pointerEvents: visible ? 'auto' : 'none', // Block touches when visible, allow pass-through when hidden
        }
      ]}
    >
      {visible && <StatusBar hidden={true} />}
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        <Text style={styles.greetingText}>Hi {driverName}</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: width,
    height: height,
    zIndex: 999999,
    elevation: 999999, // Android elevation - ensure it's on top of everything
    ...Platform.select({
      ios: {
        zIndex: 999999,
      },
      android: {
        elevation: 999999,
      },
    }),
  },
  overlay: {
    flex: 1,
    backgroundColor: '#90EE90', // Light green
    width: width,
    height: height,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        paddingTop: 0,
      },
      android: {
        paddingTop: 0,
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

