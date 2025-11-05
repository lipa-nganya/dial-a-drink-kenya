import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

const OrderDetailScreen = ({ route, navigation }) => {
  const { order, driverId } = route.params;
  const [loading, setLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const { colors, isDarkMode } = useTheme();

  const formatCurrency = (amount) => {
    return `KES ${parseFloat(amount).toFixed(2)}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#FFA500';
      case 'confirmed': return '#00BFFF';
      case 'preparing': return '#9370DB';
      case 'out_for_delivery': return '#FFD700';
      case 'delivered': return '#32CD32';
      case 'completed': return '#00E0B8';
      default: return '#B0B0B0';
    }
  };

  const openGoogleMaps = () => {
    const address = encodeURIComponent(order.deliveryAddress);
    const url = `https://www.google.com/maps/dir/?api=1&destination=${address}`;
    
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Google Maps is not available on this device');
      }
    });
  };

  const callCustomer = () => {
    const phoneNumber = order.customerPhone.replace(/\D/g, '');
    const phoneUrl = `tel:${phoneNumber}`;
    
    Linking.canOpenURL(phoneUrl).then(supported => {
      if (supported) {
        Linking.openURL(phoneUrl);
      } else {
        Alert.alert('Error', 'Phone calling is not available on this device');
      }
    });
  };

  const handleInitiatePayment = async () => {
    Alert.alert(
      'Initiate Payment',
      `Send payment request to ${order.customerPhone}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            setLoading(true);
            try {
              const response = await api.post(`/driver-orders/${order.id}/initiate-payment`, {
                driverId: driverId,
                customerPhone: order.customerPhone
              });

              if (response.data.success) {
                Alert.alert(
                  'Success',
                  'Payment request has been sent to the customer. They will receive an M-Pesa prompt.',
                  [{ text: 'OK' }]
                );
              } else {
                Alert.alert('Error', response.data.error || 'Failed to initiate payment');
              }
            } catch (error) {
              console.error('Payment initiation error:', error);
              Alert.alert(
                'Error',
                error.response?.data?.error || 'Failed to initiate payment. Please try again.'
              );
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleStatusUpdate = async (newStatus) => {
    const statusLabels = {
      'preparing': 'Preparing',
      'out_for_delivery': 'On the Way',
      'delivered': 'Delivered'
    };

    Alert.alert(
      'Update Status',
      `Mark order as ${statusLabels[newStatus]}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setUpdatingStatus(true);
            try {
              const response = await api.patch(`/driver-orders/${order.id}/status`, {
                status: newStatus,
                driverId: driverId,
                oldStatus: order.status
              });

              if (response.data) {
                Alert.alert('Success', `Order status updated to ${statusLabels[newStatus]}`);
                navigation.goBack();
              }
            } catch (error) {
              console.error('Status update error:', error);
              Alert.alert(
                'Error',
                error.response?.data?.error || 'Failed to update status. Please try again.'
              );
            } finally {
              setUpdatingStatus(false);
            }
          }
        }
      ]
    );
  };

  const canUpdateToPreparing = order.status === 'confirmed' || order.status === 'pending';
  const canUpdateToOnTheWay = order.status === 'preparing' || order.status === 'confirmed';
  const canUpdateToDelivered = order.status === 'out_for_delivery' || order.status === 'preparing';
  const canInitiatePayment = order.paymentType === 'pay_on_delivery' && order.paymentStatus !== 'paid';

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {/* Order Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.orderId, { color: colors.accentText }]}>Order #{order.id}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
            <Text style={styles.statusText}>{order.status.replace('_', ' ').toUpperCase()}</Text>
          </View>
        </View>

        {/* Customer Info */}
        <View style={[styles.section, { backgroundColor: colors.paper }]}>
          <Text style={[styles.sectionTitle, { color: colors.accentText }]}>Customer Information</Text>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Name:</Text>
            <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{order.customerName}</Text>
          </View>
          <TouchableOpacity style={styles.infoRow} onPress={callCustomer}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Phone:</Text>
            <Text style={[styles.infoValue, styles.link, { color: colors.accentText }]}>{order.customerPhone}</Text>
          </TouchableOpacity>
          {order.customerEmail && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Email:</Text>
              <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{order.customerEmail}</Text>
            </View>
          )}
        </View>

        {/* Delivery Address */}
        <View style={[styles.section, { backgroundColor: colors.paper }]}>
          <Text style={[styles.sectionTitle, { color: colors.accentText }]}>Delivery Address</Text>
          <Text style={[styles.address, { color: colors.textPrimary }]}>{order.deliveryAddress}</Text>
          <TouchableOpacity style={[styles.mapButton, { backgroundColor: colors.accent }]} onPress={openGoogleMaps}>
            <Text style={[styles.mapButtonText, { color: isDarkMode ? '#0D0D0D' : colors.textPrimary }]}>📍 Open in Google Maps</Text>
          </TouchableOpacity>
        </View>

        {/* Order Items */}
        <View style={[styles.section, { backgroundColor: colors.paper }]}>
          <Text style={[styles.sectionTitle, { color: colors.accentText }]}>Order Items</Text>
          {order.orderItems && order.orderItems.map((item, index) => (
            <View key={index} style={[styles.itemRow, { borderBottomColor: colors.border }]}>
              <View style={styles.itemInfo}>
                <Text style={[styles.itemName, { color: colors.textPrimary }]}>
                  {item.drink?.name || `Item #${item.drinkId}`}
                </Text>
                <Text style={[styles.itemQuantity, { color: colors.textSecondary }]}>Qty: {item.quantity}</Text>
              </View>
              <Text style={[styles.itemPrice, { color: colors.accentText }]}>
                {formatCurrency(item.price * item.quantity)}
              </Text>
            </View>
          ))}
          <View style={[styles.totalRow, { borderTopColor: colors.accentText }]}>
            <Text style={[styles.totalLabel, { color: colors.textPrimary }]}>Total Amount:</Text>
            <Text style={[styles.totalAmount, { color: colors.accentText }]}>{formatCurrency(order.totalAmount)}</Text>
          </View>
        </View>

        {/* Payment Info */}
        <View style={[styles.section, { backgroundColor: colors.paper }]}>
          <Text style={[styles.sectionTitle, { color: colors.accentText }]}>Payment</Text>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Type:</Text>
            <Text style={[styles.infoValue, { color: colors.textPrimary }]}>
              {order.paymentType === 'pay_now' ? 'Pay Now' : 'Pay on Delivery'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Status:</Text>
            <Text style={[styles.infoValue, { color: order.paymentStatus === 'paid' ? '#32CD32' : '#FFA500' }]}>
              {order.paymentStatus.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Order Details */}
        <View style={[styles.section, { backgroundColor: colors.paper }]}>
          <Text style={[styles.sectionTitle, { color: colors.accentText }]}>Order Details</Text>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Date:</Text>
            <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{formatDate(order.createdAt)}</Text>
          </View>
          {order.notes && (
            <View style={styles.notesContainer}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Notes:</Text>
              <Text style={[styles.notes, { color: colors.textPrimary }]}>{order.notes}</Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          {canInitiatePayment && (
            <TouchableOpacity
              style={[styles.actionButton, styles.paymentButton]}
              onPress={handleInitiatePayment}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#0D0D0D" />
              ) : (
                <Text style={styles.actionButtonText}>💳 Request Payment</Text>
              )}
            </TouchableOpacity>
          )}

          {canUpdateToPreparing && (
            <TouchableOpacity
              style={[styles.actionButton, styles.statusButton]}
              onPress={() => handleStatusUpdate('preparing')}
              disabled={updatingStatus}
            >
              <Text style={styles.actionButtonText}>🍽️ Start Preparing</Text>
            </TouchableOpacity>
          )}

          {canUpdateToOnTheWay && (
            <TouchableOpacity
              style={[styles.actionButton, styles.statusButton]}
              onPress={() => handleStatusUpdate('out_for_delivery')}
              disabled={updatingStatus}
            >
              <Text style={styles.actionButtonText}>🚗 Mark On The Way</Text>
            </TouchableOpacity>
          )}

          {canUpdateToDelivered && (
            <TouchableOpacity
              style={[styles.actionButton, styles.deliveredButton]}
              onPress={() => handleStatusUpdate('delivered')}
              disabled={updatingStatus}
            >
              <Text style={styles.actionButtonText}>✅ Mark Delivered</Text>
            </TouchableOpacity>
          )}
        </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  orderId: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00E0B8',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: '#0D0D0D',
    fontSize: 12,
    fontWeight: 'bold',
  },
  section: {
    backgroundColor: '#121212',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00E0B8',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#B0B0B0',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: '#F5F5F5',
    fontWeight: '600',
    flex: 2,
    textAlign: 'right',
  },
  link: {
    color: '#00E0B8',
    textDecorationLine: 'underline',
  },
  address: {
    fontSize: 14,
    color: '#F5F5F5',
    marginBottom: 10,
    lineHeight: 20,
  },
  mapButton: {
    backgroundColor: '#00E0B8',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  mapButtonText: {
    color: '#0D0D0D',
    fontSize: 16,
    fontWeight: 'bold',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    color: '#F5F5F5',
    fontWeight: '600',
  },
  itemQuantity: {
    fontSize: 14,
    color: '#B0B0B0',
    marginTop: 4,
  },
  itemPrice: {
    fontSize: 16,
    color: '#00E0B8',
    fontWeight: 'bold',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 2,
    borderTopColor: '#00E0B8',
  },
  totalLabel: {
    fontSize: 18,
    color: '#F5F5F5',
    fontWeight: 'bold',
  },
  totalAmount: {
    fontSize: 20,
    color: '#00E0B8',
    fontWeight: 'bold',
  },
  notesContainer: {
    marginTop: 8,
  },
  notes: {
    fontSize: 14,
    color: '#F5F5F5',
    marginTop: 4,
    fontStyle: 'italic',
  },
  actions: {
    marginTop: 20,
    marginBottom: 30,
  },
  actionButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  paymentButton: {
    backgroundColor: '#FFD700',
  },
  statusButton: {
    backgroundColor: '#00BFFF',
  },
  deliveredButton: {
    backgroundColor: '#32CD32',
  },
  actionButtonText: {
    color: '#0D0D0D',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default OrderDetailScreen;





