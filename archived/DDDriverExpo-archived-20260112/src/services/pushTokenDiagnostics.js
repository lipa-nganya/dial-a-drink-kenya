/**
 * Comprehensive Push Token Diagnostics
 * This helps diagnose why push tokens aren't being generated
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import api from './api';

/**
 * Run comprehensive diagnostics and send results to backend
 */
export async function runPushTokenDiagnostics(driverId) {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    driverId: driverId,
    platform: Platform.OS,
    results: {}
  };

  console.log('🔍 ===== PUSH TOKEN DIAGNOSTICS START =====');

  // Test 1: Check notification permissions
  try {
    const { status } = await Notifications.getPermissionsAsync();
    diagnostics.results.permissions = {
      status: status,
      granted: status === 'granted',
      error: null
    };
    console.log('✅ Test 1 - Permissions:', status);
  } catch (error) {
    diagnostics.results.permissions = {
      status: 'error',
      granted: false,
      error: error.message
    };
    console.error('❌ Test 1 - Permissions error:', error.message);
  }

  // Test 2: Check build type detection
  try {
    const appOwnership = Constants?.appOwnership || 'unknown';
    const executionEnvironment = Constants?.executionEnvironment || 'unknown';
    const isStandalone = appOwnership === 'standalone' || 
                        executionEnvironment === 'standalone' ||
                        (!__DEV__ && executionEnvironment !== 'storeClient');
    
    diagnostics.results.buildType = {
      appOwnership: appOwnership,
      executionEnvironment: executionEnvironment,
      isStandalone: isStandalone,
      __DEV__: __DEV__,
      error: null
    };
    console.log('✅ Test 2 - Build type:', { appOwnership, executionEnvironment, isStandalone });
  } catch (error) {
    diagnostics.results.buildType = {
      error: error.message
    };
    console.error('❌ Test 2 - Build type error:', error.message);
  }

  // Test 3: Check if google-services.json is accessible (Android only)
  if (Platform.OS === 'android') {
    try {
      // Try to access Firebase configuration
      // This will fail if google-services.json wasn't processed
      const hasGoogleServices = Constants?.expoConfig?.android?.googleServicesFile !== undefined;
      diagnostics.results.googleServices = {
        configured: hasGoogleServices,
        path: Constants?.expoConfig?.android?.googleServicesFile || 'not set',
        error: null
      };
      console.log('✅ Test 3 - Google Services:', hasGoogleServices);
    } catch (error) {
      diagnostics.results.googleServices = {
        configured: false,
        error: error.message
      };
      console.error('❌ Test 3 - Google Services error:', error.message);
    }
  }

  // Test 4: Try to get native device token
  if (Platform.OS === 'android' && diagnostics.results.buildType?.isStandalone) {
    try {
      console.log('🔍 Test 4 - Attempting to get native FCM token...');
      // CRITICAL: getDevicePushTokenAsync() does NOT accept projectId for native FCM
      const deviceToken = await Notifications.getDevicePushTokenAsync();
      
      diagnostics.results.nativeToken = {
        success: true,
        hasToken: !!deviceToken?.data,
        tokenLength: deviceToken?.data?.length || 0,
        tokenType: deviceToken?.type || 'unknown',
        tokenPreview: deviceToken?.data?.substring(0, 50) || 'N/A',
        error: null
      };
      console.log('✅ Test 4 - Native token obtained!');
    } catch (error) {
      diagnostics.results.nativeToken = {
        success: false,
        hasToken: false,
        error: error.message,
        errorCode: error.code,
        errorName: error.name,
        errorStack: error.stack?.substring(0, 500) || 'N/A'
      };
      console.error('❌ Test 4 - Native token failed:', error.message);
      console.error('❌ Error code:', error.code);
      console.error('❌ Error name:', error.name);
    }
  }

  // Test 5: Try to get Expo push token (fallback)
  try {
    console.log('🔍 Test 5 - Attempting to get Expo push token...');
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId || 
                      Constants?.manifest?.extra?.eas?.projectId ||
                      'd016afe9-031a-42ca-b832-94c00c800600';
    
    const expoToken = await Notifications.getExpoPushTokenAsync({
      projectId: projectId,
    });
    
    diagnostics.results.expoToken = {
      success: true,
      hasToken: !!expoToken?.data,
      tokenLength: expoToken?.data?.length || 0,
      tokenPreview: expoToken?.data?.substring(0, 50) || 'N/A',
      error: null
    };
    console.log('✅ Test 5 - Expo token obtained!');
  } catch (error) {
    diagnostics.results.expoToken = {
      success: false,
      hasToken: false,
      error: error.message,
      errorCode: error.code,
      errorName: error.name
    };
    console.error('❌ Test 5 - Expo token failed:', error.message);
  }

  // Test 6: Check API connectivity
  try {
    const testResponse = await api.get(`/drivers/phone/254712674333`);
    diagnostics.results.apiConnectivity = {
      success: true,
      canReachBackend: true,
      error: null
    };
    console.log('✅ Test 6 - API connectivity OK');
  } catch (error) {
    diagnostics.results.apiConnectivity = {
      success: false,
      canReachBackend: false,
      error: error.message,
      status: error.response?.status
    };
    console.error('❌ Test 6 - API connectivity failed:', error.message);
  }

  // Send diagnostics to backend
  try {
    console.log('📤 Sending diagnostics to backend...');
    await api.post('/drivers/push-token-diagnostics', {
      driverId: driverId,
      diagnostics: diagnostics
    });
    console.log('✅ Diagnostics sent to backend');
  } catch (error) {
    console.error('❌ Failed to send diagnostics:', error.message);
  }

  console.log('🔍 ===== PUSH TOKEN DIAGNOSTICS COMPLETE =====');
  console.log('📋 Full diagnostics:', JSON.stringify(diagnostics, null, 2));

  return diagnostics;
}

