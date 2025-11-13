import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

const HISTORY_TABS = [
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const toStartOfDay = (date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const toEndOfDay = (date) => {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
};

const formatPickerDate = (date) =>
  date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

const formatDateTime = (dateString) =>
  new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const OrderHistoryScreen = ({ route, navigation }) => {
  const { phoneNumber } = route.params || {};
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [endDate, setEndDate] = useState(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [historyType, setHistoryType] = useState('completed');
  const [loadError, setLoadError] = useState(null);
  const { colors, isDarkMode } = useTheme();

  const safeColors = colors || {
    background: '#0D0D0D',
    paper: '#121212',
    textPrimary: '#F5F5F5',
    textSecondary: '#B0B0B0',
    accent: '#00E0B8',
    accentText: '#00E0B8',
    border: '#333',
  };

  const loadOrderHistory = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);

      const phone = phoneNumber || (await AsyncStorage.getItem('driver_phone'));
      if (!phone) {
        console.error('No phone number found');
        setOrders([]);
        return;
      }

      const driverResponse = await api.get(`/drivers/phone/${phone}`);
      const driverId = driverResponse.data?.id;

      if (!driverId) {
        setOrders([]);
        return;
      }

      const ordersResponse = await api.get(`/driver-orders/${driverId}`);
      const allOrders = Array.isArray(ordersResponse.data) ? ordersResponse.data : [];

      const start = toStartOfDay(startDate);
      const end = toEndOfDay(endDate);
      const relevantStatuses = historyType === 'completed' ? ['completed', 'delivered'] : ['cancelled'];

      const filtered = allOrders
        .filter((order) => relevantStatuses.includes(order.status))
        .filter((order) => {
          const orderDate = new Date(order.createdAt);
          return orderDate >= start && orderDate <= end;
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      setOrders(filtered);
    } catch (error) {
      console.error('Error loading order history:', error);
      setLoadError('Failed to load order history. Pull to refresh to try again.');
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [phoneNumber, historyType, startDate, endDate]);

  useEffect(() => {
    loadOrderHistory();
  }, [loadOrderHistory]);

  const onRefresh = () => {
    setRefreshing(true);
    loadOrderHistory();
  };

  const openOrderDetails = (order) => {
    navigation.navigate('OrderDetail', {
      order,
      driverId: null,
    });
  };

  const emptyStateMessage =
    historyType === 'completed'
      ? 'No completed orders in this date range'
      : 'No cancelled orders in this date range';

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
        <Text style={[styles.sectionTitle, { color: safeColors.accentText, marginBottom: 20 }]}>Order History</Text>

        <View style={styles.tabsContainer}>
          {HISTORY_TABS.map((tab) => {
            const isActive = historyType === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.tabButton,
                  {
                    borderBottomColor: isActive ? safeColors.accent : 'transparent',
                  },
                ]}
                onPress={() => setHistoryType(tab.key)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.tabLabel,
                    {
                      color: isActive
                        ? isDarkMode
                          ? '#0D0D0D'
                          : safeColors.textPrimary
                        : safeColors.textSecondary,
                    },
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

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
                <Text style={[styles.datePickerText, { color: isDarkMode ? '#0D0D0D' : safeColors.textPrimary }]}
                >
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
                <Text style={[styles.datePickerText, { color: isDarkMode ? '#0D0D0D' : safeColors.textPrimary }]}
                >
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
              maximumDate={endDate}
              onChange={(event, selectedDate) => {
                setShowStartDatePicker(Platform.OS === 'ios');
                if (selectedDate) {
                  if (selectedDate > endDate) {
                    Alert.alert(
                      'Invalid Date',
                      'Start date cannot be after end date. Please select an earlier date.',
                      [{ text: 'OK' }],
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
              minimumDate={startDate}
              onChange={(event, selectedDate) => {
                setShowEndDatePicker(Platform.OS === 'ios');
                if (selectedDate) {
                  if (selectedDate < startDate) {
                    Alert.alert(
                      'Invalid Date',
                      'End date cannot be before start date. Please select a later date.',
                      [{ text: 'OK' }],
                    );
                    return;
                  }
                  setEndDate(selectedDate);
                }
              }}
            />
          )}
        </View>

        {loadError && (
          <Text style={[styles.errorText, { color: safeColors.textSecondary, borderColor: safeColors.border }]}
          >
            {loadError}
          </Text>
        )}

        {orders.length === 0 ? (
          <View style={[styles.noOrdersCard, { backgroundColor: safeColors.paper }]}>
            <Text style={[styles.noOrdersText, { color: safeColors.textSecondary }]}
            >
              {emptyStateMessage}
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
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: historyType === 'completed' ? '#00E0B8' : '#EF5350' },
                    ]}
                  >
                    <Text style={styles.statusText}>{order.status.replace('_', ' ').toUpperCase()}</Text>
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
                <Text style={[styles.orderCardDetail, { color: safeColors.textPrimary, marginBottom: 6 }]}>
                  <Text style={[styles.orderCardLabel, { color: safeColors.textSecondary }]}>Customer: </Text>
                  {order.customerName}
                </Text>
                <Text style={[styles.orderCardDetail, { color: safeColors.textSecondary, marginBottom: 6 }]}>
                  Customer phone and address are hidden after{' '}
                  {historyType === 'completed' ? 'completion' : 'cancellation'}.
                </Text>
                <View style={styles.orderCardFooter}>
                  <View>
                    <Text style={[styles.orderCardAmount, { color: safeColors.accentText }]}>
                      KES {parseFloat(order.totalAmount).toFixed(2)}
                    </Text>
                    {order.tipAmount && parseFloat(order.tipAmount) > 0 && (
                      <Text style={[styles.tipText, { color: safeColors.textSecondary }]}>
                        Tip: KES {parseFloat(order.tipAmount).toFixed(2)}
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.orderCardDate, { color: safeColors.textSecondary }]}>
                    {formatDateTime(order.createdAt)}
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
  tabsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    marginHorizontal: 8,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '700',
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
  errorText: {
    fontSize: 13,
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 16,
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
  tipText: {
    fontSize: 12,
    marginTop: 2,
  },
  orderCardDate: {
    fontSize: 11,
  },
});

export default OrderHistoryScreen;