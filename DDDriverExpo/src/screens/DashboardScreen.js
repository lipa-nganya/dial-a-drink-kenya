import React, { useState, useEffect, useRef } from 'react';
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
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import api from '../services/api';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

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
  const scrollViewRef = useRef(null);
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

  // Calculate available height for tiles
  // Screen height - status bar - user card - padding - safe area
  const statusBarHeight = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;
  const tabBarHeight = 60; // Approximate tab bar height
  const userCardHeight = 80; // Approximate user card height
  const topPadding = 15;
  const bottomMargin = 25; // Margin after last row
  const availableHeight = SCREEN_HEIGHT - statusBarHeight - tabBarHeight - userCardHeight - topPadding - bottomMargin;
  const tileHeight = (availableHeight / 4) - 10; // 4 rows, minus some spacing
  const tileWidth = (SCREEN_WIDTH - 60) / 2; // 2 columns with padding
  
  // Calculate total content height: userCard + margin + tiles + spacing + bottom margin
  const userCardMargin = 12;
  const tileSpacing = 10; // marginBottom between tiles
  const totalTileHeight = (tileHeight * 4) + (tileSpacing * 3); // 4 rows with 3 gaps
  const contentHeight = topPadding + userCardHeight + userCardMargin + totalTileHeight + bottomMargin;
  const maxScrollHeight = SCREEN_HEIGHT - statusBarHeight - tabBarHeight;

  return (
    <View style={[styles.container, { backgroundColor: safeColors.background }]}>
      <StatusBar barStyle="dark-content" backgroundColor={safeColors.background} />
      
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { 
            paddingBottom: bottomMargin,
          }
        ]}
        bounces={false}
        showsVerticalScrollIndicator={contentHeight > maxScrollHeight}
        onScrollEndDrag={(event) => {
          const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
          const maxScrollY = Math.max(0, contentSize.height - layoutMeasurement.height);
          // Clamp scroll position if user dragged beyond limits
          if (contentOffset.y < 0) {
            scrollViewRef.current?.scrollTo({ y: 0, animated: true });
          } else if (contentOffset.y > maxScrollY) {
            scrollViewRef.current?.scrollTo({ y: maxScrollY, animated: true });
          }
        }}
        onMomentumScrollEnd={(event) => {
          const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
          const maxScrollY = Math.max(0, contentSize.height - layoutMeasurement.height);
          // Clamp scroll position after momentum scrolling
          if (contentOffset.y < 0) {
            scrollViewRef.current?.scrollTo({ y: 0, animated: true });
          } else if (contentOffset.y > maxScrollY) {
            scrollViewRef.current?.scrollTo({ y: maxScrollY, animated: true });
          }
        }}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={safeColors.accent} />
        }
      >
        <View style={styles.contentContainer}>
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
            style={[styles.tile, { 
              backgroundColor: safeColors.paper,
              width: tileWidth,
              height: tileHeight,
            }]}
            onPress={() => handleTilePress('pending')}
            activeOpacity={0.7}
          >
            <Ionicons name="phone-portrait-outline" size={tileHeight * 0.15} color={safeColors.accent} />
            <Text style={[styles.tileTitle, { color: safeColors.textPrimary, fontSize: tileHeight * 0.08 }]}>Pending</Text>
            <Text style={[styles.tileValue, { color: '#FF0000', fontSize: tileHeight * 0.12 }]}>{orderStats.pending}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tile, { 
              backgroundColor: safeColors.paper,
              width: tileWidth,
              height: tileHeight,
            }]}
            onPress={() => handleTilePress('completed')}
            activeOpacity={0.7}
          >
            <Ionicons name="checkmark-circle-outline" size={tileHeight * 0.15} color={safeColors.accent} />
            <Text style={[styles.tileTitle, { color: safeColors.textPrimary, fontSize: tileHeight * 0.08 }]}>Completed</Text>
            <Text style={[styles.tileValue, { color: '#FF0000', fontSize: tileHeight * 0.12 }]}>{orderStats.completed}</Text>
          </TouchableOpacity>

          {/* Row 2 */}
          <TouchableOpacity
            style={[styles.tile, { 
              backgroundColor: safeColors.paper,
              width: tileWidth,
              height: tileHeight,
            }]}
            onPress={() => handleTilePress('inProgress')}
            activeOpacity={0.7}
          >
            <Ionicons name="bicycle-outline" size={tileHeight * 0.15} color={safeColors.accent} />
            <Text style={[styles.tileTitle, { color: safeColors.textPrimary, fontSize: tileHeight * 0.08 }]}>In Progress</Text>
            <Text style={[styles.tileValue, { color: '#FF0000', fontSize: tileHeight * 0.12 }]}>{orderStats.inProgress}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tile, { 
              backgroundColor: safeColors.paper,
              width: tileWidth,
              height: tileHeight,
            }]}
            onPress={() => handleTilePress('canceled')}
            activeOpacity={0.7}
          >
            <Ionicons name="close-circle-outline" size={tileHeight * 0.15} color={safeColors.accent} />
            <Text style={[styles.tileTitle, { color: safeColors.textPrimary, fontSize: tileHeight * 0.08 }]}>Canceled</Text>
            <Text style={[styles.tileValue, { color: '#FF0000', fontSize: tileHeight * 0.12 }]}>{orderStats.canceled}</Text>
          </TouchableOpacity>

          {/* Row 3 */}
          <TouchableOpacity
            style={[styles.tile, { 
              backgroundColor: safeColors.paper,
              width: tileWidth,
              height: tileHeight,
            }]}
            onPress={() => handleTilePress('cashAtHand')}
            activeOpacity={0.7}
          >
            <Ionicons name="cash-outline" size={tileHeight * 0.15} color={safeColors.accent} />
            <Text style={[styles.tileTitle, { color: safeColors.textPrimary, fontSize: tileHeight * 0.08 }]}>Cash At Hand</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tile, { 
              backgroundColor: safeColors.paper,
              width: tileWidth,
              height: tileHeight,
            }]}
            onPress={() => handleTilePress('payments')}
            activeOpacity={0.7}
          >
            <Ionicons name="receipt-outline" size={tileHeight * 0.15} color={safeColors.accent} />
            <Text style={[styles.tileTitle, { color: safeColors.textPrimary, fontSize: tileHeight * 0.08 }]}>Payments</Text>
          </TouchableOpacity>

          {/* Row 4 */}
          <TouchableOpacity
            style={[styles.tile, { 
              backgroundColor: safeColors.paper,
              width: tileWidth,
              height: tileHeight,
            }]}
            onPress={() => handleTilePress('savings')}
            activeOpacity={0.7}
          >
            <Ionicons name="wallet-outline" size={tileHeight * 0.15} color={safeColors.accent} />
            <Text style={[styles.tileTitle, { color: safeColors.textPrimary, fontSize: tileHeight * 0.08 }]}>My Savings</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tile, { 
              backgroundColor: safeColors.paper,
              width: tileWidth,
              height: tileHeight,
            }]}
            onPress={() => handleTilePress('notice')}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={tileHeight * 0.15} color={safeColors.accent} />
            <Text style={[styles.tileTitle, { color: safeColors.textPrimary, fontSize: tileHeight * 0.08 }]}>Notice</Text>
          </TouchableOpacity>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  contentContainer: {
    padding: 15,
    paddingTop: Platform.OS === 'ios' ? 10 : 15,
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
    padding: 12,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 12,
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
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  userPhone: {
    fontSize: 12,
  },
  shiftButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 90,
    alignItems: 'center',
  },
  shiftButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  tilesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    flex: 1,
  },
  tile: {
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tileTitle: {
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
  tileValue: {
    fontWeight: 'bold',
    marginTop: 4,
  },
  refreshOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
});

export default DashboardScreen;

