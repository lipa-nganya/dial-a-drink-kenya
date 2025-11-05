import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
  AppState,
  Vibration,
  Linking,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import io from 'socket.io-client';
import * as Updates from 'expo-updates';
import api from '../services/api';
import { registerForPushNotifications, scheduleOrderNotification } from '../services/notifications';
import { useTheme } from '../contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

const HomeScreen = ({ route, navigation }) => {
  const { phoneNumber } = route.params || {};
  const [driverInfo, setDriverInfo] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const socketRef = useRef(null);
  const appState = useRef(AppState.currentState);
  const { colors, isDarkMode } = useTheme();
  
  // Get phoneNumber from route params or AsyncStorage
  useEffect(() => {
    const getPhoneNumber = async () => {
      if (!phoneNumber) {
        const storedPhone = await AsyncStorage.getItem('driver_phone');
        if (storedPhone) {
          // Reload with phone number
          loadDriverData(storedPhone);
        }
      }
    };
    getPhoneNumber();
  }, []);

  useEffect(() => {
    loadDriverData();
  }, []);

  // Register for push notifications when driver info is available
  useEffect(() => {
    if (driverInfo?.id) {
      registerForPushNotifications(driverInfo.id);
    }
  }, [driverInfo?.id]);

  // Set up notification handlers
  useEffect(() => {
    // Handle notification received while app is in foreground
    const subscription = Notifications.addNotificationReceivedListener(notification => {
      console.log('📱 Notification received in foreground:', notification);
      const { data } = notification.request.content;
      
      if (data?.type === 'order-assigned' && data?.order) {
        // Navigate to OrderAcceptance screen
        handleOrderAssigned(data.order, true);
      }
    });

    // Handle notification tap (when user taps notification)
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('📱 Notification tapped:', response);
      const { data } = response.notification.request.content;
      
      if (data?.type === 'order-assigned' && data?.order) {
        // Navigate to OrderAcceptance screen
        handleOrderAssigned(data.order, true);
      }
    });

    return () => {
      subscription.remove();
      responseSubscription.remove();
    };
  }, [navigation, driverInfo?.id]);

  // Handle order assignment (from socket or notification)
  const handleOrderAssigned = async (order, playSound = true) => {
    console.log('🔴🔴🔴 HANDLING ORDER ASSIGNED 🔴🔴🔴');
    console.log('📦 Order:', order.id);
    console.log('📦 Driver ID:', driverInfo?.id);
    
    // Start vibration immediately
    try {
      Vibration.vibrate([500, 100, 500, 100, 500, 100], true);
      console.log('📳✅ Vibration started');
      
      const vibInterval = setInterval(() => {
        Vibration.vibrate([500, 100, 500, 100], true);
      }, 1000);
      
      socketRef.current.vibInterval = vibInterval;
      
      setTimeout(() => {
        if (socketRef.current.vibInterval) {
          clearInterval(socketRef.current.vibInterval);
          socketRef.current.vibInterval = null;
        }
      }, 30000);
    } catch (vibError) {
      console.error('❌ Vibration error:', vibError);
    }
    
    // Schedule a local notification to wake screen and bring app to foreground
    await scheduleOrderNotification(order);
    
    // Navigate to OrderAcceptance screen
    try {
      const parentNavigation = navigation.getParent();
      const phone = phoneNumber || await AsyncStorage.getItem('driver_phone');
      
      if (parentNavigation) {
        console.log('✅ Using parent navigator to navigate to OrderAcceptance');
        parentNavigation.navigate('OrderAcceptance', {
          order: order,
          driverId: driverInfo?.id,
          phoneNumber: phone,
          playSound: playSound
        });
      } else {
        console.log('⚠️ No parent navigator, trying direct navigation');
        navigation.navigate('OrderAcceptance', {
          order: order,
          driverId: driverInfo?.id,
          phoneNumber: phone,
          playSound: playSound
        });
      }
    } catch (navError) {
      console.error('❌ Navigation error:', navError);
      Alert.alert('New Order', `Order #${order.id} has been assigned to you. Please check your orders.`);
    }
  };

  // Set up Socket.IO connection when driver info is available
  useEffect(() => {
    if (!driverInfo?.id) return;
    
    // Set up Socket.IO connection - use same URL logic as API
    // Get base URL from API service
    const getSocketUrl = () => {
      // Extract base URL from API service
      // Match the API service URL logic exactly
      const apiBaseUrl = api.defaults.baseURL; // e.g., 'https://homiest-psychopharmacologic-anaya.ngrok-free.dev/api'
      // Remove '/api' suffix to get socket URL
      const socketUrl = apiBaseUrl.replace('/api', '').replace('/api/', '');
      console.log('🔌 Socket URL:', socketUrl);
      console.log('🔌 API Base URL:', apiBaseUrl);
      return socketUrl;
    };
    
    const socketUrl = getSocketUrl();
    
    console.log('🔌 Connecting to socket:', socketUrl);
    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000
    });
    
    socketRef.current = socket;
    
    socket.on('connect', () => {
      console.log('✅ Socket.IO connected successfully');
      console.log('✅ Socket ID:', socket.id);
      // Join driver room
      socket.emit('join-driver', driverInfo.id);
      console.log(`✅ Joined driver room: driver-${driverInfo.id}`);
    });
    
    socket.on('connect_error', (error) => {
      console.error('❌ Socket.IO connection error:', error);
      console.error('❌ Socket URL:', socketUrl);
    });
    
    socket.on('disconnect', (reason) => {
      console.log('❌ Socket.IO disconnected:', reason);
      console.log('🔄 Attempting to reconnect...');
    });
    
    socket.on('reconnect', (attemptNumber) => {
      console.log(`✅ Socket.IO reconnected after ${attemptNumber} attempts`);
      // Rejoin driver room after reconnection
      socket.emit('join-driver', driverInfo.id);
      console.log(`✅ Rejoined driver room: driver-${driverInfo.id}`);
    });
    
    socket.on('order-assigned', async (data) => {
      console.log('🔴🔴🔴 ORDER ASSIGNED EVENT RECEIVED 🔴🔴🔴');
      console.log('📦 Full event data:', JSON.stringify(data, null, 2));
      console.log('📦 Order ID:', data?.order?.id);
      console.log('📦 Driver ID in event:', driverInfo?.id);
      console.log('📦 PlaySound flag:', data?.playSound);
      
      if (data && data.order) {
        // Use the centralized handleOrderAssigned function
        await handleOrderAssigned(data.order, data.playSound !== false);
      } else {
        console.error('❌❌❌ NO ORDER DATA IN SOCKET EVENT ❌❌❌');
        console.error('❌ Data received:', data);
        console.error('❌ data.order:', data?.order);
      }
    });

    socket.on('driver-removed', async (data) => {
      console.log('📦 Order removed from driver queue:', data);
      
      // Schedule a push notification for order removal
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Order Removed',
            body: `Order #${data.orderId} has been removed from your queue`,
            data: {
              orderId: data.orderId,
              type: 'order-removed',
            },
            sound: 'default',
            priority: Notifications.AndroidNotificationPriority.HIGH,
          },
          trigger: null, // Show immediately
        });
        console.log('✅ Push notification scheduled for order removal');
      } catch (notifError) {
        console.error('❌ Error scheduling removal notification:', notifError);
      }
      
      // Show alert notification
      Alert.alert(
        'Order Removed',
        `Order #${data.orderId} removed from your queue`,
        [{ text: 'OK' }]
      );
      // Refresh orders list
      loadDriverData();
    });
    
    // Handle app state changes to reconnect socket
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to the foreground, reconnect socket
        if (socket && !socket.connected) {
          socket.connect();
        }
      }
      appState.current = nextAppState;
    });
    
    return () => {
      if (socket) {
        socket.disconnect();
      }
      subscription?.remove();
    };
  }, [driverInfo?.id]);

  const loadDriverData = async (phoneOverride = null) => {
    try {
      setLoading(true);
      const phone = phoneOverride || phoneNumber || await AsyncStorage.getItem('driver_phone');
      
      if (!phone) {
        console.error('No phone number found');
        setLoading(false);
        return;
      }

      console.log('Loading driver data for phone:', phone);
      
      // Load driver info to get driver ID (needed for socket connection)
      const driverResponse = await api.get(`/drivers/phone/${phone}`);
      
      if (driverResponse.data) {
        console.log('Driver info loaded:', driverResponse.data.id);
        setDriverInfo(driverResponse.data);
        
        // Load orders assigned to this driver (show accepted and pending acceptance)
        if (driverResponse.data.id) {
          try {
            const ordersResponse = await api.get(`/driver-orders/${driverResponse.data.id}`);
            // Filter to only show accepted orders (exclude rejected ones)
            const filteredOrders = (ordersResponse.data || []).filter(order => 
              order.driverAccepted !== false // Show accepted (true) or pending (null), hide rejected (false)
            );
            // Sort by oldest first (ascending by createdAt)
            filteredOrders.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            console.log('Orders loaded:', filteredOrders.length);
            setOrders(filteredOrders);
          } catch (error) {
            console.error('Error loading orders:', error);
            setOrders([]);
          }
        }
      }
    } catch (error) {
      console.error('Error loading driver info:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDriverData();
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

  const openGoogleMaps = (address) => {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;
    
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Google Maps is not available on this device');
      }
    }).catch(err => {
      console.error('Error opening Google Maps:', err);
      Alert.alert('Error', 'Could not open Google Maps');
    });
  };

  const openOrderDetails = (order) => {
    navigation.navigate('OrderDetail', {
      order: order,
      driverId: driverInfo?.id
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#FFA726';
      case 'confirmed': return '#42A5F5';
      case 'preparing': return '#AB47BC';
      case 'out_for_delivery': return '#66BB6A';
      case 'delivered': return '#26A69A';
      case 'completed': return '#00E0B8';
      case 'cancelled': return '#EF5350';
      default: return '#B0B0B0';
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading...</Text>
      </View>
    );
  }

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

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: safeColors.background }]}
      contentContainerStyle={{ paddingBottom: 80 }} // Add padding to account for bottom tab
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={safeColors.accent} />
      }
    >
      <View style={styles.content}>
        <View style={{ marginBottom: 15 }}>
          <Text style={[styles.sectionTitle, { color: safeColors.accentText }]}>Active Orders</Text>
        </View>

        {orders.length === 0 ? (
          <View style={[styles.noOrdersCard, { backgroundColor: safeColors.paper }]}>
            <Text style={[styles.noOrdersText, { color: safeColors.textSecondary }]}>No orders assigned to you yet</Text>
          </View>
        ) : (
          orders.map((order) => (
            <TouchableOpacity
              key={order.id}
              style={[styles.orderCard, { backgroundColor: safeColors.paper }]}
              onPress={() => openOrderDetails(order)}
              activeOpacity={0.7}
            >
              <View style={styles.orderCardHeader}>
                <View style={styles.orderCardLeft}>
                  <Text style={[styles.orderNumber, { color: safeColors.accentText }]}>Order #{order.id}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
                    <Text style={styles.statusText}>{order.status.replace('_', ' ').toUpperCase()}</Text>
                  </View>
                </View>
                <View style={styles.orderCardActions}>
                  <TouchableOpacity
                    style={[styles.actionIcon, { backgroundColor: safeColors.accent, marginRight: 8 }]}
                    onPress={(e) => {
                      e.stopPropagation();
                      openGoogleMaps(order.deliveryAddress);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="navigate" size={20} color={isDarkMode ? '#0D0D0D' : safeColors.textPrimary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionIcon, { backgroundColor: safeColors.accentText }]}
                    onPress={(e) => {
                      e.stopPropagation();
                      openOrderDetails(order);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="eye" size={20} color={isDarkMode ? '#0D0D0D' : safeColors.textPrimary} />
                  </TouchableOpacity>
                </View>
              </View>
              
              <View style={styles.orderCardBody}>
                <Text style={[styles.orderCardDetail, { color: safeColors.textPrimary, marginBottom: 6 }]} numberOfLines={1}>
                  <Text style={[styles.orderCardLabel, { color: safeColors.textSecondary }]}>Customer: </Text>
                  {order.customerName}
                </Text>
                <Text style={[styles.orderCardDetail, { color: safeColors.textPrimary, marginBottom: 6 }]} numberOfLines={1}>
                  <Text style={[styles.orderCardLabel, { color: safeColors.textSecondary }]}>Address: </Text>
                  {order.deliveryAddress}
                </Text>
                <View style={styles.orderCardFooter}>
                  <Text style={[styles.orderCardAmount, { color: safeColors.accentText }]}>
                    KES {parseFloat(order.totalAmount).toFixed(2)}
                  </Text>
                  <Text style={[styles.orderCardDate, { color: safeColors.textSecondary }]}>
                    {formatDate(order.createdAt)}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
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
    textAlign: 'center',
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
  status: {
    textTransform: 'capitalize',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  noOrdersCard: {
    padding: 30,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  noOrdersText: {
    fontSize: 16,
    textAlign: 'center',
  },
  orderCard: {
    padding: 15,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 10,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#F5F5F5',
    fontSize: 10,
    fontWeight: 'bold',
  },
  orderCardActions: {
    flexDirection: 'row',
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderCardBody: {
  },
  orderCardDetail: {
    fontSize: 13,
    lineHeight: 18,
  },
  orderCardLabel: {
    fontWeight: '600',
  },
  orderCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
  },
  orderCardAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  orderCardDate: {
    fontSize: 11,
  },
  logoutButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  logoutText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default HomeScreen;





