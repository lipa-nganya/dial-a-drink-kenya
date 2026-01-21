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

/**
 * Root-level push notification overlay component
 * This component is rendered at the native OS level using react-native-root-siblings
 * It bypasses React Native's view hierarchy to ensure it appears on top in production builds
 */
const PushNotificationOverlay = ({ visible = true, onClose, driverName = 'Driver' }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    console.log('🔴 PushNotificationOverlay (Root): Component mounted, driverName:', driverName);
    
    // Animate in immediately when component mounts (root siblings handles visibility)
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      console.log('🔴 PushNotificationOverlay (Root): Animation completed');
    });

    // Note: Auto-close is handled by overlayService (3 seconds)
    // This component will be destroyed by the service

    return () => {
      console.log('🔴 PushNotificationOverlay (Root): Component unmounting');
    };
  }, [driverName]);

  const handleClose = () => {
    console.log('🔴 PushNotificationOverlay (Root): Closing overlay');
    // Animate out
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      if (onClose) {
        onClose();
      }
    });
  };

  console.log('🔴 PushNotificationOverlay (Root): Rendering at root level, driverName:', driverName);

  return (
    <View style={styles.rootContainer}>
      <StatusBar hidden={true} />
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
  rootContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: width,
    height: height,
    // Root siblings renders at native level, so zIndex/elevation are handled natively
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

