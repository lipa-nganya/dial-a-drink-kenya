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

const formatPickerDate = (date) => {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const formatDateTime = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

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

  useEffect(() => {
    loadOrderHistory();
  }, [historyType, startDate, endDate]);

  const loadOrderHistory = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const phone = phoneNumber || await AsyncStorage.getItem('driver_phone');
      if (!phone) {
        console.error('No phone number found');
        setLoading(false);
        setOrders([]);
        return;
      }

      const driverResponse = await api.get(`/drivers/phone/${phone}`);
      if (!driverResponse.data?.id) {
        setOrders([]);
        return;
      }

      const ordersResponse = await api.get(`/driver-orders/${driverResponse.data.id}`);
      const allOrders = Array.isArray(ordersResponse.data) ? ordersResponse.data : [];

      const relevantStatuses = historyType === 'completed'
        ? ['completed', 'delivered']
        : ['cancelled'];

      const start = toStartOfDay(startDate);
      const end = toEndOfDay(endDate);

      const filtered = allOrders
        .filter(order => relevantStatuses.includes(order.status))
        .filter(order => {
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
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadOrderHistory();
  };

  const openOrderDetails = (order) => {
    navigation.navigate('OrderDetail', {
      order,
      driverId: null
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

  const emptyStateMessage = historyType === 'completed'
    ? 'No completed orders in this date range'
    : 'No cancelled orders in this date range';

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: safeColors.background }]}>\n        <ActivityIndicator size="large" color={safeColors.accent} />\n        <Text style={[styles.loadingText, { color: safeColors.textSecondary }]}>Loading...</Text>\n      </View>\n    );
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
        <Text style={[styles.sectionTitle, { color: safeColors.accentText, marginBottom: 20 }]}>\n          Order History\n        </Text>

        <View style={[styles.toggleContainer, { backgroundColor: safeColors.paper, borderColor: safeColors.border }]}>\n          {HISTORY_TABS.map((tab) => {\n            const isActive = historyType === tab.key;\n            return (\n              <TouchableOpacity\n                key={tab.key}\n                style={[\n                  styles.toggleButton,\n                  {\n                    backgroundColor: isActive ? safeColors.accent : 'transparent',\n                    borderColor: isActive ? safeColors.accent : safeColors.border,\n                  }\n                ]}\n                onPress={() => setHistoryType(tab.key)}\n                activeOpacity={0.7}\n              >\n                <Text\n                  style={[\n                    styles.toggleLabel,\n                    {\n                      color: isActive\n                        ? (isDarkMode ? '#0D0D0D' : safeColors.textPrimary)\n                        : safeColors.textSecondary\n                    }\n                  ]}\n                >\n                  {tab.label}\n                </Text>\n              </TouchableOpacity>\n            );\n          })}\n        </View>

        <View style={[styles.dateFilterCard, { backgroundColor: safeColors.paper }]}>\n          <Text style={[styles.filterLabel, { color: safeColors.textPrimary }]}>Filter by Date Range</Text>\n          \n          <View style={styles.datePickerRow}>\n            <View style={styles.datePickerContainer}>\n              <Text style={[styles.dateLabel, { color: safeColors.textSecondary }]}>From:</Text>\n              <TouchableOpacity\n                style={[styles.datePickerButton, { backgroundColor: safeColors.accent }]}\n                onPress={() => setShowStartDatePicker(true)}\n              >\n                <Ionicons name="calendar" size={16} color={isDarkMode ? '#0D0D0D' : safeColors.textPrimary} />\n                <Text style={[styles.datePickerText, { color: isDarkMode ? '#0D0D0D' : safeColors.textPrimary }]}>\n                  {formatPickerDate(startDate)}\n                </Text>\n              </TouchableOpacity>\n            </View>

            <View style={styles.datePickerContainer}>\n              <Text style={[styles.dateLabel, { color: safeColors.textSecondary }]}>To:</Text>\n              <TouchableOpacity\n                style={[styles.datePickerButton, { backgroundColor: safeColors.accent }]}\n                onPress={() => setShowEndDatePicker(true)}\n              >\n                <Ionicons name="calendar" size={16} color={isDarkMode ? '#0D0D0D' : safeColors.textPrimary} />\n                <Text style={[styles.datePickerText, { color: isDarkMode ? '#0D0D0D' : safeColors.textPrimary }]}>\n                  {formatPickerDate(endDate)}\n                </Text>\n              </TouchableOpacity>\n            </View>\n          </View>

          {showStartDatePicker && (\n            <DateTimePicker\n              value={startDate}\n              mode="date"\n              display={Platform.OS === 'ios' ? 'spinner' : 'default'}\n              maximumDate={endDate}\n              onChange={(event, selectedDate) => {\n                setShowStartDatePicker(Platform.OS === 'ios');\n                if (selectedDate) {\n                  if (selectedDate > endDate) {\n                    Alert.alert(\n                      'Invalid Date',\n                      'Start date cannot be after end date. Please select an earlier date.',\n                      [{ text: 'OK' }]\n                    );\n                    return;\n                  }\n                  setStartDate(selectedDate);\n                }\n              }}\n            />\n          )}

          {showEndDatePicker && (\n            <DateTimePicker\n              value={endDate}\n              mode="date"\n              display={Platform.OS === 'ios' ? 'spinner' : 'default'}\n              minimumDate={startDate}\n              onChange={(event, selectedDate) => {\n                setShowEndDatePicker(Platform.OS === 'ios');\n                if (selectedDate) {\n                  if (selectedDate < startDate) {\n                    Alert.alert(\n                      'Invalid Date',\n                      'End date cannot be before start date. Please select a later date.',\n                      [{ text: 'OK' }]\n                    );\n                    return;\n                  }\n                  setEndDate(selectedDate);\n                }\n              }}\n            />\n          )}
        </View>

        {loadError && (\n          <Text style={[styles.errorText, { color: safeColors.textSecondary, borderColor: safeColors.border }]}>\n            {loadError}\n          </Text>\n        )}

        {orders.length === 0 ? (\n          <View style={[styles.noOrdersCard, { backgroundColor: safeColors.paper }]}>\n            <Text style={[styles.noOrdersText, { color: safeColors.textSecondary }]}>\n              {emptyStateMessage}\n            </Text>\n          </View>\n        ) : (\n          orders.map((order) => (\n            <TouchableOpacity\n              key={order.id}\n              style={[styles.orderCard, { backgroundColor: safeColors.paper }]}\n              onPress={() => openOrderDetails(order)}\n              activeOpacity={0.7}\n            >\n              <View style={styles.orderCardHeader}>\n                <View style={styles.orderCardLeft}>\n                  <Text style={[styles.orderNumber, { color: safeColors.accentText }]}>Order #{order.id}</Text>\n                  <View style={[\n                    styles.statusBadge,\n                    {\n                      backgroundColor: historyType === 'completed' ? '#00E0B8' : '#EF5350'\n                    }\n                  ]}>\n                    <Text style={styles.statusText}>{order.status.replace('_', ' ').toUpperCase()}</Text>\n                  </View>\n                </View>\n                <TouchableOpacity\n                  style={[styles.actionIcon, { backgroundColor: safeColors.accentText }]}\n                  onPress={(e) => {\n                    e.stopPropagation();\n                    openOrderDetails(order);\n                  }}\n                  activeOpacity={0.7}\n                >\n                  <Ionicons name="eye" size={20} color={isDarkMode ? '#0D0D0D' : safeColors.textPrimary} />\n                </TouchableOpacity>\n              </View>\n
              <View style={styles.orderCardBody}>\n                <Text style={[styles.orderCardDetail, { color: safeColors.textPrimary, marginBottom: 6 }]}>\n                  <Text style={[styles.orderCardLabel, { color: safeColors.textSecondary }]}>Customer: </Text>\n                  {order.customerName}\n                </Text>\n                <Text style={[styles.orderCardDetail, { color: safeColors.textSecondary, marginBottom: 6 }]}>\n                  Customer phone and address are hidden after {historyType === 'completed' ? 'completion' : 'cancellation'}.\n                </Text>\n                <View style={styles.orderCardFooter}>\n                  <View>\n                    <Text style={[styles.orderCardAmount, { color: safeColors.accentText }]}>\n                      KES {parseFloat(order.totalAmount).toFixed(2)}\n                    </Text>\n                    {order.tipAmount && parseFloat(order.tipAmount) > 0 && (\n                      <Text style={[styles.tipText, { color: safeColors.textSecondary }]}>\n                        Tip: KES {parseFloat(order.tipAmount).toFixed(2)}\n                      </Text>\n                    )}\n                  </View>\n                  <Text style={[styles.orderCardDate, { color: safeColors.textSecondary }]}>\n                    {formatDateTime(order.createdAt)}\n                  </Text>\n                </View>\n              </View>\n            </TouchableOpacity>\n          ))\n        )}
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
  toggleContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
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
  orderCardBody: {
    marginTop: 4,
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
    alignItems: 'flex-end',
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
    fontSize: 11,
    marginTop: 2,
  },
  orderCardDate: {
    fontSize: 11,
    textAlign: 'right',
  },
});

export default OrderHistoryScreen;
