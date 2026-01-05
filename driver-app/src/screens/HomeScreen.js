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
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import io from 'socket.io-client';
import api from '../services/api';

const HomeScreen = ({ route, navigation }) => {
  const { phoneNumber } = route.params || {};
  const [driverInfo, setDriverInfo] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newOrderAlert, setNewOrderAlert] = useState(null);
  const socketRef = useRef(null);

  // Get socket URL from API base URL
  const getSocketUrl = () => {
    const apiBaseUrl = api.defaults.baseURL;
    // Remove /api from the end if present
    return apiBaseUrl.replace(/\/api$/, '');
  };

  useEffect(() => {
    loadDriverData();
  }, []);

  // Set up Socket.IO connection when driver info is loaded
  useEffect(() => {
    if (driverInfo && driverInfo.id) {
      const socketUrl = getSocketUrl();
      console.log('🔌 Connecting to socket:', socketUrl);
      
      const socket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
      });

      socket.on('connect', () => {
        console.log('✅ Socket connected');
        // Join driver room
        socket.emit('join-driver', driverInfo.id);
        console.log(`✅ Joined driver room: driver-${driverInfo.id}`);
      });

      socket.on('disconnect', () => {
        console.log('❌ Socket disconnected');
      });

      socket.on('connect_error', (error) => {
        console.error('❌ Socket connection error:', error);
      });

      // Listen for new order assignment
      socket.on('order-assigned', (data) => {
        console.log('📦 New order assigned:', data);
        if (data.order) {
          setNewOrderAlert(data.order);
          // Reload orders to show the new one
          loadDriverData();
        }
      });

      // Listen for order updates
      socket.on('order-status-updated', (data) => {
        console.log('📦 Order status updated:', data);
        // Reload orders to get updated status
        loadDriverData();
      });

      socketRef.current = socket;

      return () => {
        console.log('🔌 Disconnecting socket');
        socket.disconnect();
      };
    }
  }, [driverInfo]);

  const loadDriverData = async () => {
    try {
      const phone = phoneNumber || await AsyncStorage.getItem('driver_phone');
      if (phone) {
        // Load driver info to get driver ID
        const driverResponse = await api.get(`/drivers/phone/${phone}`);
        if (driverResponse.data) {
          setDriverInfo(driverResponse.data);
          
          // Load orders assigned to this driver
          if (driverResponse.data.id) {
            try {
              const ordersResponse = await api.get(`/driver-orders/${driverResponse.data.id}`);
              setOrders(ordersResponse.data || []);
            } catch (error) {
              console.error('Error loading orders:', error);
              setOrders([]);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading driver info:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDriverData();
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
            // Clear all stored data
            await AsyncStorage.removeItem('driver_logged_in');
            await AsyncStorage.removeItem('driver_phone');
            await AsyncStorage.removeItem('driver_pin');
            navigation.replace('PhoneNumber');
          },
        },
      ]
    );
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

  const handleCloseAlert = () => {
    setNewOrderAlert(null);
  };

  const handleViewOrder = () => {
    setNewOrderAlert(null);
    // Scroll to the order or refresh to show it
    loadDriverData();
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#00E0B8" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <>
      {/* New Order Alert Modal */}
      <Modal
        visible={newOrderAlert !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseAlert}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.alertCard}>
            <Text style={styles.alertTitle}>🎉 NEW ORDER ASSIGNED</Text>
            {newOrderAlert && (
              <>
                <Text style={styles.alertOrderNumber}>Order #{newOrderAlert.id}</Text>
                <View style={styles.alertDetails}>
                  <Text style={styles.alertDetailText}>
                    <Text style={styles.alertDetailLabel}>Customer: </Text>
                    {newOrderAlert.customerName}
                  </Text>
                  <Text style={styles.alertDetailText}>
                    <Text style={styles.alertDetailLabel}>Address: </Text>
                    {newOrderAlert.deliveryAddress}
                  </Text>
                  <Text style={styles.alertDetailText}>
                    <Text style={styles.alertDetailLabel}>Amount: </Text>
                    <Text style={styles.alertAmountText}>KES {parseFloat(newOrderAlert.totalAmount || 0).toFixed(2)}</Text>
                  </Text>
                  <Text style={styles.alertDetailText}>
                    <Text style={styles.alertDetailLabel}>Payment: </Text>
                    {newOrderAlert.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
                  </Text>
                </View>
                <View style={styles.alertButtons}>
                  <TouchableOpacity 
                    style={[styles.alertButton, styles.alertButtonSecondary]} 
                    onPress={handleCloseAlert}
                  >
                    <Text style={styles.alertButtonTextSecondary}>Close</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.alertButton, styles.alertButtonPrimary]} 
                    onPress={handleViewOrder}
                  >
                    <Text style={styles.alertButtonTextPrimary}>View Order</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <ScrollView 
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00E0B8" />
        }
      >
        <View style={styles.content}>
        <Text style={styles.title}>Driver Dashboard</Text>
        
        {driverInfo && (
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Name:</Text>
            <Text style={styles.infoValue}>{driverInfo.name}</Text>
            
            <Text style={styles.infoLabel}>Phone:</Text>
            <Text style={styles.infoValue}>{driverInfo.phoneNumber}</Text>
            
            <Text style={styles.infoLabel}>Status:</Text>
            <Text style={[styles.infoValue, styles.status]}>
              {driverInfo.status || 'offline'}
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>My Orders</Text>

        {orders.length === 0 ? (
          <View style={styles.noOrdersCard}>
            <Text style={styles.noOrdersText}>No orders assigned to you yet</Text>
          </View>
        ) : (
          orders.map((order) => (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <Text style={styles.orderNumber}>Order #{order.id}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
                  <Text style={styles.statusText}>{order.status.replace('_', ' ').toUpperCase()}</Text>
                </View>
              </View>
              
              <View style={styles.orderDetails}>
                <Text style={styles.orderDetailText}>
                  <Text style={styles.orderDetailLabel}>Customer: </Text>
                  {order.customerName}
                </Text>
                <Text style={styles.orderDetailText}>
                  <Text style={styles.orderDetailLabel}>Phone: </Text>
                  {order.customerPhone}
                </Text>
                <Text style={styles.orderDetailText}>
                  <Text style={styles.orderDetailLabel}>Address: </Text>
                  {order.deliveryAddress}
                </Text>
                <Text style={styles.orderDetailText}>
                  <Text style={styles.orderDetailLabel}>Amount: </Text>
                  <Text style={styles.amountText}>KES {parseFloat(order.totalAmount).toFixed(2)}</Text>
                </Text>
                <Text style={styles.orderDetailText}>
                  <Text style={styles.orderDetailLabel}>Payment: </Text>
                  {order.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
                </Text>
                <Text style={styles.orderDetailText}>
                  <Text style={styles.orderDetailLabel}>Date: </Text>
                  {formatDate(order.createdAt)}
                </Text>
                {order.notes && (
                  <Text style={styles.orderDetailText}>
                    <Text style={styles.orderDetailLabel}>Notes: </Text>
                    {order.notes}
                  </Text>
                )}
              </View>

              {order.orderItems && order.orderItems.length > 0 && (
                <View style={styles.orderItems}>
                  <Text style={styles.orderItemsTitle}>Items:</Text>
                  {order.orderItems.map((item, index) => (
                    <Text key={index} style={styles.orderItemText}>
                      • {item.quantity}x {item.drink?.name || 'Unknown'} - KES {parseFloat(item.price || 0).toFixed(2)} each
                    </Text>
                  ))}
                </View>
              )}
            </View>
          ))
        )}

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
    </>
  );
};

const styles = StyleSheet.create({
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
  loadingText: {
    color: '#B0B0B0',
    marginTop: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#00E0B8',
    marginBottom: 30,
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: '#121212',
    padding: 20,
    borderRadius: 8,
    marginBottom: 30,
  },
  infoLabel: {
    fontSize: 14,
    color: '#B0B0B0',
    marginTop: 10,
    marginBottom: 5,
  },
  infoValue: {
    fontSize: 18,
    color: '#F5F5F5',
    fontWeight: '600',
  },
  status: {
    color: '#00E0B8',
    textTransform: 'capitalize',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#00E0B8',
    marginBottom: 15,
  },
  noOrdersCard: {
    backgroundColor: '#121212',
    padding: 30,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  noOrdersText: {
    fontSize: 16,
    color: '#B0B0B0',
    textAlign: 'center',
  },
  orderCard: {
    backgroundColor: '#121212',
    padding: 20,
    borderRadius: 8,
    marginBottom: 15,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00E0B8',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: '#F5F5F5',
    fontSize: 12,
    fontWeight: 'bold',
  },
  orderDetails: {
    marginBottom: 10,
  },
  orderDetailText: {
    fontSize: 14,
    color: '#F5F5F5',
    marginBottom: 8,
    lineHeight: 20,
  },
  orderDetailLabel: {
    color: '#B0B0B0',
    fontWeight: '600',
  },
  amountText: {
    color: '#00E0B8',
    fontWeight: 'bold',
  },
  orderItems: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  orderItemsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#00E0B8',
    marginBottom: 8,
  },
  orderItemText: {
    fontSize: 14,
    color: '#B0B0B0',
    marginBottom: 5,
  },
  logoutButton: {
    backgroundColor: '#FF3366',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  logoutText: {
    color: '#F5F5F5',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  alertCard: {
    backgroundColor: '#121212',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 2,
    borderColor: '#00E0B8',
    shadowColor: '#00E0B8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  alertTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00E0B8',
    textAlign: 'center',
    marginBottom: 16,
  },
  alertOrderNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F5F5F5',
    textAlign: 'center',
    marginBottom: 20,
  },
  alertDetails: {
    marginBottom: 24,
  },
  alertDetailText: {
    fontSize: 16,
    color: '#F5F5F5',
    marginBottom: 12,
    lineHeight: 22,
  },
  alertDetailLabel: {
    color: '#B0B0B0',
    fontWeight: '600',
  },
  alertAmountText: {
    color: '#00E0B8',
    fontWeight: 'bold',
  },
  alertButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  alertButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  alertButtonPrimary: {
    backgroundColor: '#00E0B8',
  },
  alertButtonSecondary: {
    backgroundColor: '#333',
    borderWidth: 1,
    borderColor: '#00E0B8',
  },
  alertButtonTextPrimary: {
    color: '#0D0D0D',
    fontSize: 16,
    fontWeight: 'bold',
  },
  alertButtonTextSecondary: {
    color: '#00E0B8',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default HomeScreen;





