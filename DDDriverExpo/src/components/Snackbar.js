import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const Snackbar = ({ visible, message, type = 'info', onClose, duration = 5000 }) => {
  const slideAnim = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    if (visible) {
      // Slide in
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Auto close after duration
      if (duration > 0) {
        const timer = setTimeout(() => {
          handleClose();
        }, duration);

        return () => clearTimeout(timer);
      }
    } else {
      // Slide out
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, duration, slideAnim]);

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: -100,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      if (onClose) onClose();
    });
  };

  if (!visible) return null;

  // Color scheme based on type
  const getColors = () => {
    switch (type) {
      case 'success':
        return {
          backgroundColor: '#4CAF50',
          textColor: '#FFFFFF',
          icon: 'checkmark-circle',
        };
      case 'error':
        return {
          backgroundColor: '#FF3366',
          textColor: '#FFFFFF',
          icon: 'close-circle',
        };
      case 'info':
      default:
        return {
          backgroundColor: '#2196F3',
          textColor: '#FFFFFF',
          icon: 'information-circle',
        };
    }
  };

  const colors = getColors();

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          backgroundColor: colors.backgroundColor,
        },
      ]}
    >
      <View style={styles.content}>
        <Ionicons name={colors.icon} size={20} color={colors.textColor} style={styles.icon} />
        <Text style={[styles.message, { color: colors.textColor }]}>{message}</Text>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <Ionicons name="close" size={20} color={colors.textColor} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingTop: 40, // Account for status bar
    paddingBottom: 10,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  icon: {
    marginRight: 12,
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  closeButton: {
    padding: 4,
    marginLeft: 8,
  },
});

export default Snackbar;

