import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  IconButton,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Grid
} from '@mui/material';
import {
  ArrowBack,
  LocalShipping,
  AttachMoney,
  Assessment
} from '@mui/icons-material';
import { useTheme } from '../../contexts/ThemeContext';
import { api } from '../../services/api';
import { getOrderStatusChipProps, getPaymentStatusChipProps } from '../../utils/chipStyles';

const RiderDetails = () => {
  const { riderId } = useParams();
  const navigate = useNavigate();
  const { colors } = useTheme();
  const [rider, setRider] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    totalEarnings: 0,
    balanceOwed: 0
  });

  useEffect(() => {
    fetchRiderDetails();
  }, [riderId]);

  const fetchRiderDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch rider info
      const riderResponse = await api.get(`/drivers/${riderId}`);
      const riderData = riderResponse.data;

      // Fetch all orders and filter to only those completed/delivered by this rider
      const ordersResponse = await api.get('/admin/orders');
      const allOrders = ordersResponse.data || [];
      
      // Only show orders that were actually completed/delivered by this rider
      // Filter orders where driverId matches and status is completed or delivered
      const riderOrders = allOrders.filter(
        o => o.driverId === parseInt(riderId) && (o.status === 'completed' || o.status === 'delivered' || o.status === 'cancelled')
      );

      // Fetch wallet balance
      let balanceOwed = 0;
      try {
        const walletResponse = await api.get(`/driver-wallet/${riderId}`);
        if (walletResponse.data && walletResponse.data.success) {
          const cashSettlements = walletResponse.data.cashSettlements || [];
          const totalSettled = cashSettlements.reduce((sum, settlement) => {
            return sum + Math.abs(parseFloat(settlement.amount) || 0);
          }, 0);
          balanceOwed = (riderData.driverPayAmount || 0) - totalSettled;
          balanceOwed = Math.max(0, balanceOwed);
        } else {
          balanceOwed = Math.max(0, (riderData.driverPayAmount || 0) - (riderData.driverPayCredited || 0));
        }
      } catch (walletError) {
        console.error('Error fetching wallet:', walletError);
        balanceOwed = Math.max(0, (riderData.driverPayAmount || 0) - (riderData.driverPayCredited || 0));
      }

      // Calculate stats - only from orders actually completed/delivered by this rider
      const completedOrders = riderOrders.filter(o => o.status === 'completed' || o.status === 'delivered');
      const cancelledOrders = riderOrders.filter(o => o.status === 'cancelled');
      const totalEarnings = riderData.driverPayAmount || 0;

      setRider(riderData);
      setOrders(riderOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
      setStats({
        totalOrders: allOrders.length,
        completedOrders: completedOrders.length,
        cancelledOrders: cancelledOrders.length,
        totalEarnings,
        balanceOwed
      });
    } catch (error) {
      console.error('Error fetching rider details:', error);
      setError('Failed to load rider details');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return `KES ${Number(amount || 0).toFixed(2)}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !rider) {
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton
            onClick={() => navigate('/copilot/reports')}
            sx={{ mr: 2, color: colors.textPrimary }}
          >
            <ArrowBack />
          </IconButton>
          <Typography variant="h5" sx={{ fontWeight: 600, color: colors.textPrimary }}>
            Rider Details
          </Typography>
        </Box>
        <Alert severity="error">{error || 'Rider not found'}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton
          onClick={() => navigate('/copilot/reports')}
          sx={{ mr: 2, color: colors.textPrimary }}
        >
          <ArrowBack />
        </IconButton>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600, color: colors.textPrimary }}>
            {rider.name} - Details
          </Typography>
          <Typography variant="body2" sx={{ color: colors.textSecondary, mt: 0.5 }}>
            {rider.phoneNumber} • {rider.email || 'No email'}
          </Typography>
        </Box>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ backgroundColor: colors.paper }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <LocalShipping sx={{ color: colors.accentText, mr: 1, fontSize: 20 }} />
                <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                  Total Orders
                </Typography>
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: colors.textPrimary }}>
                {stats.totalOrders}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ backgroundColor: colors.paper }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Assessment sx={{ color: colors.accentText, mr: 1, fontSize: 20 }} />
                <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                  Completed
                </Typography>
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: colors.accentText }}>
                {stats.completedOrders}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ backgroundColor: colors.paper }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Assessment sx={{ color: colors.error, mr: 1, fontSize: 20 }} />
                <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                  Cancelled
                </Typography>
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: colors.error }}>
                {stats.cancelledOrders}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ backgroundColor: colors.paper }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <AttachMoney sx={{ color: colors.accentText, mr: 1, fontSize: 20 }} />
                <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                  Total Earnings
                </Typography>
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: colors.textPrimary }}>
                {formatCurrency(stats.totalEarnings)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ backgroundColor: colors.paper }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <AttachMoney sx={{ color: colors.error, mr: 1, fontSize: 20 }} />
                <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                  Balance Owed
                </Typography>
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: colors.error }}>
                {formatCurrency(stats.balanceOwed)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Orders Table */}
      <Paper sx={{ backgroundColor: colors.paper }}>
        <Box sx={{ p: 2, borderBottom: `1px solid ${colors.border}` }}>
          <Typography variant="h6" sx={{ color: colors.textPrimary }}>
            Order History
          </Typography>
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Order ID</TableCell>
                <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Customer</TableCell>
                <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Amount</TableCell>
                <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Payment</TableCell>
                <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Date</TableCell>
                <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} sx={{ textAlign: 'center', py: 4, color: colors.textSecondary }}>
                    No orders found for this rider
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((order) => {
                  const statusProps = getOrderStatusChipProps(order.status);
                  const paymentProps = getPaymentStatusChipProps(order.paymentStatus, order.status);

                  return (
                    <TableRow key={order.id}>
                      <TableCell sx={{ color: colors.textPrimary, fontWeight: 600 }}>
                        #{order.id}
                      </TableCell>
                      <TableCell sx={{ color: colors.textPrimary }}>
                        {order.customerName || 'Guest'}
                      </TableCell>
                      <TableCell sx={{ color: colors.textPrimary, fontWeight: 600 }}>
                        {formatCurrency(order.totalAmount)}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={statusProps.label}
                          icon={statusProps.icon}
                          color={statusProps.color}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {paymentProps && (
                          <Chip
                            label={paymentProps.label}
                            icon={paymentProps.icon}
                            color={paymentProps.color}
                            size="small"
                          />
                        )}
                      </TableCell>
                      <TableCell sx={{ color: colors.textSecondary }}>
                        {formatDate(order.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => navigate(`/admin/orders`)}
                          sx={{
                            borderColor: colors.accentText,
                            color: colors.accentText,
                            textTransform: 'none',
                            '&:hover': {
                              borderColor: colors.accent,
                              backgroundColor: 'rgba(0, 224, 184, 0.1)'
                            }
                          }}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default RiderDetails;

