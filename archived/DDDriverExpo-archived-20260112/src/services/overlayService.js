import RootSiblings from 'react-native-root-siblings';
import React from 'react';
import PushNotificationOverlay from '../components/PushNotificationOverlay';

let overlayInstance = null;

/**
 * Show the push notification overlay at root level
 * This renders the overlay at the native OS level, bypassing React Native's view hierarchy
 * @param {string} driverName - The driver's name to display
 */
export function showPushNotificationOverlay(driverName = 'Driver') {
  console.log('🔴 OverlayService: Showing overlay at root level, driverName:', driverName);
  
  // Destroy existing overlay if any
  if (overlayInstance) {
    console.log('🔴 OverlayService: Destroying existing overlay');
    overlayInstance.destroy();
    overlayInstance = null;
  }

  // Create new root-level overlay
  overlayInstance = new RootSiblings(
    <PushNotificationOverlay
      visible={true}
      driverName={driverName}
      onClose={() => {
        console.log('🔴 OverlayService: Overlay closed, destroying root sibling');
        hidePushNotificationOverlay();
      }}
    />
  );

  console.log('🔴 OverlayService: Root-level overlay created');
  
  // Auto-close after 3 seconds
  setTimeout(() => {
    if (overlayInstance) {
      console.log('🔴 OverlayService: Auto-closing overlay after 3 seconds');
      hidePushNotificationOverlay();
    }
  }, 3000);
}

/**
 * Hide and destroy the push notification overlay
 */
export function hidePushNotificationOverlay() {
  console.log('🔴 OverlayService: Hiding overlay');
  if (overlayInstance) {
    overlayInstance.destroy();
    overlayInstance = null;
    console.log('🔴 OverlayService: Overlay destroyed');
  }
}


