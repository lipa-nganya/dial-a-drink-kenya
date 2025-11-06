import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import io from 'socket.io-client';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import Snackbar from '../components/Snackbar';

const WalletScreen = ({ route, navigation }) => {
  const { phoneNumber } = route.params || {};
  const [wallet, setWallet] = useState(null);
  const [recentTips, setRecentTips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawPhone, setWithdrawPhone] = useState('');
  const [withdrawAmountError, setWithdrawAmountError] = useState('');
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarType, setSnackbarType] = useState('info');
  const { colors, isDarkMode } = useTheme();

  useEffect(() => {
    loadWalletData();
  }, []);

  // Re-validate withdraw amount when wallet data changes
  useEffect(() => {
    if (withdrawAmount && wallet) {
      validateWithdrawAmount(withdrawAmount);
    }
  }, [wallet]);

  // Set up socket connection for tip notifications
  useEffect(() => {
    let socket = null;
    
    const setupSocket = async () => {
      try {
        const phone = phoneNumber || await AsyncStorage.getItem('driver_phone');
        if (!phone) return;

        const driverResponse = await api.get(`/drivers/phone/${phone}`);
        if (!driverResponse.data?.id) return;

        const driverId = driverResponse.data.id;
        const apiBaseUrl = __DEV__ 
          ? 'http://localhost:5001' 
          : 'https://dialadrink-backend.onrender.com';
        
        socket = io(apiBaseUrl, {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionAttempts: 5
        });

        socket.emit('join-driver', { driverId });
        console.log('✅ WalletScreen: Socket connected for driver', driverId);

        socket.on('tip-received', (data) => {
          console.log('💰 Tip received in WalletScreen:', data);
          // Reload wallet data to show updated balance
          loadWalletData();
          // Show notification
          setSnackbarMessage(`Tip of KES ${data.tipAmount} received from ${data.customerName}!`);
          setSnackbarType('success');
          setSnackbarVisible(true);
        });

        // Listen for order status updates - when order is completed, update wallet
        socket.on('order-status-updated', (data) => {
          console.log('📦 Order status updated in WalletScreen:', data);
          // If order is completed, reload wallet to update amount on hold
          if (data.status === 'completed' && data.order?.driverId === driverId) {
            console.log('✅ Order completed, updating wallet to reflect available balance');
            loadWalletData();
          }
        });

        socket.on('connect_error', (error) => {
          console.error('❌ WalletScreen Socket connection error:', error);
        });
      } catch (error) {
        console.error('Error setting up socket in WalletScreen:', error);
      }
    };

    setupSocket();

    return () => {
      if (socket) {
        socket.disconnect();
        console.log('✅ WalletScreen: Socket disconnected');
      }
    };
  }, [phoneNumber]);

  const loadWalletData = async () => {
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
        // Load wallet data
        const walletResponse = await api.get(`/driver-wallet/${driverResponse.data.id}`);
        
        if (walletResponse.data.success) {
          setWallet(walletResponse.data.wallet);
          setRecentTips(walletResponse.data.recentTips || []);
          // Pre-populate withdraw phone with driver's phone
          setWithdrawPhone(driverResponse.data.phoneNumber || '');
        }
      }
    } catch (error) {
      console.error('Error loading wallet data:', error);
      setSnackbarMessage('Failed to load wallet data');
      setSnackbarType('error');
      setSnackbarVisible(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadWalletData();
  };

  const validateWithdrawAmount = (amount) => {
    if (!amount || amount.trim() === '') {
      setWithdrawAmountError('');
      return false;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setWithdrawAmountError('Please enter a valid amount');
      return false;
    }

    const availableBalance = wallet?.availableBalance ?? wallet?.balance ?? 0;
    if (numAmount > availableBalance) {
      setWithdrawAmountError(`Exceeds available balance (KES ${availableBalance.toFixed(2)})`);
      return false;
    }

    setWithdrawAmountError('');
    return true;
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      setWithdrawAmountError('Please enter a valid withdrawal amount');
      setSnackbarMessage('Please enter a valid withdrawal amount');
      setSnackbarType('error');
      setSnackbarVisible(true);
      return;
    }

    if (!withdrawPhone || withdrawPhone.trim().length < 9) {
      setSnackbarMessage('Please enter a valid phone number');
      setSnackbarType('error');
      setSnackbarVisible(true);
      return;
    }

    const amount = parseFloat(withdrawAmount);
    const availableBalance = wallet?.availableBalance ?? wallet?.balance ?? 0;
    if (amount > availableBalance) {
      setWithdrawAmountError(`Exceeds available balance (KES ${availableBalance.toFixed(2)})`);
      setSnackbarMessage(`Insufficient available balance. Available: KES ${availableBalance.toFixed(2)}`);
      setSnackbarType('error');
      setSnackbarVisible(true);
      return;
    }

    Alert.alert(
      'Confirm Withdrawal',
      `Withdraw KES ${amount.toFixed(2)} to ${withdrawPhone}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              setWithdrawing(true);
              const phone = phoneNumber || await AsyncStorage.getItem('driver_phone');
              const driverResponse = await api.get(`/drivers/phone/${phone}`);
              
              if (driverResponse.data && driverResponse.data.id) {
                const response = await api.post(`/driver-wallet/${driverResponse.data.id}/withdraw`, {
                  amount: amount,
                  phoneNumber: withdrawPhone
                });

                if (response.data.success) {
                  setSnackbarMessage(`Withdrawal of KES ${amount.toFixed(2)} initiated successfully`);
                  setSnackbarType('success');
                  setSnackbarVisible(true);
                  setWithdrawAmount('');
                  // Refresh wallet data
                  await loadWalletData();
                } else {
                  setSnackbarMessage(response.data.error || 'Failed to initiate withdrawal');
                  setSnackbarType('error');
                  setSnackbarVisible(true);
                }
              }
            } catch (error) {
              console.error('Withdrawal error:', error);
              setSnackbarMessage(error.response?.data?.error || 'Failed to initiate withdrawal');
              setSnackbarType('error');
              setSnackbarVisible(true);
            } finally {
              setWithdrawing(false);
            }
          }
        }
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
        <Text style={[styles.loadingText, { color: safeColors.textSecondary }]}>Loading wallet...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Snackbar
        visible={snackbarVisible}
        message={snackbarMessage}
        type={snackbarType}
        duration={5000}
        onClose={() => setSnackbarVisible(false)}
      />
      <ScrollView
        style={[styles.container, { backgroundColor: safeColors.background }]}
        contentContainerStyle={{ paddingBottom: 80 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={safeColors.accent} />
        }
      >
        <View style={styles.content}>
          {/* Wallet Balance Card */}
          <View style={[styles.balanceCard, { backgroundColor: safeColors.paper }]}>
            <Text style={[styles.balanceLabel, { color: safeColors.textSecondary }]}>Available Balance</Text>
            <Text style={[styles.balanceAmount, { color: safeColors.accentText }]}>
              KES {wallet?.availableBalance?.toFixed(2) || wallet?.balance?.toFixed(2) || '0.00'}
            </Text>
            {wallet?.amountOnHold > 0 && (
              <View style={[styles.onHoldContainer, { borderTopColor: safeColors.border }]}>
                <Text style={[styles.onHoldLabel, { color: safeColors.textSecondary }]}>Amount on Hold:</Text>
                <Text style={[styles.onHoldAmount, { color: '#FFC107' }]}>
                  KES {wallet.amountOnHold.toFixed(2)}
                </Text>
              </View>
            )}
            {wallet?.amountOnHold > 0 && (
              <Text style={[styles.onHoldNote, { color: safeColors.textSecondary }]}>
                Tips for orders not yet completed
              </Text>
            )}
          </View>

          {/* Tips Summary */}
          <View style={[styles.summaryCard, { backgroundColor: safeColors.paper }]}>
            <Text style={[styles.sectionTitle, { color: safeColors.accentText }]}>Tips Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: safeColors.textSecondary }]}>Total Tips Received:</Text>
              <Text style={[styles.summaryValue, { color: safeColors.accentText }]}>
                KES {wallet?.totalTipsReceived?.toFixed(2) || '0.00'}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: safeColors.textSecondary }]}>Number of Tips:</Text>
              <Text style={[styles.summaryValue, { color: safeColors.textPrimary }]}>
                {wallet?.totalTipsCount || 0}
              </Text>
            </View>
          </View>

          {/* Withdrawal Section */}
          <View style={[styles.withdrawCard, { backgroundColor: safeColors.paper }]}>
            <Text style={[styles.sectionTitle, { color: safeColors.accentText }]}>Withdraw to M-Pesa</Text>
            
            <Text style={[styles.inputLabel, { color: safeColors.textSecondary }]}>Amount (KES)</Text>
            <TextInput
              style={[styles.input, { 
                backgroundColor: safeColors.background, 
                borderColor: withdrawAmountError ? '#FF3366' : safeColors.border,
                borderWidth: withdrawAmountError ? 2 : 1,
                color: safeColors.textPrimary 
              }]}
              value={withdrawAmount}
              onChangeText={(text) => {
                setWithdrawAmount(text);
                validateWithdrawAmount(text);
              }}
              placeholder="Enter amount"
              placeholderTextColor={safeColors.textSecondary}
              keyboardType="numeric"
              editable={!withdrawing}
            />
            {withdrawAmountError ? (
              <Text style={[styles.errorText, { color: '#FF3366' }]}>
                {withdrawAmountError}
              </Text>
            ) : null}

            <Text style={[styles.inputLabel, { color: safeColors.textSecondary, marginTop: 12 }]}>Phone Number</Text>
            <TextInput
              style={[styles.input, { 
                backgroundColor: safeColors.background, 
                borderColor: safeColors.border,
                color: safeColors.textPrimary 
              }]}
              value={withdrawPhone}
              onChangeText={setWithdrawPhone}
              placeholder="Enter M-Pesa phone number"
              placeholderTextColor={safeColors.textSecondary}
              keyboardType="phone-pad"
              editable={!withdrawing}
            />

            <TouchableOpacity
              style={[styles.withdrawButton, { backgroundColor: safeColors.accent }]}
              onPress={handleWithdraw}
              disabled={withdrawing || !withdrawAmount || !withdrawPhone}
            >
              {withdrawing ? (
                <ActivityIndicator color={isDarkMode ? '#0D0D0D' : '#FFFFFF'} />
              ) : (
                <Text style={[styles.withdrawButtonText, { color: isDarkMode ? '#0D0D0D' : '#FFFFFF' }]}>
                  Withdraw
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Recent Tips */}
          <View style={[styles.tipsCard, { backgroundColor: safeColors.paper }]}>
            <Text style={[styles.sectionTitle, { color: safeColors.accentText }]}>Recent Tips</Text>
            {recentTips.length === 0 ? (
              <Text style={[styles.emptyText, { color: safeColors.textSecondary }]}>No tips received yet</Text>
            ) : (
              recentTips.map((tip) => (
                <View key={tip.id} style={[styles.tipItem, { borderBottomColor: safeColors.border }]}>
                  <View style={styles.tipItemLeft}>
                    <Text style={[styles.tipAmount, { color: safeColors.accentText }]}>
                      KES {tip.amount?.toFixed(2)}
                    </Text>
                    <Text style={[styles.tipOrder, { color: safeColors.textSecondary }]}>
                      Order #{tip.orderNumber}
                    </Text>
                    {tip.customerName && (
                      <Text style={[styles.tipCustomer, { color: safeColors.textSecondary }]}>
                        {tip.customerName}
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.tipDate, { color: safeColors.textSecondary }]}>
                    {formatDate(tip.date)}
                  </Text>
                </View>
              ))
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
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  balanceCard: {
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  balanceLabel: {
    fontSize: 16,
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: 'bold',
  },
  summaryCard: {
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  withdrawCard: {
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  withdrawButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  withdrawButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  tipsCard: {
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },
  tipItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  tipItemLeft: {
    flex: 1,
  },
  tipAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  tipOrder: {
    fontSize: 12,
    marginBottom: 2,
  },
  tipCustomer: {
    fontSize: 12,
  },
  tipDate: {
    fontSize: 11,
    textAlign: 'right',
  },
  onHoldContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  onHoldLabel: {
    fontSize: 14,
  },
  onHoldAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  onHoldNote: {
    fontSize: 11,
    marginTop: 4,
    fontStyle: 'italic',
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: 8,
  },
});

export default WalletScreen;

