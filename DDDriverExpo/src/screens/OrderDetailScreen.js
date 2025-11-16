import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import io from 'socket.io-client';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import Snackbar from '../components/Snackbar';

const sanitizeNotesForDriver = (notes) => {
  if (!notes) {
    return '';
  }

  const removalPatterns = [
    /checkoutrequestid/i,
    /merchantrequestid/i,
    /m-?pesa/i,
    /transaction\s*(id)?/i,
    /payment confirmed/i,
    /^tip\b/i,
    /^delivery\s*fee/i,
    /tip \(kes/i,
    /tip amount/i,
    /driver will (only )?be notified/i,
  ];

  const filtered = notes
    .split('\n')
    .filter((line) => {
      if (!line) {
        return false;
      }
      const trimmed = line.trim();
      return !removalPatterns.some((pattern) => pattern.test(trimmed));
    })
    .join('\n')
    .trim();

  return filtered;
};

const OrderDetailScreen = ({ route, navigation }) => {
  const { order: initialOrder, driverId } = route.params;
  const [currentOrder, setCurrentOrder] = useState(initialOrder);
  const [loading, setLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarType, setSnackbarType] = useState('info');
  const [paymentPhone, setPaymentPhone] = useState(initialOrder?.customerPhone || '');
  const [confirmingCash, setConfirmingCash] = useState(false);
  const socketRef = useRef(null);
  const { colors, isDarkMode } = useTheme();

  const normalizedStatus = (currentOrder?.status || '').toLowerCase();
  const isCompletedOrCancelled = normalizedStatus === 'completed' || normalizedStatus === 'cancelled';
  const isActiveOrder = !isCompletedOrCancelled;
  const isPayOnDelivery = currentOrder.paymentType === 'pay_on_delivery';
  const isPaymentPaid = (currentOrder.paymentStatus || '').toLowerCase() === 'paid';
  const isOnTheWay = normalizedStatus === 'out_for_delivery';

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

  const formatDateTimeToSecond = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  // Update payment phone when order changes (prepopulate with customer phone)
  useEffect(() => {
    if (currentOrder?.customerPhone) {
      setPaymentPhone(currentOrder.customerPhone);
    }
  }, [currentOrder?.id]); // Reset when order ID changes

  // Set up socket connection for real-time order status updates
  useEffect(() => {
    const getSocketUrl = () => {
      const apiBaseUrl = api.defaults.baseURL;
      const socketUrl = apiBaseUrl.replace('/api', '').replace('/api/', '');
      return socketUrl;
    };

    const socketUrl = getSocketUrl();
    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
    });

    socketRef.current = socket;

    // Join order room to receive status updates
    socket.emit('join-order', currentOrder.id);

    // Listen for order status updates
    socket.on('order-status-updated', (data) => {
      if (data.orderId === currentOrder.id) {
        console.log('📦 Order status updated via socket:', data);
        console.log(`   Status: ${currentOrder.status} → ${data.status}`);
        console.log(`   Payment Status: ${currentOrder.paymentStatus} → ${data.paymentStatus}`);
        
        // Merge order object if provided, otherwise just update status fields
        setCurrentOrder(prev => {
          const updatedOrder = data.order 
            ? { ...prev, ...data.order, status: data.status, paymentStatus: data.paymentStatus }
            : { ...prev, status: data.status, paymentStatus: data.paymentStatus };
          
          // Show snackbar notification for status change
          if (data.status !== prev.status) {
            setSnackbarMessage(`Order status updated to: ${data.status.replace('_', ' ').toUpperCase()}`);
            setSnackbarType('info');
            setSnackbarVisible(true);
          }
          
          return updatedOrder;
        });
        
        // Notify HomeScreen to update its order list
        navigation.setParams({
          orderUpdated: true,
          updatedOrder: { ...currentOrder, status: data.status, paymentStatus: data.paymentStatus, ...(data.order || {}) }
        });
        
        console.log('✅ Order details updated without refresh');
      }
    });

    // Listen for payment confirmation
    socket.on('payment-confirmed', (data) => {
      if (data.orderId === currentOrder.id) {
        console.log('💰 Payment confirmed via socket:', data);
        console.log(`   Status: ${currentOrder.status} → ${data.status || 'confirmed'}`);
        console.log(`   Payment Status: ${currentOrder.paymentStatus} → paid`);
        
        // Merge order object if provided, otherwise just update status fields
        setCurrentOrder(prev => {
          const updatedOrder = data.order 
            ? { ...prev, ...data.order, status: data.status || 'confirmed', paymentStatus: 'paid', paymentConfirmedAt: data.paymentConfirmedAt || new Date().toISOString() }
            : { ...prev, status: data.status || 'confirmed', paymentStatus: 'paid', paymentConfirmedAt: data.paymentConfirmedAt || new Date().toISOString() };
          return updatedOrder;
        });
        
        setSnackbarMessage(`Payment confirmed! Receipt: ${data.receiptNumber || 'N/A'}`);
        setSnackbarType('success');
        setSnackbarVisible(true);
        
        // Notify HomeScreen to update its order list
        navigation.setParams({
          orderUpdated: true,
          updatedOrder: { ...currentOrder, paymentStatus: 'paid', status: data.status || 'confirmed', paymentConfirmedAt: data.paymentConfirmedAt || new Date().toISOString(), ...(data.order || {}) }
        });
        
        console.log('✅ Payment status updated on order details');
      }
    });

    // Listen for payment failures
    socket.on('payment-failed', (data) => {
      if (data.orderId === currentOrder.id) {
        console.log('❌ Payment failed via socket:', data);
        let message = data.errorMessage || 'Payment failed';
        
        if (data.errorType === 'wrong_pin') {
          message = 'Customer entered incorrect PIN. Payment failed.';
        } else if (data.errorType === 'insufficient_balance') {
          message = 'Customer has insufficient balance. Payment failed.';
        } else if (data.errorType === 'timeout') {
          message = 'Payment request timed out. Customer did not complete payment.';
        }
        
        setSnackbarMessage(message);
        setSnackbarType('error');
        setSnackbarVisible(true);
        
        // Update order status
        setCurrentOrder(prev => ({
          ...prev,
          paymentStatus: 'unpaid'
        }));
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [currentOrder.id]);

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

  const openGoogleMaps = async () => {
    const address = encodeURIComponent(currentOrder.deliveryAddress);
    const url = `https://www.google.com/maps/dir/?api=1&destination=${address}`;
    const geoUrl = `geo:0,0?q=${address}`;
    
    try {
      // On Android, canOpenURL can be unreliable for HTTPS URLs
      // Try opening directly first, with fallback to geo: scheme
      if (Platform.OS === 'android') {
        try {
          await Linking.openURL(url);
        } catch (androidError) {
          // Fallback to geo: scheme if HTTPS URL fails
          try {
            await Linking.openURL(geoUrl);
          } catch (geoError) {
            console.error('Error opening Google Maps:', geoError);
            setSnackbarMessage('Could not open Google Maps');
            setSnackbarType('error');
            setSnackbarVisible(true);
          }
        }
      } else {
        // On iOS, check first then open
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
        } else {
          setSnackbarMessage('Google Maps is not available on this device');
          setSnackbarType('error');
          setSnackbarVisible(true);
        }
      }
    } catch (err) {
      console.error('Error opening Google Maps:', err);
      setSnackbarMessage('Could not open Google Maps');
      setSnackbarType('error');
      setSnackbarVisible(true);
    }
  };

  const callCustomer = () => {
    const phoneNumber = currentOrder.customerPhone.replace(/\D/g, '');
    const phoneUrl = `tel:${phoneNumber}`;
    
    Linking.canOpenURL(phoneUrl).then(supported => {
      if (supported) {
        Linking.openURL(phoneUrl);
      } else {
        setSnackbarMessage('Phone calling is not available on this device');
        setSnackbarType('error');
        setSnackbarVisible(true);
      }
    });
  };

  const handleInitiatePayment = async () => {
    if (!paymentPhone || paymentPhone.trim().length < 9) {
      setSnackbarMessage('Please enter a valid phone number');
      setSnackbarType('error');
      setSnackbarVisible(true);
      return;
    }

    setLoading(true);
    try {
      const response = await api.post(`/driver-orders/${currentOrder.id}/initiate-payment`, {
        driverId: driverId,
        customerPhone: paymentPhone
      });

      if (response.data.success) {
        // Payment request was sent successfully - show success message
        // The actual payment status will be updated via socket events when callback arrives
        setSnackbarMessage('Payment request sent to customer. Waiting for payment confirmation...');
        setSnackbarType('success');
        setSnackbarVisible(true);
        
        // Payment status will be updated automatically via socket events:
        // - payment-confirmed: when customer pays successfully
        // - payment-failed: when customer enters wrong PIN, has insufficient balance, or times out
      } else {
        setSnackbarMessage(response.data.error || 'Failed to initiate payment request');
        setSnackbarType('error');
        setSnackbarVisible(true);
      }
    } catch (error) {
      console.error('Payment initiation error:', error);
      // Only show error if it's a real failure (network error, invalid credentials, etc.)
      // Not if it's just waiting for customer to enter PIN
      const errorMessage = error.response?.data?.error || 'Failed to initiate payment request. Please try again.';
      setSnackbarMessage(errorMessage);
      setSnackbarType('error');
      setSnackbarVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCashPayment = async (method) => {
    setConfirmingCash(true);
    try {
      const response = await api.post(`/driver-orders/${currentOrder.id}/confirm-cash-payment`, {
        driverId,
        method
      });

      if (response.data?.order) {
        const updatedOrder = response.data.order;
        setCurrentOrder(updatedOrder);
        navigation.setParams({
          orderUpdated: true,
          updatedOrder
        });
      }

      setSnackbarMessage('Payment marked as paid.');
      setSnackbarType('success');
      setSnackbarVisible(true);
    } catch (error) {
      console.error('Manual payment confirmation error:', error);
      setSnackbarMessage(error.response?.data?.error || 'Failed to confirm payment.');
      setSnackbarType('error');
      setSnackbarVisible(true);
    } finally {
      setConfirmingCash(false);
    }
  };

  const promptCashConfirmation = () => {
    Alert.alert(
      'Confirm Payment Received',
      'How did the customer pay? Choose the option that best describes the payment method.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Cash in Hand',
          onPress: () => handleConfirmCashPayment('cash')
        },
        {
          text: 'Paid to My M-Pesa',
          onPress: () => handleConfirmCashPayment('mpesa_manual')
        }
      ],
      { cancelable: true }
    );
  };

  const handleStatusUpdate = async (newStatus) => {
    const statusLabels = {
      'preparing': 'Preparing',
      'out_for_delivery': 'On the Way',
      'delivered': 'Delivered',
      'completed': 'Completed'
    };

    setUpdatingStatus(true);
    try {
      const response = await api.patch(`/driver-orders/${currentOrder.id}/status`, {
        status: newStatus,
        driverId: driverId,
        oldStatus: currentOrder.status
      });

      if (response.data) {
        // Check if we need to auto-update to completed
        // If delivered AND payment is completed, auto-update to completed
        let finalStatus = newStatus;
        if (newStatus === 'delivered' && response.data.paymentStatus === 'paid') {
          finalStatus = 'completed';
          // Make another API call to update to completed
          try {
            const completedResponse = await api.patch(`/driver-orders/${currentOrder.id}/status`, {
              status: 'completed',
              driverId: driverId,
              oldStatus: 'delivered'
            });
            if (completedResponse.data) {
              setCurrentOrder(prev => ({
                ...prev,
                status: 'completed',
                ...completedResponse.data
              }));
            }
          } catch (completedError) {
            console.error('Error auto-updating to completed:', completedError);
          }
        }

        // Update order state locally immediately (no refresh needed)
        setCurrentOrder(prev => ({
          ...prev,
          status: finalStatus === 'completed' ? 'completed' : newStatus,
          ...response.data
        }));
        
        const message = finalStatus === 'completed' 
          ? 'Order marked as delivered and automatically completed (payment confirmed)'
          : `Order status updated to ${statusLabels[newStatus]}`;
        
        setSnackbarMessage(message);
        setSnackbarType('success');
        setSnackbarVisible(true);

        // Notify HomeScreen to update its orders list
        navigation.setParams({ 
          orderUpdated: true, 
          updatedOrder: { ...currentOrder, status: finalStatus === 'completed' ? 'completed' : newStatus, ...response.data }
        });
      }
    } catch (error) {
      console.error('Status update error:', error);
      setSnackbarMessage(error.response?.data?.error || 'Failed to update status. Please try again.');
      setSnackbarType('error');
      setSnackbarVisible(true);
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Only admin can update to preparing - drivers cannot
  const canUpdateToPreparing = false; // Removed for drivers - admin only
  
  // Strict step-by-step: Can only update to "On the Way" if status is exactly "preparing"
  const canUpdateToOnTheWay = currentOrder.status === 'preparing';
  
  // Can only update to "Delivered" if status is exactly "out_for_delivery"
  const canUpdateToDelivered = currentOrder.status === 'out_for_delivery';
  const canMarkDeliveredNow = isPaymentPaid;
  
  const canShowPaymentPrompt = isPayOnDelivery && currentOrder.paymentStatus !== 'paid' && isActiveOrder;
  const paymentPromptEnabled = isOnTheWay;
  const canShowCashConfirmation = isPayOnDelivery && currentOrder.paymentStatus !== 'paid' && isActiveOrder && isOnTheWay;

  const orderItems = Array.isArray(currentOrder?.orderItems)
    ? currentOrder.orderItems
    : Array.isArray(currentOrder?.items)
      ? currentOrder.items
      : [];

  const itemsSubtotal = orderItems.reduce((sum, item) => {
    const price = parseFloat(item.price) || 0;
    const quantity = parseFloat(item.quantity) || 0;
    return sum + price * quantity;
  }, 0);

  const totalAmount = parseFloat(currentOrder?.totalAmount) || 0;
  const tipAmount = parseFloat(currentOrder?.tipAmount) || 0;
  const deliveryFee = Math.max(totalAmount - itemsSubtotal - tipAmount, 0);

  const displayNotes = sanitizeNotesForDriver(currentOrder?.notes);

  return (
    <View style={{ flex: 1 }}>
      <Snackbar
        visible={snackbarVisible}
        message={snackbarMessage}
        type={snackbarType}
        duration={5000}
        onClose={() => setSnackbarVisible(false)}
      />
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.content}>
          {/* Order Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.orderId, { color: colors.accentText }]}>Order #{currentOrder.id}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(currentOrder.status) }]}>
              <Text style={styles.statusText}>{currentOrder.status.replace('_', ' ').toUpperCase()}</Text>
            </View>
          </View>

        {/* Customer Info */}
        <View style={[styles.section, { backgroundColor: colors.paper }]}>
          <Text style={[styles.sectionTitle, { color: colors.accentText }]}>Customer Information</Text>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Name:</Text>
            <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{currentOrder.customerName}</Text>
          </View>
          {isCompletedOrCancelled ? (
            <Text style={[styles.infoMessage, { color: colors.textSecondary }]}>
              Customer phone number is hidden after {normalizedStatus === 'cancelled' ? 'cancellation' : 'completion'}.
            </Text>
          ) : (
            <TouchableOpacity style={styles.phoneRow} onPress={callCustomer}>
              <Ionicons name="call" size={24} color={colors.accentText} style={styles.callIcon} />
              <View style={styles.phoneInfo}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary, marginBottom: 4 }]}>Phone:</Text>
                <Text style={[styles.phoneNumber, { color: colors.accentText }]}>{currentOrder.customerPhone}</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Pickup Location (Branch) */}
        {currentOrder.branch && (
          <View style={[styles.section, { backgroundColor: colors.paper }]}>
            <Text style={[styles.sectionTitle, { color: colors.accentText }]}>Pickup Location</Text>
            <Text style={[styles.branchName, { color: colors.textPrimary, fontWeight: '600' }]}>
              {currentOrder.branch.name}
            </Text>
            <Text style={[styles.address, { color: colors.textSecondary }]}>{currentOrder.branch.address}</Text>
            <TouchableOpacity 
              style={[styles.mapButton, { backgroundColor: colors.accent }]} 
              onPress={async () => {
                const address = encodeURIComponent(currentOrder.branch.address);
                const url = `https://www.google.com/maps/dir/?api=1&destination=${address}`;
                try {
                  await Linking.openURL(url);
                } catch (err) {
                  console.error('Error opening Google Maps:', err);
                  setSnackbarMessage('Could not open Google Maps');
                  setSnackbarType('error');
                  setSnackbarVisible(true);
                }
              }}
            >
              <Ionicons name="storefront" size={20} color={isDarkMode ? '#0D0D0D' : colors.textPrimary} style={styles.mapIcon} />
              <Text style={[styles.mapButtonText, { color: isDarkMode ? '#0D0D0D' : colors.textPrimary }]}>Navigate to Branch</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Delivery Address */}
        {isCompletedOrCancelled ? (
          <View style={[styles.section, { backgroundColor: colors.paper }]}>
            <Text style={[styles.sectionTitle, { color: colors.accentText }]}>Delivery Address</Text>
            <Text style={[styles.infoMessage, { color: colors.textSecondary }]}>
              Delivery address is hidden after {normalizedStatus === 'cancelled' ? 'cancellation' : 'completion'}.
            </Text>
          </View>
        ) : (
          <View style={[styles.section, { backgroundColor: colors.paper }]}>
            <Text style={[styles.sectionTitle, { color: colors.accentText }]}>Delivery Address</Text>
            <Text style={[styles.address, { color: colors.textPrimary }]}>{currentOrder.deliveryAddress}</Text>
            <TouchableOpacity style={[styles.mapButton, { backgroundColor: colors.accent }]} onPress={openGoogleMaps}>
              <Ionicons name="map" size={20} color={isDarkMode ? '#0D0D0D' : colors.textPrimary} style={styles.mapIcon} />
              <Text style={[styles.mapButtonText, { color: isDarkMode ? '#0D0D0D' : colors.textPrimary }]}>Open in Google Maps</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Order Items */}
        <View style={[styles.section, { backgroundColor: colors.paper }]}>
          <Text style={[styles.sectionTitle, { color: colors.accentText }]}>Order Items</Text>
          {orderItems.map((item, index) => (
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
            <Text style={[styles.totalAmount, { color: colors.accentText }]}>{formatCurrency(currentOrder.totalAmount)}</Text>
          </View>
        </View>

        {/* Payment Info */}
        <View style={[styles.section, { backgroundColor: colors.paper }]}>
          <Text style={[styles.sectionTitle, { color: colors.accentText }]}>Payment</Text>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Type:</Text>
            <Text style={[styles.infoValue, { color: colors.textPrimary }]}>
              {currentOrder.paymentType === 'pay_now' ? 'Pay Now' : 'Pay on Delivery'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Status:</Text>
            <Text style={[styles.infoValue, { color: currentOrder.paymentStatus === 'paid' ? '#32CD32' : '#FFA500' }]}>
              {currentOrder.paymentStatus.toUpperCase()}
            </Text>
          </View>
          {currentOrder.paymentType === 'pay_on_delivery' && canShowPaymentPrompt && (
            <View style={styles.phoneInputContainer}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary, marginBottom: 8 }]}>Phone Number:</Text>
              <TextInput
                style={[styles.phoneInput, { 
                  backgroundColor: colors.background, 
                  borderColor: colors.border,
                  color: colors.textPrimary 
                }]}
                value={paymentPhone}
                onChangeText={setPaymentPhone}
                placeholder="Enter phone number"
                placeholderTextColor={colors.textSecondary}
                keyboardType="phone-pad"
                editable={!loading}
              />
            </View>
          )}
          {currentOrder.paymentConfirmedAt && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Confirmed At:</Text>
              <Text style={[styles.infoValue, { color: colors.textPrimary }]}>
                {formatDateTimeToSecond(currentOrder.paymentConfirmedAt)}
              </Text>
            </View>
          )}
          {isCompletedOrCancelled && (
            <View style={styles.breakdownContainer}>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, styles.breakdownLabel, { color: colors.textSecondary }]}>Items Total:</Text>
                <Text style={[styles.infoValue, styles.breakdownValue, { color: colors.textPrimary }]}>
                  {formatCurrency(itemsSubtotal)}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, styles.breakdownLabel, { color: colors.textSecondary }]}>Delivery Fee:</Text>
                <Text style={[styles.infoValue, styles.breakdownValue, { color: colors.textPrimary }]}>
                  {formatCurrency(deliveryFee)}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, styles.breakdownLabel, { color: colors.textSecondary }]}>Tip:</Text>
                <Text style={[styles.infoValue, styles.breakdownValue, { color: colors.textPrimary }]}>
                  {formatCurrency(tipAmount)}
                </Text>
              </View>
              <View style={[styles.infoRow, styles.breakdownTotalRow]}>
                <Text style={[styles.infoLabel, styles.breakdownTotalLabel, { color: colors.textPrimary }]}>Total Paid:</Text>
                <Text style={[styles.infoValue, styles.breakdownTotalValue, { color: colors.accentText }]}>
                  {formatCurrency(totalAmount)}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Order Details */}
        <View style={[styles.section, { backgroundColor: colors.paper }]}>
          <Text style={[styles.sectionTitle, { color: colors.accentText }]}>Order Details</Text>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Date:</Text>
            <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{formatDate(currentOrder.createdAt)}</Text>
          </View>
          {displayNotes ? (
            <View style={styles.notesContainer}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Notes:</Text>
              <Text style={[styles.notes, { color: colors.textPrimary }]}>{displayNotes}</Text>
            </View>
          ) : null}
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          {canShowPaymentPrompt && (
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.paymentButton,
                (!paymentPromptEnabled || loading) && styles.actionButtonDisabled
              ]}
              onPress={handleInitiatePayment}
              disabled={loading || !paymentPromptEnabled}
            >
              {loading ? (
                <ActivityIndicator color="#0D0D0D" />
              ) : (
                <Text style={styles.actionButtonText}>Send Payment Prompt</Text>
              )}
            </TouchableOpacity>
          )}

          {canShowCashConfirmation && (
            <TouchableOpacity
              style={[styles.actionButton, styles.cashButton]}
              onPress={promptCashConfirmation}
              disabled={confirmingCash}
            >
              {confirmingCash ? (
                <ActivityIndicator color="#0D0D0D" />
              ) : (
                <Text style={styles.actionButtonText}>💵 Received Cash Payment</Text>
              )}
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
              style={[
                styles.actionButton,
                styles.deliveredButton,
                (!canMarkDeliveredNow || updatingStatus) && styles.actionButtonDisabled
              ]}
              onPress={() => handleStatusUpdate('delivered')}
              disabled={updatingStatus || !canMarkDeliveredNow}
            >
              <Text style={styles.actionButtonText}>✅ Mark Delivered</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </ScrollView>
    </View>
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
  infoMessage: {
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
  },
  link: {
    color: '#00E0B8',
    textDecorationLine: 'underline',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0, 224, 184, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 224, 184, 0.3)',
  },
  callIcon: {
    marginRight: 12,
  },
  phoneInfo: {
    flex: 1,
  },
  phoneNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00E0B8',
  },
  mapIcon: {
    marginRight: 8,
  },
  phoneInputContainer: {
    marginTop: 12,
  },
  phoneInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#F5F5F5',
  },
  address: {
    fontSize: 14,
    color: '#F5F5F5',
    marginBottom: 10,
    lineHeight: 20,
  },
  branchName: {
    fontSize: 16,
    color: '#F5F5F5',
    marginBottom: 6,
    fontWeight: '600',
  },
  mapButton: {
    backgroundColor: '#00E0B8',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'center',
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
  breakdownContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
    gap: 6,
  },
  breakdownLabel: {
    flex: 1,
    textAlign: 'left',
  },
  breakdownValue: {
    flex: 1,
    textAlign: 'right',
  },
  breakdownTotalRow: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 224, 184, 0.3)',
  },
  breakdownTotalLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'left',
  },
  breakdownTotalValue: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'right',
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
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  paymentButton: {
    backgroundColor: '#00E0B8',
  },
  statusButton: {
    backgroundColor: '#1E88E5',
  },
  deliveredButton: {
    backgroundColor: '#00C853',
  },
  cashButton: {
    backgroundColor: '#FDD835',
  },
  actionButtonText: {
    color: '#0D0D0D',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default OrderDetailScreen;





