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
import api from '../services/api';

const WalletScreen = ({ navigation }) => {
  const [walletData, setWalletData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [driverId, setDriverId] = useState(null);

  useEffect(() => {
    loadDriverId();
  }, []);

  useEffect(() => {
    if (driverId) {
      loadWalletData();
    }
  }, [driverId]);

  const loadDriverId = async () => {
    try {
      const phone = await AsyncStorage.getItem('driver_phone');
      if (phone) {
        const driverResponse = await api.get(`/drivers/phone/${phone}`);
        if (driverResponse.data && driverResponse.data.id) {
          setDriverId(driverResponse.data.id);
        }
      }
    } catch (error) {
      console.error('Error loading driver ID:', error);
      Alert.alert('Error', 'Failed to load driver information');
    }
  };

  const loadWalletData = async () => {
    try {
      const response = await api.get(`/driver-wallet/${driverId}`);
      if (response.data && response.data.success) {
        setWalletData(response.data);
      }
    } catch (error) {
      console.error('Error loading wallet data:', error);
      Alert.alert('Error', 'Failed to load wallet information');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadWalletData();
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

  const formatAmount = (amount) => {
    return `KES ${parseFloat(amount || 0).toFixed(2)}`;
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#00E0B8" />
        <Text style={styles.loadingText}>Loading wallet...</Text>
      </View>
    );
  }

  if (!walletData) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>Failed to load wallet data</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadWalletData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { wallet, recentTips, recentDeliveryPayments, cashSettlements, recentWithdrawals } = walletData;

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00E0B8" />
      }
    >
      <View style={styles.content}>
        <Text style={styles.title}>My Wallet</Text>

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceAmount}>{formatAmount(wallet.availableBalance)}</Text>
          {wallet.amountOnHold > 0 && (
            <View style={styles.onHoldContainer}>
              <Text style={styles.onHoldLabel}>On Hold:</Text>
              <Text style={styles.onHoldAmount}>{formatAmount(wallet.amountOnHold)}</Text>
            </View>
          )}
          <Text style={styles.totalBalanceLabel}>Total Balance: {formatAmount(wallet.balance)}</Text>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Tips</Text>
            <Text style={styles.statValue}>{formatAmount(wallet.totalTipsReceived)}</Text>
            <Text style={styles.statCount}>{wallet.totalTipsCount} tips</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Delivery Pay</Text>
            <Text style={styles.statValue}>{formatAmount(wallet.totalDeliveryPay)}</Text>
            <Text style={styles.statCount}>{wallet.totalDeliveryPayCount} deliveries</Text>
          </View>
        </View>

        {/* Recent Tips */}
        {recentTips && recentTips.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Tips</Text>
            {recentTips.slice(0, 5).map((tip) => (
              <View key={tip.id} style={styles.transactionCard}>
                <View style={styles.transactionHeader}>
                  <Text style={styles.transactionType}>💵 Tip</Text>
                  <Text style={styles.transactionAmount}>+{formatAmount(tip.amount)}</Text>
                </View>
                <Text style={styles.transactionDetail}>Order #{tip.orderNumber}</Text>
                {tip.customerName && (
                  <Text style={styles.transactionDetail}>{tip.customerName}</Text>
                )}
                <Text style={styles.transactionDate}>{formatDate(tip.date)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Recent Delivery Payments */}
        {recentDeliveryPayments && recentDeliveryPayments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Delivery Payments</Text>
            {recentDeliveryPayments.slice(0, 5).map((payment) => (
              <View key={payment.id} style={styles.transactionCard}>
                <View style={styles.transactionHeader}>
                  <Text style={styles.transactionType}>🚚 Delivery Pay</Text>
                  <Text style={styles.transactionAmount}>+{formatAmount(payment.amount)}</Text>
                </View>
                <Text style={styles.transactionDetail}>Order #{payment.orderNumber}</Text>
                {payment.customerName && (
                  <Text style={styles.transactionDetail}>{payment.customerName}</Text>
                )}
                <Text style={styles.transactionDate}>{formatDate(payment.date)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Cash Settlements */}
        {cashSettlements && cashSettlements.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cash Settlements</Text>
            {cashSettlements.slice(0, 5).map((settlement) => (
              <View key={settlement.id} style={styles.transactionCard}>
                <View style={styles.transactionHeader}>
                  <Text style={styles.transactionType}>💳 Cash Settlement</Text>
                  <Text style={[styles.transactionAmount, styles.debitAmount]}>
                    -{formatAmount(settlement.amount)}
                  </Text>
                </View>
                <Text style={styles.transactionDetail}>Order #{settlement.orderNumber}</Text>
                {settlement.customerName && (
                  <Text style={styles.transactionDetail}>{settlement.customerName}</Text>
                )}
                <Text style={styles.transactionDate}>{formatDate(settlement.date)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Recent Withdrawals */}
        {recentWithdrawals && recentWithdrawals.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Withdrawals</Text>
            {recentWithdrawals.slice(0, 5).map((withdrawal) => (
              <View key={withdrawal.id} style={styles.transactionCard}>
                <View style={styles.transactionHeader}>
                  <Text style={styles.transactionType}>📤 Withdrawal</Text>
                  <Text style={[styles.transactionAmount, styles.debitAmount]}>
                    -{formatAmount(Math.abs(withdrawal.amount))}
                  </Text>
                </View>
                <Text style={styles.transactionDetail}>To: {withdrawal.phoneNumber}</Text>
                <Text style={styles.transactionDetail}>
                  Status: {withdrawal.status} / {withdrawal.paymentStatus}
                </Text>
                {withdrawal.receiptNumber && (
                  <Text style={styles.transactionDetail}>Receipt: {withdrawal.receiptNumber}</Text>
                )}
                <Text style={styles.transactionDate}>{formatDate(withdrawal.date)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Empty State */}
        {(!recentTips || recentTips.length === 0) &&
         (!recentDeliveryPayments || recentDeliveryPayments.length === 0) &&
         (!cashSettlements || cashSettlements.length === 0) &&
         (!recentWithdrawals || recentWithdrawals.length === 0) && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No transactions yet</Text>
          </View>
        )}
      </View>
    </ScrollView>
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
  errorText: {
    color: '#EF5350',
    fontSize: 16,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#00E0B8',
    padding: 12,
    borderRadius: 8,
    paddingHorizontal: 24,
  },
  retryButtonText: {
    color: '#0D0D0D',
    fontSize: 16,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#00E0B8',
    marginBottom: 30,
    textAlign: 'center',
  },
  balanceCard: {
    backgroundColor: '#121212',
    padding: 24,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#00E0B8',
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 16,
    color: '#B0B0B0',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#00E0B8',
    marginBottom: 12,
  },
  onHoldContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  onHoldLabel: {
    fontSize: 14,
    color: '#B0B0B0',
    marginRight: 8,
  },
  onHoldAmount: {
    fontSize: 14,
    color: '#FFA726',
    fontWeight: '600',
  },
  totalBalanceLabel: {
    fontSize: 14,
    color: '#B0B0B0',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#B0B0B0',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#00E0B8',
    marginBottom: 4,
  },
  statCount: {
    fontSize: 12,
    color: '#B0B0B0',
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#00E0B8',
    marginBottom: 15,
  },
  transactionCard: {
    backgroundColor: '#121212',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  transactionType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F5F5F5',
  },
  transactionAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00E0B8',
  },
  debitAmount: {
    color: '#FFA726',
  },
  transactionDetail: {
    fontSize: 14,
    color: '#B0B0B0',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  emptyState: {
    backgroundColor: '#121212',
    padding: 30,
    borderRadius: 8,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#B0B0B0',
    textAlign: 'center',
  },
});

export default WalletScreen;

