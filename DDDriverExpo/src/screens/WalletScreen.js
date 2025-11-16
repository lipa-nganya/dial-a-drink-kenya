import React, { useState, useEffect, useCallback, useMemo } from 'react';
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

const WalletScreen = ({ route }) => {
  const { phoneNumber } = route.params || {};
  const [wallet, setWallet] = useState(null);
  const [recentTips, setRecentTips] = useState([]);
  const [recentDeliveryPayments, setRecentDeliveryPayments] = useState([]);
  const [recentCashSettlements, setRecentCashSettlements] = useState([]);
  const [recentWithdrawals, setRecentWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawPhone, setWithdrawPhone] = useState('');
  const [withdrawAmountError, setWithdrawAmountError] = useState('');
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarType, setSnackbarType] = useState('info');
  const [activeTab, setActiveTab] = useState('summary');
  const [summaryTab, setSummaryTab] = useState('delivery');
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
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

  const loadWalletData = useCallback(async () => {
    try {
      setLoading(true);
      const phone = phoneNumber || (await AsyncStorage.getItem('driver_phone'));

      if (!phone) {
        console.error('No phone number found');
        setWallet(null);
        setRecentTips([]);
        setRecentDeliveryPayments([]);
        setRecentCashSettlements([]);
        setRecentWithdrawals([]);
        return;
      }

      const driverResponse = await api.get(`/drivers/phone/${phone}`);

      if (driverResponse.data && driverResponse.data.id) {
        const walletResponse = await api.get(`/driver-wallet/${driverResponse.data.id}`);

        if (walletResponse.data.success) {
          setWallet(walletResponse.data.wallet);
          setRecentTips(walletResponse.data.recentTips || []);
          setRecentDeliveryPayments(walletResponse.data.recentDeliveryPayments || []);
          setRecentCashSettlements(walletResponse.data.cashSettlements || []);
          setRecentWithdrawals(walletResponse.data.recentWithdrawals || []);
          setWithdrawPhone(driverResponse.data.phoneNumber || '');
        }
      }
    } catch (error) {
      console.error('Error loading wallet data:', error);
      setSnackbarMessage('Failed to load wallet data');
      setSnackbarType('error');
      setSnackbarVisible(true);
      setRecentCashSettlements([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [phoneNumber]);

  useEffect(() => {
    loadWalletData();
  }, [loadWalletData]);

  const validateWithdrawAmount = useCallback(
    (amount) => {
      if (!amount || amount.trim() === '') {
        setWithdrawAmountError('');
        return false;
      }

      const numAmount = parseFloat(amount);
      if (Number.isNaN(numAmount) || numAmount <= 0) {
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
    },
    [wallet]
  );

  useEffect(() => {
    if (withdrawAmount && wallet) {
      validateWithdrawAmount(withdrawAmount);
    }
  }, [wallet, withdrawAmount, validateWithdrawAmount]);

  useEffect(() => {
    if (!showWithdrawForm) {
      setWithdrawAmount('');
      setWithdrawAmountError('');
    }
  }, [showWithdrawForm]);

  useEffect(() => {
    let socket = null;

    const setupSocket = async () => {
      try {
        const phone = phoneNumber || (await AsyncStorage.getItem('driver_phone'));
        if (!phone) return;

        const driverResponse = await api.get(`/drivers/phone/${phone}`);
        if (!driverResponse.data?.id) return;

        const driverId = driverResponse.data.id;
        // Use same API URL resolution logic as api.js
        // Import api to get the base URL
        const apiBaseUrl = api.defaults.baseURL.replace('/api', '');
        console.log('🔌 Wallet Screen Socket URL:', apiBaseUrl);

        socket = io(apiBaseUrl, {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionAttempts: 5,
        });

        socket.emit('join-driver', { driverId });

        socket.on('tip-received', (data) => {
          loadWalletData();
          setSnackbarMessage(`Tip of KES ${data.tipAmount} received from ${data.customerName}!`);
          setSnackbarType('success');
          setSnackbarVisible(true);
        });

        socket.on('delivery-pay-received', (data) => {
          loadWalletData();
          setSnackbarMessage(`Delivery fee of KES ${data.amount} received for Order #${data.orderId}!`);
          setSnackbarType('success');
          setSnackbarVisible(true);
        });

        socket.on('order-status-updated', (data) => {
          if (data.status === 'completed' && data.order?.driverId === driverId) {
            loadWalletData();
          }
        });

        socket.on('connect_error', (error) => {
          console.error('WalletScreen Socket connection error:', error);
        });
      } catch (error) {
        console.error('Error setting up socket in WalletScreen:', error);
      }
    };

    setupSocket();

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [phoneNumber, loadWalletData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadWalletData();
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

    Alert.alert('Confirm Withdrawal', `Withdraw KES ${amount.toFixed(2)} to ${withdrawPhone}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          try {
            setWithdrawing(true);
            const phone = phoneNumber || (await AsyncStorage.getItem('driver_phone'));
            const driverResponse = await api.get(`/drivers/phone/${phone}`);

            if (driverResponse.data && driverResponse.data.id) {
              const response = await api.post(`/driver-wallet/${driverResponse.data.id}/withdraw`, {
                amount,
                phoneNumber: withdrawPhone,
              });

              if (response.data.success) {
                setSnackbarMessage(`Withdrawal of KES ${amount.toFixed(2)} initiated successfully`);
                setSnackbarType('success');
                setSnackbarVisible(true);
                setShowWithdrawForm(false);
                setWithdrawAmount('');
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
        },
      },
    ]);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const displayBalance = wallet ? parseFloat(wallet.balance ?? wallet.availableBalance ?? 0) : 0;
  const availableToWithdraw = wallet ? parseFloat(wallet.availableBalance ?? wallet.balance ?? 0) : 0;

  const combinedTransactions = useMemo(() => {
    const deliveries = (recentDeliveryPayments || []).map((tx) => {
      const amountNumeric = parseFloat(tx.amount) || 0;
      const isDebit = amountNumeric < 0;
      const direction = isDebit ? 'debit' : 'credit';
      return {
        id: `delivery-${tx.id}`,
        type: isDebit ? 'delivery_debit' : 'delivery',
        amount: amountNumeric,
        date: tx.date,
        status: tx.status || 'completed',
        direction,
        reference: tx.orderNumber || tx.orderId,
        customerName: tx.customerName,
        notes: tx.notes || '',
      };
    });

    const cashSettlements = (recentCashSettlements || []).map((tx) => ({
      id: `cash-${tx.id}`,
      type: 'cash_settlement',
      amount: -Math.abs(parseFloat(tx.amount) || 0),
      date: tx.date,
      status: tx.status || 'completed',
      direction: 'debit',
      reference: tx.orderNumber || tx.orderId,
      customerName: tx.customerName,
      notes: tx.notes || '',
    }));

    const tips = (recentTips || []).map((tx) => ({
      id: `tip-${tx.id}`,
      type: 'tip',
      amount: parseFloat(tx.amount) || 0,
      date: tx.date,
      status: 'completed',
      direction: 'credit',
      reference: tx.orderNumber || tx.orderId,
      customerName: tx.customerName,
      notes: tx.notes || '',
    }));

    const withdrawals = (recentWithdrawals || []).map((tx) => ({
      id: `withdrawal-${tx.id}`,
      type: 'withdrawal',
      amount: parseFloat(tx.amount) || 0,
      date: tx.date,
      status: tx.status || tx.paymentStatus || 'pending',
      reference: tx.phoneNumber,
      notes: tx.notes || '',
    }));

    return [...deliveries, ...cashSettlements, ...tips, ...withdrawals].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );
  }, [recentDeliveryPayments, recentCashSettlements, recentTips, recentWithdrawals]);

  const getTransactionLabel = (type) => {
    switch (type) {
      case 'delivery':
        return 'Delivery Fee Payment';
      case 'delivery_debit':
        return 'Delivery Fee Settlement';
      case 'cash_settlement':
        return 'Cash Received';
      case 'tip':
        return 'Tip';
      case 'withdrawal':
        return 'Withdrawal';
      default:
        return 'Transaction';
    }
  };

  const getTransactionColor = (type) => {
    switch (type) {
      case 'withdrawal':
        return '#FF6B6B';
      case 'delivery_debit':
      case 'cash_settlement':
        return '#FF6B6B';
      case 'delivery':
        return safeColors.accentText;
      case 'tip':
      default:
        return safeColors.accentText;
    }
  };

  const listCardBackground = isDarkMode ? '#121212' : safeColors.paper;
  const listItemDivider = isDarkMode ? '#1F1F1F' : safeColors.border;

  const renderSummaryList = (items, type, cardBackground = listCardBackground) => {
    const isDelivery = type === 'delivery';
    const emptyMessage = isDelivery ? 'No delivery payments yet' : 'No tips received yet';

    if (!items || items.length === 0) {
      return (
        <View style={[styles.emptyStateCard, { backgroundColor: cardBackground }]}> 
          <Text style={[styles.emptyStateText, { color: safeColors.textSecondary }]}>{emptyMessage}</Text>
        </View>
      );
    }

    return (
      <View style={[styles.listCard, { backgroundColor: cardBackground }]}> 
        {items.map((item) => {
          const amountNumeric = parseFloat(item.amount) || 0;
          const isDebit = amountNumeric < 0;
          const displayAmount = Math.abs(amountNumeric).toFixed(2);
          const label = isDelivery ? 'Delivery Fee Payment' : 'Tip';

          return (
          <View key={`${type}-${item.id}`} style={[styles.listItem, { borderBottomColor: listItemDivider }]}> 
            <View style={styles.listItemLeft}>
              <Text style={[styles.listLabel, { color: safeColors.textSecondary }]}> 
                {label}
              </Text>
              <Text style={[styles.listAmount, { color: isDebit ? '#FF6B6B' : safeColors.accentText }]}> 
                {isDebit ? '- ' : ''}KES {displayAmount}
              </Text>
              {item.orderNumber || item.orderId ? (
                <Text style={[styles.listMeta, { color: safeColors.textSecondary }]}> 
                  {`Order #${item.orderNumber || item.orderId}`}
                </Text>
              ) : null}
              {item.customerName ? (
                <Text style={[styles.listMeta, { color: safeColors.textSecondary }]}> 
                  {item.customerName}
                </Text>
              ) : null}
              {item.notes ? (
                <Text style={[styles.listMeta, { color: safeColors.textSecondary }]} numberOfLines={1}>
                  {item.notes}
                </Text>
              ) : null}
            </View>
            <Text style={[styles.listDate, { color: safeColors.textSecondary }]}>{formatDate(item.date)}</Text>
          </View>
        );
        })}
      </View>
    );
  };

  const summaryCardBackground = isDarkMode ? '#121212' : safeColors.paper;
  const tileBackground = isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';

  const renderSummarySection = () => (
    <>
      <View style={[styles.balanceCard, { backgroundColor: summaryCardBackground }]}> 
        <Text style={[styles.balanceLabel, { color: safeColors.textSecondary }]}>Total Wallet Balance</Text>
        <Text style={[styles.balanceAmount, { color: safeColors.accentText }]}> 
          KES {displayBalance.toFixed(2)}
        </Text>
        <Text style={[styles.balanceSubtitle, { color: safeColors.textSecondary }]}> 
          Includes completed delivery payments and tips
        </Text>
        <Text style={[styles.secondaryInfo, { color: safeColors.textSecondary }]}> 
          Available to withdraw: KES {availableToWithdraw.toFixed(2)}
        </Text>

        <View style={styles.balanceBreakdown}>
          <View
            style={[styles.breakdownBox, {
              borderColor: safeColors.border,
              backgroundColor: tileBackground,
            }]}
          >
            <Text style={[styles.breakdownLabel, { color: safeColors.textSecondary }]}>Delivery Payments</Text>
            <Text style={[styles.breakdownValue, { color: safeColors.accentText }]}> 
              KES {(wallet?.totalDeliveryPay || 0).toFixed(2)}
            </Text>
            <Text style={[styles.breakdownLabel, { color: safeColors.textSecondary }]}> 
              {wallet?.totalDeliveryPayCount || 0} deliveries
            </Text>
          </View>
          <View
            style={[styles.breakdownBox, {
              borderColor: safeColors.border,
              backgroundColor: tileBackground,
            }]}
          >
            <Text style={[styles.breakdownLabel, { color: safeColors.textSecondary }]}>Tips Received</Text>
            <Text style={[styles.breakdownValue, { color: safeColors.accentText }]}> 
              KES {(wallet?.totalTipsReceived || 0).toFixed(2)}
            </Text>
            <Text style={[styles.breakdownLabel, { color: safeColors.textSecondary }]}> 
              {wallet?.totalTipsCount || 0} tips
            </Text>
          </View>
        </View>

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
            Tips for orders not yet completed are released once the order is completed
          </Text>
        )}

        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: safeColors.accent }]}
          onPress={() => setShowWithdrawForm((prev) => !prev)}
        >
          <Text style={[styles.primaryButtonText, { color: isDarkMode ? '#0D0D0D' : '#0D0D0D' }]}> 
            {showWithdrawForm ? 'Hide Withdraw Form' : 'Withdraw Funds'}
          </Text>
        </TouchableOpacity>

        {showWithdrawForm && (
          <View style={[styles.withdrawForm, { backgroundColor: isDarkMode ? '#101010' : safeColors.paper }]}>
            <Text style={[styles.inputLabel, { color: safeColors.textSecondary }]}>Amount (KES)</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: isDarkMode ? '#0D0D0D' : safeColors.background,
                  borderColor: withdrawAmountError ? '#FF3366' : safeColors.border,
                  borderWidth: withdrawAmountError ? 2 : 1,
                  color: safeColors.textPrimary,
                },
              ]}
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
              <Text style={[styles.errorText, { color: '#FF3366' }]}>{withdrawAmountError}</Text>
            ) : null}

            <Text style={[styles.inputLabel, { color: safeColors.textSecondary }]}>Phone Number</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: isDarkMode ? '#0D0D0D' : safeColors.background,
                  borderColor: safeColors.border,
                  color: safeColors.textPrimary,
                },
              ]}
              value={withdrawPhone}
              onChangeText={setWithdrawPhone}
              placeholder="Enter M-Pesa phone number"
              placeholderTextColor={safeColors.textSecondary}
              keyboardType="phone-pad"
              editable={!withdrawing}
            />

            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: safeColors.accent }]}
              onPress={handleWithdraw}
              disabled={withdrawing}
            >
              {withdrawing ? (
                <ActivityIndicator color={isDarkMode ? '#0D0D0D' : '#FFFFFF'} />
              ) : (
                <Text
                  style={[styles.submitButtonText, { color: isDarkMode ? '#0D0D0D' : '#0D0D0D' }]}
                >
                  Submit Withdrawal
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowWithdrawForm(false)}>
              <Text style={[styles.cancelLink, { color: safeColors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

        <View
          style={[
            styles.summaryTabsContainer,
            {
              borderColor: safeColors.border,
              backgroundColor: summaryCardBackground,
            },
          ]}
        >
        {[
          { key: 'delivery', label: 'Delivery Payments' },
          { key: 'tips', label: 'Tips' },
        ].map((tab) => {
          const isActive = summaryTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.summaryTabButton,
                {
                  backgroundColor: isActive
                    ? safeColors.accent
                    : 'transparent',
                },
              ]}
              onPress={() => setSummaryTab(tab.key)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.summaryTabLabel,
                  {
                    color: isActive
                      ? isDarkMode
                        ? '#0D0D0D'
                        : '#0D0D0D'
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

      <View
        style={[styles.overtimeCard, { backgroundColor: summaryCardBackground, borderColor: safeColors.border }]}
      >
        <Text style={[styles.overtimeTitle, { color: safeColors.accentText }]}> 
          {summaryTab === 'delivery' ? 'Delivery Payments Overtime' : 'Tips Overtime'}
        </Text>
        <Text style={[styles.overtimeSubtitle, { color: safeColors.textSecondary }]}> 
          Total {summaryTab === 'delivery' ? 'Payments Received' : 'Tips Received'}
        </Text>
        <Text style={[styles.overtimeAmount, { color: safeColors.accentText }]}> 
          KES {summaryTab === 'delivery'
            ? (wallet?.totalDeliveryPay || 0).toFixed(2)
            : (wallet?.totalTipsReceived || 0).toFixed(2)}
        </Text>
        <Text style={[styles.overtimeCount, { color: safeColors.textSecondary }]}> 
          {summaryTab === 'delivery'
            ? `${wallet?.totalDeliveryPayCount || 0} payments`
            : `${wallet?.totalTipsCount || 0} tips`}
        </Text>
      </View>

      {renderSummaryList(summaryTab === 'delivery' ? recentDeliveryPayments : recentTips, summaryTab, summaryCardBackground)}
    </>
  );

  const renderTransactionsSection = () => (
    <View>
      {combinedTransactions.length === 0 ? (
        <View style={[styles.emptyStateCard, { backgroundColor: listCardBackground }]}> 
          <Text style={[styles.emptyStateText, { color: safeColors.textSecondary }]}> 
            No wallet transactions yet
          </Text>
        </View>
      ) : (
        combinedTransactions.map((tx) => {
          const amountColor = getTransactionColor(tx.type);
          const isDebit = tx.amount < 0 || tx.type === 'delivery_debit' || tx.type === 'withdrawal' || tx.direction === 'debit' || tx.type === 'cash_settlement';
          const statusLabel = tx.direction
            ? tx.direction
            : tx.status
            ? tx.status
            : null;
          const statusColor = tx.direction
            ? tx.direction === 'credit'
              ? '#32CD32'
              : '#FF6B6B'
            : tx.status
            ? tx.status.toLowerCase() === 'completed' || tx.status.toLowerCase() === 'paid'
              ? '#32CD32'
              : tx.status.toLowerCase() === 'failed'
              ? '#FF6B6B'
              : '#FFA500'
            : safeColors.textSecondary;
          return (
            <View
              key={tx.id}
              style={[
                styles.transactionCard,
                {
                  backgroundColor: listCardBackground,
                  borderColor: listItemDivider,
                },
              ]}
            >
              <View style={styles.transactionCardHeader}>
                <View
                  style={[styles.transactionTypeBadge, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]}
                >
                  <Text style={[styles.transactionTypeText, { color: amountColor }]}>
                    {getTransactionLabel(tx.type)}
                  </Text>
                </View>
                <Text style={[styles.transactionAmount, { color: amountColor }]}>
                  {isDebit ? '- ' : ''}KES {Math.abs(tx.amount).toFixed(2)}
                </Text>
              </View>
              {tx.reference || tx.customerName ? (
                <Text style={[styles.transactionMeta, { color: safeColors.textSecondary }]}> 
                  {[tx.reference ? `Ref: ${tx.reference}` : null, tx.customerName]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              ) : null}
              {tx.notes ? (
                <Text style={[styles.transactionMeta, { color: safeColors.textSecondary }]} numberOfLines={2}>
                  {tx.notes}
                </Text>
              ) : null}
              <View style={styles.transactionFooter}>
                <Text style={[styles.transactionDate, { color: safeColors.textSecondary }]}>{formatDate(tx.date)}</Text>
                {statusLabel ? (
                  <Text
                    style={[
                      styles.transactionStatus,
                      {
                        color: statusColor,
                      },
                    ]}
                  >
                    {statusLabel.toUpperCase()}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: safeColors.background }]}> 
        <ActivityIndicator size="large" color={safeColors.accent} />
        <Text style={[styles.loadingText, { color: safeColors.textSecondary }]}>Loading wallet...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: safeColors.background }}>
      <Snackbar
        visible={snackbarVisible}
        message={snackbarMessage}
        type={snackbarType}
        duration={5000}
        onClose={() => setSnackbarVisible(false)}
      />

      <View
        style={[
          styles.topTabContainer,
          {
            borderColor: safeColors.border,
            backgroundColor: safeColors.paper,
          },
        ]}
      >
        {[
          { key: 'summary', label: 'Wallet Summary' },
          { key: 'transactions', label: 'Wallet Transactions' },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.topTabButton,
                {
                  backgroundColor: isActive
                    ? safeColors.accent
                    : 'transparent',
                },
              ]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.topTabLabel,
                  {
                    color: isActive
                      ? '#0D0D0D'
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

      <ScrollView
        style={[styles.container, { backgroundColor: safeColors.background }]}
        contentContainerStyle={{ paddingBottom: 80 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={safeColors.accent} />
        }
      >
        <View style={styles.content}>
          {activeTab === 'summary' ? renderSummarySection() : renderTransactionsSection()}
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
  topTabContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
    overflow: 'hidden',
  },
  topTabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTabLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  balanceCard: {
    borderRadius: 12,
    padding: 24,
    alignItems: 'flex-start',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
  },
  balanceLabel: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '500',
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: 'bold',
  },
  balanceSubtitle: {
    fontSize: 12,
    marginTop: 6,
  },
  secondaryInfo: {
    fontSize: 13,
    marginTop: 12,
  },
  balanceBreakdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    width: '100%',
  },
  breakdownBox: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginHorizontal: 4,
  },
  breakdownLabel: {
    fontSize: 12,
    marginBottom: 6,
  },
  breakdownValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  primaryButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  withdrawForm: {
    width: '100%',
    marginTop: 20,
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
  submitButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  cancelLink: {
    marginTop: 12,
    textAlign: 'center',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  summaryTabsContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 10,
    padding: 4,
    marginTop: 16,
    marginBottom: 12,
  },
  summaryTabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  summaryTabLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  listCard: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 20,
  },
  overtimeCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 18,
    marginBottom: 16,
  },
  overtimeTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  overtimeSubtitle: {
    fontSize: 12,
    marginBottom: 4,
  },
  overtimeAmount: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  overtimeCount: {
    fontSize: 12,
    marginTop: 8,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  listItemLeft: {
    flex: 1,
    marginRight: 12,
  },
  listLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  listAmount: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  listMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  listDate: {
    fontSize: 11,
    minWidth: 90,
    textAlign: 'right',
  },
  emptyStateCard: {
    borderRadius: 10,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyStateText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  onHoldContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    width: '100%',
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
    marginTop: 6,
    fontStyle: 'italic',
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  transactionCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  transactionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  transactionTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  transactionTypeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  transactionMeta: {
    fontSize: 13,
    marginBottom: 4,
  },
  transactionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  transactionDate: {
    fontSize: 12,
  },
  transactionStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default WalletScreen;

