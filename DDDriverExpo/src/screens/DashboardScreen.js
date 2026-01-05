import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import api from '../services/api';

const DashboardScreen = ({ navigation }) => {
  const [driverInfo, setDriverInfo] = useState(null);
  const [orderStats, setOrderStats] = useState({
    pending: 0,
    completed: 0,
    inProgress: 0,
    canceled: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnShift, setIsOnShift] = useState(false);
  const { colors, isDarkMode } = useTheme();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const phone = await AsyncStorage.getItem('driver_phone');
      
      if (!phone) {
        console.error('No phone number found');
        setLoading(false);
        return;
      }

      // Load driver info
      const driverResponse = await api.get(`/drivers/phone/${phone}`);
      
      if (driverResponse.data) {
        setDriverInfo(driverResponse.data);
        // Check if driver is on shift (active or on_delivery status)
        setIsOnShift(driverResponse.data.status === 'active' || driverResponse.data.status === 'on_delivery');
        
        // Load all orders to calculate statistics
        if (driverResponse.data.id) {
          try {
            const ordersResponse = await api.get(`/driver-orders/${driverResponse.data.id}`);
            const orders = ordersResponse.data || [];
            
            // Calculate statistics
            const stats = {
              pending: orders.filter(o => o.status === 'pending' && o.driverAccepted !== false).length,
              completed: orders.filter(o => o.status === 'completed' || o.status === 'delivered').length,
              inProgress: orders.filter(o => 
                (o.status === 'confirmed' || o.status === 'preparing' || o.status === 'out_for_delivery') &&
                o.driverAccepted !== false &&
                o.status !== 'delivered' &&
                o.status !== 'completed' &&
                o.status !== 'cancelled'
              ).length,
              canceled: orders.filter(o => o.status === 'cancelled').length,
            };
            
            setOrderStats(stats);
          } catch (error) {
            console.error('Error loading orders:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const toggleShift = async () => {
    try {
      if (!driverInfo?.id) return;

      const newStatus = isOnShift ? 'offline' : 'active';
      await api.put(`/drivers/${driverInfo.id}`, { status: newStatus });
      
      setIsOnShift(!isOnShift);
      setDriverInfo({ ...driverInfo, status: newStatus });
      
      // Refresh dashboard data
      loadDashboardData();
    } catch (error) {
      console.error('Error toggling shift:', error);
    }
  };

  const handleTilePress = (tileType) => {
    switch (tileType) {
      case 'inProgress':
        // Navigate to active orders screen using parent navigator
        const parentNavigation = navigation.getParent();
        if (parentNavigation) {
          parentNavigation.navigate('ActiveOrders');
        } else {
          navigation.navigate('ActiveOrders');
        }
        break;
      case 'pending':
        // Could navigate to pending orders screen
        break;
      case 'completed':
        // Navigate to history tab with completed tab selected
        navigation.navigate('OrderHistoryTab', { initialTab: 'completed' });
        break;
      case 'canceled':
        // Navigate to history tab with cancelled tab selected
        navigation.navigate('OrderHistoryTab', { initialTab: 'cancelled' });
        break;
      case 'cashAtHand':
        // Could navigate to cash at hand screen
        break;
      case 'payments':
        // Could navigate to payments screen
        break;
      case 'savings':
        // Could navigate to savings screen
        break;
      case 'notice':
        // Could navigate to notice screen
        break;
      default:
        break;
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background || '#FFFFFF' }]}>
        <ActivityIndicator size="large" color={colors.accent || '#00E0B8'} />
        <Text style={[styles.loadingText, { color: colors.textSecondary || '#B0B0B0' }]}>Loading...</Text>
      </View>
    );
  }

  const safeColors = colors || {
    background: '#FFFFFF',
    paper: '#FFFFFF',
    textPrimary: '#000000',
    textSecondary: '#666666',
    accent: '#00E0B8',
    accentText: '#00E0B8',
    border: '#E0E0E0',
  };

  return (
    <View style={[styles.container, { backgroundColor: safeColors.background }]}>
      <StatusBar barStyle="dark-content" backgroundColor={safeColors.background} />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={safeColors.accent} />
        }
      >
        {/* User Info Card */}
        {driverInfo && (
          <View style={[styles.userCard, { backgroundColor: safeColors.paper }]}>
            <View style={styles.userInfo}>
              <Text style={[styles.userName, { color: safeColors.textPrimary }]}>{driverInfo.name || 'Driver'}</Text>
              <Text style={[styles.userPhone, { color: safeColors.textSecondary }]}>{driverInfo.phoneNumber || ''}</Text>
            </View>
            <TouchableOpacity 
              onPress={toggleShift} 
              style={[styles.shiftButton, { backgroundColor: isOnShift ? '#FF3366' : safeColors.accent }]}
            >
              <Text style={styles.shiftButtonText}>
                {isOnShift ? 'End Shift' : 'Start Shift'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Dashboard Tiles Grid */}
        <View style={styles.tilesGrid}>
          {/* Row 1 */}
          <TouchableOpacity
            style={[styles.tile, { backgroundColor: safeColors.paper }]}
            onPress={() => handleTilePress('pending')}
            activeOpacity={0.7}
          >
            <Ionicons name="phone-portrait-outline" size={32} color={safeColors.accent} />
            <Text style={[styles.tileTitle, { color: safeColors.textPrimary }]}>Pending</Text>
            <Text style={[styles.tileValue, { color: '#FF0000' }]}>{orderStats.pending}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tile, { backgroundColor: safeColors.paper }]}
            onPress={() => handleTilePress('completed')}
            activeOpacity={0.7}
          >
            <Ionicons name="checkmark-circle-outline" size={32} color={safeColors.accent} />
            <Text style={[styles.tileTitle, { color: safeColors.textPrimary }]}>Completed</Text>
            <Text style={[styles.tileValue, { color: '#FF0000' }]}>{orderStats.completed}</Text>
          </TouchableOpacity>

          {/* Row 2 */}
          <TouchableOpacity
            style={[styles.tile, { backgroundColor: safeColors.paper }]}
            onPress={() => handleTilePress('inProgress')}
            activeOpacity={0.7}
          >
            <Ionicons name="bicycle-outline" size={32} color={safeColors.accent} />
            <Text style={[styles.tileTitle, { color: safeColors.textPrimary }]}>In Progress</Text>
            <Text style={[styles.tileValue, { color: '#FF0000' }]}>{orderStats.inProgress}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tile, { backgroundColor: safeColors.paper }]}
            onPress={() => handleTilePress('canceled')}
            activeOpacity={0.7}
          >
            <Ionicons name="close-circle-outline" size={32} color={safeColors.accent} />
            <Text style={[styles.tileTitle, { color: safeColors.textPrimary }]}>Canceled</Text>
            <Text style={[styles.tileValue, { color: '#FF0000' }]}>{orderStats.canceled}</Text>
          </TouchableOpacity>

          {/* Row 3 */}
          <TouchableOpacity
            style={[styles.tile, { backgroundColor: safeColors.paper }]}
            onPress={() => handleTilePress('cashAtHand')}
            activeOpacity={0.7}
          >
            <Ionicons name="cash-outline" size={32} color={safeColors.accent} />
            <Text style={[styles.tileTitle, { color: safeColors.textPrimary }]}>Cash At Hand</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tile, { backgroundColor: safeColors.paper }]}
            onPress={() => handleTilePress('payments')}
            activeOpacity={0.7}
          >
            <Ionicons name="receipt-outline" size={32} color={safeColors.accent} />
            <Text style={[styles.tileTitle, { color: safeColors.textPrimary }]}>Payments</Text>
          </TouchableOpacity>

          {/* Row 4 */}
          <TouchableOpacity
            style={[styles.tile, { backgroundColor: safeColors.paper }]}
            onPress={() => handleTilePress('savings')}
            activeOpacity={0.7}
          >
            <Ionicons name="wallet-outline" size={32} color={safeColors.accent} />
            <Text style={[styles.tileTitle, { color: safeColors.textPrimary }]}>My Savings</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tile, { backgroundColor: safeColors.paper }]}
            onPress={() => handleTilePress('notice')}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={32} color={safeColors.accent} />
            <Text style={[styles.tileTitle, { color: safeColors.textPrimary }]}>Notice</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100, // Space for bottom tab
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
  },
  userCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userPhone: {
    fontSize: 14,
  },
  shiftButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  shiftButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  tilesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  tile: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tileTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  tileValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 4,
  },
});

export default DashboardScreen;

