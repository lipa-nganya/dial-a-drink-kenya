import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Platform } from 'react-native';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

const CompletedOrdersScreen = ({ route, navigation }) => {
  const { phoneNumber } = route.params || {};
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)); // 30 days ago
  const [endDate, setEndDate] = useState(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const { colors, isDarkMode } = useTheme();

  useEffect(() => {
    loadCompletedOrders();
  }, [startDate, endDate]);

  const loadCompletedOrders = async () => {
    try {
      setLoading(true);
      const phone = phoneNumber || await AsyncStorage.getItem('driver_phone');

      if (!phone) {
        console.error('No phone number found');
        setLoading(false);
        return;
      }

      // Load driver info to get driver ID
      const driverResponse = await api.get(`/drivers/phone/${phone}`);

      if (driverResponse.data && driverResponse.data.id) {
        // Load completed orders for this driver
        const ordersResponse = await api.get(`/driver-orders/${driverResponse.data.id}`);
        
        // Filter to only completed/delivered orders
        const completedOrders = (ordersResponse.data || []).filter(order => 
          order.status === 'completed' || order.status === 'delivered'
        );

        // Filter by date range
        const filteredOrders = completedOrders.filter(order => {
          const orderDate = new Date(order.createdAt);
          return orderDate >= startDate && orderDate <= endDate;
        });

        // Sort by date (newest first)
        filteredOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        console.log('Completed orders loaded:', filteredOrders.length);
        setOrders(filteredOrders);
      }
    } catch (error) {
      console.error('Error loading completed orders:', error);
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadCompletedOrders();
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

  const formatPickerDate = (date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const openOrderDetails = (order) => {
    navigation.navigate('OrderDetail', {
      order: order,
      driverId: null // Completed orders don't need driver ID
    });
  };

  const safeColors = colors || {
    background: '#0D0D0D',
    paper: '#121212',
    textPrimary: '#F5F5F5',
    textSecondary: '#B0B0B0',
    accent: '#00E0B8',
    accentText: '#00E0B8',
    border: '#333',
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: safeColors.background }]}>
        <ActivityIndicator size="large" color={safeColors.accent} />
        <Text style={[styles.loadingText, { color: safeColors.textSecondary }]}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: safeColors.background }]}
      contentContainerStyle={{ paddingBottom: 80 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={safeColors.accent} />
      }
    >
      <View style={styles.content}>
        <Text style={[styles.sectionTitle, { color: safeColors.accentText, marginBottom: 20 }]}>
          Completed Orders
        </Text>

        {/* Date Filter Section */}
        <View style={[styles.dateFilterCard, { backgroundColor: safeColors.paper }]}>
          <Text style={[styles.filterLabel, { color: safeColors.textPrimary }]}>Filter by Date Range</Text>
          
          <View style={styles.datePickerRow}>
            <View style={styles.datePickerContainer}>
              <Text style={[styles.dateLabel, { color: safeColors.textSecondary }]}>From:</Text>
              <TouchableOpacity
                style={[styles.datePickerButton, { backgroundColor: safeColors.accent }]}
                onPress={() => setShowStartDatePicker(true)}
              >
                <Ionicons name="calendar" size={16} color={isDarkMode ? '#0D0D0D' : safeColors.textPrimary} />
                <Text style={[styles.datePickerText, { color: isDarkMode ? '#0D0D0D' : safeColors.textPrimary }]}>
                  {formatPickerDate(startDate)}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.datePickerContainer}>
              <Text style={[styles.dateLabel, { color: safeColors.textSecondary }]}>To:</Text>
              <TouchableOpacity
                style={[styles.datePickerButton, { backgroundColor: safeColors.accent }]}
                onPress={() => setShowEndDatePicker(true)}
              >
                <Ionicons name="calendar" size={16} color={isDarkMode ? '#0D0D0D' : safeColors.textPrimary} />
                <Text style={[styles.datePickerText, { color: isDarkMode ? '#0D0D0D' : safeColors.textPrimary }]}>
                  {formatPickerDate(endDate)}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {showStartDatePicker && (
            <DateTimePicker
              value={startDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              maximumDate={endDate} // Prevent start date from being after end date
              onChange={(event, selectedDate) => {
                setShowStartDatePicker(Platform.OS === 'ios');
                if (selectedDate) {
                  // Validate: start date cannot be after end date
                  if (selectedDate > endDate) {
                    Alert.alert(
                      'Invalid Date',
                      'Start date cannot be after end date. Please select an earlier date.',
                      [{ text: 'OK' }]
                    );
                    return;
                  }
                  setStartDate(selectedDate);
                }
              }}
            />
          )}

          {showEndDatePicker && (
            <DateTimePicker
              value={endDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              minimumDate={startDate} // Prevent end date from being before start date
              onChange={(event, selectedDate) => {
                setShowEndDatePicker(Platform.OS === 'ios');
                if (selectedDate) {
                  // Validate: end date cannot be before start date
                  if (selectedDate < startDate) {
                    Alert.alert(
                      'Invalid Date',
                      'End date cannot be before start date. Please select a later date.',
                      [{ text: 'OK' }]
                    );
                    return;
                  }
                  setEndDate(selectedDate);
                }
              }}
            />
          )}
        </View>

        {/* Orders List */}
        {orders.length === 0 ? (
          <View style={[styles.noOrdersCard, { backgroundColor: safeColors.paper }]}>
            <Text style={[styles.noOrdersText, { color: safeColors.textSecondary }]}>
              No completed orders in this date range
            </Text>
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
                  <View style={[styles.statusBadge, { backgroundColor: '#00E0B8' }]}>
                    <Text style={styles.statusText}>{order.status.toUpperCase()}</Text>
                  </View>
                </View>
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
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  dateFilterCard: {
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  datePickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  datePickerContainer: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
    marginBottom: 6,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 6,
    gap: 8,
  },
  datePickerText: {
    fontSize: 14,
    fontWeight: '600',
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
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderCardBody: {
    // Empty for now
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
});

export default CompletedOrdersScreen;

