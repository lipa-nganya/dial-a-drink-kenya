import React, { useState, useEffect, useRef } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
  Badge,
  Card,
  CardContent,
  Divider,
  Snackbar,
  useMediaQuery,
  useTheme as useMuiTheme
} from '@mui/material';
import {
  ShoppingCart,
  Warning,
  Assignment,
  Edit,
  Person,
  Search,
  Clear,
  AutoAwesome,
  Phone,
  Payment,
  CheckCircle,
  AttachMoney,
  Close,
  LocationOn,
  LocalShipping
} from '@mui/icons-material';
import { api } from '../services/api';
import io from 'socket.io-client';
import { useTheme } from '../contexts/ThemeContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { getBackendUrl } from '../utils/backendUrl';
import { getOrderStatusChipProps, getPaymentStatusChipProps, getPaymentMethodChipProps } from '../utils/chipStyles';
import { formatMpesaPhoneNumber, validateSafaricomPhone } from '../utils/mpesaPhone';
import NewOrderDialog from '../components/NewOrderDialog';
import { useJsApiLoader } from '@react-google-maps/api';
import AddressAutocomplete from '../components/AddressAutocomplete';
import { computeOrderDisplayAmounts } from '../utils/orderFinancials';

// Google Maps libraries - moved outside component to prevent performance warnings
const GOOGLE_MAPS_LIBRARIES = ['places', 'geometry'];
const ORDERS_SUMMARY_QUERY = '/admin/orders?summary=1&limit=150';

/** Matches admin API: amounts editable unless cancelled, or incomplete paid/completed combos. Paid + completed is allowed (reconciliation). */
function canEditOrderFinancialAmounts(order) {
  if (!order || order.status === 'cancelled') return false;
  const completedWithoutPay = order.status === 'completed' && order.paymentStatus !== 'paid';
  const paidNotCompleted = order.paymentStatus === 'paid' && order.status !== 'completed';
  return !(completedWithoutPay || paidNotCompleted);
}

/** Sum of line item price × quantity. When present, this is the real subtotal; do not trust a stale `itemsTotal` field. */
function sumLineItemsSubtotal(order) {
  const items = order?.items || [];
  if (!items.length) return null;
  let sum = 0;
  for (const item of items) {
    sum += parseFloat(item.price || 0) * (parseFloat(item.quantity || 0) || 0);
  }
  return Number(sum.toFixed(2));
}

/**
 * Customer-facing total for the summary and orders list: line items + convenience fee + tip.
 * Matches order detail breakdown; ignores stale `order.totalAmount` after edits.
 * Territory delivery fee is internal accounting and is not added to customer total here.
 */
function computeOrderSummaryCustomerTotal(order) {
  if (!order) return 0;
  const amounts = computeOrderDisplayAmounts(order);
  const fromLines = sumLineItemsSubtotal(order);
  const hasLineItems = Array.isArray(order?.items) && order.items.length > 0;
  const hasStoredItemsTotal =
    order?.itemsTotal !== null &&
    order?.itemsTotal !== undefined &&
    order?.itemsTotal !== '' &&
    Number.isFinite(Number(order.itemsTotal));

  // Summary payloads intentionally omit items; in that case trust totalAmount directly.
  if (!hasLineItems && !hasStoredItemsTotal && Number.isFinite(Number(order.totalAmount))) {
    return Number(Number(order.totalAmount).toFixed(2));
  }

  const itemsPart =
    fromLines != null ? fromLines : amounts.itemsSubtotal;
  return Number((itemsPart + amounts.convenienceFee + amounts.tipAmount).toFixed(2));
}

const Orders = () => {
  const { isDarkMode, colors } = useTheme();
  const muiTheme = useMuiTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));
  const location = useLocation();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [transactionStatusFilter, setTransactionStatusFilter] = useState('all');
  /** all | unassigned | driver id string */
  const [riderFilter, setRiderFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [customFilter, setCustomFilter] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [territories, setTerritories] = useState([]);
  const [driverDialogOpen, setDriverDialogOpen] = useState(false);
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [reassignDriver, setReassignDriver] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelReasonError, setCancelReasonError] = useState('');
  const [cancelTargetOrder, setCancelTargetOrder] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [newOrderDialogOpen, setNewOrderDialogOpen] = useState(false);
  const [orderDetailDialogOpen, setOrderDetailDialogOpen] = useState(false);
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [promptingPayment, setPromptingPayment] = useState(false);
  const [paymentPollingInterval, setPaymentPollingInterval] = useState(null);
  
  // Payment failure dialog state
  const [paymentFailureDialogOpen, setPaymentFailureDialogOpen] = useState(false);
  const [paymentFailureData, setPaymentFailureData] = useState(null);
  const [editPriceDialogOpen, setEditPriceDialogOpen] = useState(false);
  
  // Toast notification state
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [newPrice, setNewPrice] = useState('');
  const [updatingPrice, setUpdatingPrice] = useState(false);
  const [editItemsSubtotalDialogOpen, setEditItemsSubtotalDialogOpen] = useState(false);
  const [newItemsSubtotal, setNewItemsSubtotal] = useState('');
  const [updatingItemsSubtotal, setUpdatingItemsSubtotal] = useState(false);
  const [editDeliveryFeeDialogOpen, setEditDeliveryFeeDialogOpen] = useState(false);
  const [newDeliveryFee, setNewDeliveryFee] = useState('');
  const [updatingDeliveryFee, setUpdatingDeliveryFee] = useState(false);
  const [editConvenienceFeeDialogOpen, setEditConvenienceFeeDialogOpen] = useState(false);
  const [newConvenienceFee, setNewConvenienceFee] = useState('');
  const [updatingConvenienceFee, setUpdatingConvenienceFee] = useState(false);
  const [selectedTerritoryId, setSelectedTerritoryId] = useState('');
  const [recentlyUpdatedInOrderDetail, setRecentlyUpdatedInOrderDetail] = useState({ customer: false, deliveryFee: false, territory: false });
  const updatedFeeTimeoutRef = useRef(null);
  const ordersRefreshTimeoutRef = useRef(null);
  const [savingOrderDetails, setSavingOrderDetails] = useState(false);
  const originalOrderDetailRef = useRef(null);
  
  // Payment dialog state
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState(null);
  const [paymentPhone, setPaymentPhone] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [processingCancellationRequest, setProcessingCancellationRequest] = useState(false);

  const openOrderDetails = async (order) => {
    const amounts = computeOrderDisplayAmounts(order);
    const orderWithBreakdown = {
      ...order,
      itemsTotal: Math.round(amounts.itemsSubtotal),
      convenienceFee: Math.round(amounts.convenienceFee),
      // deliveryFee on this screen = internal territory delivery fee (not customer convenience label only).
      deliveryFee: Math.round(amounts.territoryDeliveryFee),
      orderValue: Math.round(amounts.orderValue)
    };

    setSelectedOrderForDetail(orderWithBreakdown);
    originalOrderDetailRef.current = {
      id: orderWithBreakdown.id,
      driverId: orderWithBreakdown.driverId ?? orderWithBreakdown.driver?.id ?? null
    };
    setSelectedTerritoryId(
      orderWithBreakdown.territoryId ??
        orderWithBreakdown.territory?.id ??
        ''
    );
    setRecentlyUpdatedInOrderDetail({ deliveryFee: false, territory: false });
    setOrderDetailDialogOpen(true);

    try {
      const response = await api.get(`/admin/orders?orderId=${order.id}`);
      const fullOrder = Array.isArray(response.data)
        ? response.data[0]
        : (Array.isArray(response.data?.orders) ? response.data.orders[0] : null);
      if (!fullOrder) return;

      const fullAmounts = computeOrderDisplayAmounts(fullOrder);
      setSelectedOrderForDetail({
        ...fullOrder,
        itemsTotal: Math.round(fullAmounts.itemsSubtotal),
        convenienceFee: Math.round(fullAmounts.convenienceFee),
        deliveryFee: Math.round(fullAmounts.territoryDeliveryFee),
        orderValue: Math.round(fullAmounts.orderValue)
      });
    } catch (err) {
      console.error('Failed to load full order details:', err);
    }
  };
  
  // Route Optimisation state (kept for fetchRiderRoutes function which is still called)
  const [orderTab, setOrderTab] = useState('pending'); // 'completed', 'pending', 'unassigned', 'confirmed', 'out_for_delivery', 'cancelled'
  const [cancelledSubTab, setCancelledSubTab] = useState('cancelled'); // 'cancelled' | 'cancellation-requests'
  // eslint-disable-next-line no-unused-vars
  const [riderRoutes, setRiderRoutes] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [allRiderRoutes, setAllRiderRoutes] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [allRiders, setAllRiders] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [routesLoading, setRoutesLoading] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [selectedRiders, setSelectedRiders] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [riderLocations, setRiderLocations] = useState({});
  // eslint-disable-next-line no-unused-vars
  const [refreshingLocations, setRefreshingLocations] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [optimizedRoutes, setOptimizedRoutes] = useState({}); // riderId -> array of order IDs in optimized order
  // eslint-disable-next-line no-unused-vars
  const [, setOptimizationSavings] = useState({}); // riderId -> { timeSaved, costSaved }
  // eslint-disable-next-line no-unused-vars
  const [optimizationProgress, setOptimizationProgress] = useState({
    open: false,
    step: 0,
    totalSteps: 9,
    currentStep: '',
    progress: 0
  });
  const [stopDialogOpen, setStopDialogOpen] = useState(false);
  const [selectedRiderForStop, setSelectedRiderForStop] = useState(null);
  const [selectedOrderIndexForStop, setSelectedOrderIndexForStop] = useState(null);
  const [editingStop, setEditingStop] = useState(null); // null for add, stop object for edit
  const [stopFormData, setStopFormData] = useState({
    name: '',
    location: '',
    instruction: '',
    payment: ''
  });
  const [stops, setStops] = useState({}); // riderId -> array of { stop, insertAfterIndex }

  
  // Google Maps API loader
  // eslint-disable-next-line no-unused-vars
  const { isLoaded: isMapLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '',
    libraries: GOOGLE_MAPS_LIBRARIES
  });

  useEffect(() => {
    fetchOrders();
    fetchDrivers();
    fetchBranches();
    fetchTerritories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const feeTimeoutRef = updatedFeeTimeoutRef;
    const refreshTimeoutRef = ordersRefreshTimeoutRef;
    return () => {
      if (feeTimeoutRef.current) clearTimeout(feeTimeoutRef.current);
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    };
  }, []);

  const fetchTerritories = async () => {
    try {
      const response = await api.get('/territories');
      setTerritories(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching territories:', error);
    }
  };

  const handleApproveCancellation = async (orderId) => {
    if (!orderId) return;
    try {
      setProcessingCancellationRequest(true);
      const response = await api.patch(`/admin/orders/${orderId}/cancellation-request`, { approved: true });
      const updatedOrder = response?.data?.order || response?.data;

      setOrders((prevOrders) => {
        const updated = prevOrders.map((order) =>
          order.id === orderId ? { ...order, ...updatedOrder } : order
        );
        const sorted = sortOrdersByStatus(updated);
        // If we were viewing cancellation requests and the order is now cancelled, show cancelled orders
        if (orderTab === 'cancelled' && cancelledSubTab === 'cancellation-requests' && updatedOrder?.status === 'cancelled') {
          setCancelledSubTab('cancelled');
          applyFilters(sorted, orderStatusFilter, transactionStatusFilter, searchQuery, customFilter, 'cancelled', 'cancelled');
        } else {
          applyFilters(sorted, orderStatusFilter, transactionStatusFilter, searchQuery, customFilter, orderTab, cancelledSubTab);
        }
        return sorted;
      });

      setError(null);
      setToastMessage('Cancellation approved');
      setToastOpen(true);
    } catch (error) {
      console.error('Error approving cancellation:', error);
      const message = error?.response?.data?.error || error?.message || 'Failed to approve cancellation';
      setError(message);
      setToastMessage(message);
      setToastOpen(true);
    } finally {
      setProcessingCancellationRequest(false);
    }
  };

  const handleRejectCancellation = async (orderId) => {
    if (!orderId) return;
    try {
      setProcessingCancellationRequest(true);
      const response = await api.patch(`/admin/orders/${orderId}/cancellation-request`, { approved: false });
      const updatedOrder = response?.data?.order || response?.data;

      setOrders((prevOrders) => {
        const updated = prevOrders.map((order) =>
          order.id === orderId ? { ...order, ...updatedOrder } : order
        );
        const sorted = sortOrdersByStatus(updated);
        // If we were viewing cancellation requests and it was rejected, send back to pending (original behavior)
        if (orderTab === 'cancelled' && cancelledSubTab === 'cancellation-requests') {
          setOrderTab('pending');
          setCancelledSubTab('cancelled');
          applyFilters(sorted, orderStatusFilter, transactionStatusFilter, searchQuery, customFilter, 'pending');
        } else {
          applyFilters(sorted, orderStatusFilter, transactionStatusFilter, searchQuery, customFilter, orderTab, cancelledSubTab);
        }
        return sorted;
      });

      setError(null);
      setToastMessage('Cancellation rejected');
      setToastOpen(true);
    } catch (error) {
      console.error('Error rejecting cancellation:', error);
      const message = error?.response?.data?.error || error?.message || 'Failed to reject cancellation';
      setError(message);
      setToastMessage(message);
      setToastOpen(true);
    } finally {
      setProcessingCancellationRequest(false);
    }
  };

  const fetchBranches = async () => {
    try {
      const response = await api.get('/branches?activeOnly=true');
      setBranches(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching branches:', error);
    }
  };

  const fetchDrivers = async () => {
    try {
      const response = await api.get('/drivers');
      // Ensure response.data is an array
      const driversData = response.data;
      if (Array.isArray(driversData)) {
        setDrivers(driversData);
      } else if (driversData && Array.isArray(driversData.data)) {
        // Handle wrapped response format
        setDrivers(driversData.data);
      } else {
        console.warn('Drivers response is not an array:', driversData);
        setDrivers([]);
      }
    } catch (error) {
      console.error('Error fetching drivers:', error);
      setDrivers([]);
    }
  };

  // Set up Socket.IO for real-time order updates
  useEffect(() => {
    const socketUrl = getBackendUrl();
    const socket = io(socketUrl);
    
    // Join admin room to receive order notifications
    socket.emit('join-admin');
    
    // Listen for new orders
    socket.on('new-order', async (data) => {
      console.log('✅ New order received via Socket.IO:', data);

      // Coalesce bursty socket events into a single summary refresh.
      scheduleOrdersRefresh(400);
    });

    // Listen for order updates (including driver assignment)
    socket.on('order-updated', async (data) => {
      console.log('✅ Order updated via Socket.IO:', data);
      scheduleOrdersRefresh();
    });

    // Listen for driver order response
    socket.on('driver-order-response', async (data) => {
      console.log('✅ Driver responded to order:', data);
      
      // Show notification to admin about driver response
      if (data.accepted) {
        const driverName = data.order?.driver?.name || 'Driver';
        alert(`✅ Driver Response: ${driverName} accepted Order #${data.orderId}. Order is now in progress.`);
      } else {
        const driverName = data.order?.driver?.name || 'Driver';
        alert(`⚠️ Driver Response: ${driverName} rejected Order #${data.orderId}. Order is now unassigned.`);
      }
      
      // Update the specific order in the list - prioritize driver response data
      setOrders(prevOrders => {
        const updated = prevOrders.map(order => 
          order.id === data.orderId 
            ? { 
                ...order, 
                driverAccepted: data.accepted, 
                driver: data.order?.driver || order.driver, 
                driverId: data.order?.driverId !== undefined ? data.order.driverId : order.driverId,
                // Only update status if it's explicitly provided in the driver response
                status: data.order?.status || order.status
              }
            : order
        );
        const sorted = sortOrdersByStatus(updated);
        applyFilters(sorted, orderStatusFilter, transactionStatusFilter, searchQuery, customFilter, orderTab);
        return sorted;
      });
    });

    // Listen for order rejected by driver
    socket.on('order-rejected-by-driver', async (data) => {
      console.log('⚠️ Order rejected by driver:', data);
      
      // Show alert to admin
      if (data.requiresAction) {
        alert(`⚠️ ALERT: Driver rejected Order #${data.orderId}. The order is now unassigned and needs to be reassigned.`);
      }
      
      // Update the order - remove driver assignment
      setOrders(prevOrders => {
        const updated = prevOrders.map(order => 
          order.id === data.orderId 
            ? { ...order, driverId: null, driver: null, driverAccepted: false }
            : order
        );
        const sorted = sortOrdersByStatus(updated);
        applyFilters(sorted, orderStatusFilter, transactionStatusFilter, searchQuery, customFilter, orderTab);
        return sorted;
      });
      
      // Refresh orders to get latest data
      scheduleOrdersRefresh();
    });

    // Listen for order status updates from driver app
    socket.on('order-status-updated', async (data) => {
      console.log('✅ Order status updated via Socket.IO:', data);
      if (data.orderId) {
        // If this was triggered by a driver response, don't show as a status update
        // The driver-order-response event already handled the notification
        if (data.triggeredByDriverResponse) {
          console.log('📋 Status update triggered by driver response - driver-response event already handled notification');
        }
        
        // Update order immediately with status from event - merge full order object if provided
        // But preserve driverAccepted status if it was set by driver response
        setOrders(prevOrders => {
          const updated = prevOrders.map(order => {
            if (order.id === data.orderId) {
              // Merge order object if provided, otherwise just update status fields
              const updatedOrder = data.order 
                ? { ...order, ...data.order, status: data.status || order.status, paymentStatus: data.paymentStatus || order.paymentStatus }
                : { 
                    ...order, 
                    status: data.status || order.status,
                    paymentStatus: data.paymentStatus || order.paymentStatus
                  };
              
              // Preserve driverAccepted if it was set (driver response takes precedence)
              if (order.driverAccepted !== undefined && order.driverAccepted !== null) {
                updatedOrder.driverAccepted = order.driverAccepted;
              }
              
              return updatedOrder;
            }
            return order;
          });
          // Re-sort after update and apply filters to update filteredOrders immediately
          const sorted = sortOrdersByStatus(updated);
          applyFilters(sorted, orderStatusFilter, transactionStatusFilter, searchQuery, customFilter, orderTab);
          return sorted;
        });
      }
    });

    // Listen for order updates (status changes, payment confirmations, etc.)
    // Listen for driver status updates
    socket.on('driver-status-updated', (data) => {
      console.log('Driver status updated in Orders:', data);
      // Update driver in local state immediately
      if (data.driver) {
        setDrivers(prevDrivers => 
          prevDrivers.map(driver => 
            driver.id === data.driverId ? { ...driver, ...data.driver } : driver
          )
        );
      }
    });

    socket.on('driver-shift-started', (data) => {
      console.log('Driver started shift in Orders:', data);
      // Update driver in local state immediately
      if (data.driver) {
        setDrivers(prevDrivers => 
          prevDrivers.map(driver => 
            driver.id === data.driverId ? { ...driver, ...data.driver } : driver
          )
        );
      }
    });

    socket.on('driver-shift-ended', (data) => {
      console.log('Driver ended shift in Orders:', data);
      // Update driver in local state immediately
      if (data.driver) {
        setDrivers(prevDrivers => 
          prevDrivers.map(driver => 
            driver.id === data.driverId ? { ...driver, ...data.driver } : driver
          )
        );
      }
    });

    // Listen for cancellation requests from drivers
    socket.on('order-cancellation-requested', async (data) => {
      console.log('⚠️ Cancellation requested for order:', data);
      
      // Show alert to admin
      const driverName = data.order?.driver?.name || 'Driver';
      alert(`⚠️ CANCELLATION REQUEST: ${driverName} has requested cancellation for Order #${data.orderId}.\nReason: ${data.reason || 'N/A'}\n\nPlease review and approve or reject the request.`);
      
      // Switch to Cancelled tab + Cancellation Requests sub-tab to show the new request
      setOrderTab('cancelled');
      setCancelledSubTab('cancellation-requests');
      
      // Update order in list
      if (data.order) {
        setOrders(prevOrders => {
          const existingIndex = prevOrders.findIndex(o => o.id === data.orderId);
          let updated;
          
          if (existingIndex >= 0) {
            updated = [...prevOrders];
            updated[existingIndex] = { ...updated[existingIndex], ...data.order };
          } else {
            updated = [data.order, ...prevOrders];
          }
          
          const sorted = sortOrdersByStatus(updated);
          applyFilters(sorted, orderStatusFilter, transactionStatusFilter, searchQuery, customFilter, 'cancelled', 'cancellation-requests');
          return sorted;
        });
      } else {
        // Refresh orders if order data not provided
        await fetchOrders();
      }
    });

    // Listen for cancellation request processed
    socket.on('order-cancellation-processed', async (data) => {
      console.log('✅ Cancellation request processed:', data);
      
      if (data.order) {
        setOrders(prevOrders => {
          const updated = prevOrders.map(order => 
            order.id === data.orderId ? { ...order, ...data.order } : order
          );
          const sorted = sortOrdersByStatus(updated);
          
          // If cancellation was approved and we're viewing cancellation requests, switch to cancelled orders
          if (data.approved && orderTab === 'cancelled' && cancelledSubTab === 'cancellation-requests' && data.order.status === 'cancelled') {
            setOrderTab('cancelled');
            setCancelledSubTab('cancelled');
            applyFilters(sorted, orderStatusFilter, transactionStatusFilter, searchQuery, customFilter, 'cancelled', 'cancelled');
          } else if (!data.approved && orderTab === 'cancelled' && cancelledSubTab === 'cancellation-requests') {
            // If cancellation was rejected and we're viewing cancellation requests, stay on requests view
            applyFilters(sorted, orderStatusFilter, transactionStatusFilter, searchQuery, customFilter, 'cancelled', 'cancellation-requests');
          } else {
            applyFilters(sorted, orderStatusFilter, transactionStatusFilter, searchQuery, customFilter, orderTab, cancelledSubTab);
          }
          return sorted;
        });
      } else {
        await fetchOrders();
      }
    });

    socket.on('payment-failed', async (data) => {
      console.log('❌ Payment failed for order:', data);
      if (data.orderId) {
        // Show payment failure dialog
        setPaymentFailureData({
          orderId: data.orderId,
          errorType: data.errorType || 'failed',
          errorMessage: data.errorMessage || 'Payment failed',
          resultCode: data.resultCode,
          resultDesc: data.resultDesc
        });
        setPaymentFailureDialogOpen(true);
        
        // Update order status in state
        setOrders(prevOrders => {
          const updated = prevOrders.map(order => {
            if (order.id === data.orderId) {
              return {
                ...order,
                paymentStatus: 'unpaid',
                status: order.status === 'pending' ? 'pending' : order.status
              };
            }
            return order;
          });
          const sorted = sortOrdersByStatus(updated);
          applyFilters(sorted, orderStatusFilter, transactionStatusFilter, searchQuery, customFilter, orderTab);
          return sorted;
        });
      }
    });

    socket.on('payment-confirmed', async (data) => {
      console.log('✅ Payment confirmed for order:', data);
      console.log('   Event data:', JSON.stringify(data, null, 2));
      if (data.orderId) {
        // CRITICAL: Always use 'paid' for paymentStatus when payment is confirmed
        // The event is only emitted when payment is successful, so paymentStatus must be 'paid'
        const finalPaymentStatus = 'paid'; // Always 'paid' for payment-confirmed events
        const finalStatus = data.status || data.order?.status || 'confirmed';
        
        console.log(`💰 Processing payment-confirmed for Order #${data.orderId}`);
        console.log(`   Setting paymentStatus to: ${finalPaymentStatus}`);
        console.log(`   Setting status to: ${finalStatus}`);
        console.log(`   Event data.paymentStatus: ${data.paymentStatus}`);
        console.log(`   Event data.order.paymentStatus: ${data.order?.paymentStatus}`);
        
        // Update order immediately with payment status from event - merge full order object if provided
        setOrders(prevOrders => {
          const updated = prevOrders.map(order => {
            if (order.id === data.orderId) {
              // Merge order object if provided, but ALWAYS override paymentStatus to 'paid'
              const updatedOrder = data.order 
                ? { 
                    ...order, 
                    ...data.order, 
                    status: finalStatus, 
                    paymentStatus: finalPaymentStatus, // ALWAYS 'paid' for payment-confirmed events
                    paymentConfirmedAt: data.paymentConfirmedAt,
                    receiptNumber: data.receiptNumber || data.order.receiptNumber,
                    transactionCode: data.receiptNumber || data.order.transactionCode
                  }
                : { 
                    ...order, 
                    status: finalStatus,
                    paymentStatus: finalPaymentStatus, // ALWAYS 'paid' for payment-confirmed events
                    paymentConfirmedAt: data.paymentConfirmedAt,
                    receiptNumber: data.receiptNumber,
                    transactionCode: data.receiptNumber,
                    transactions: order.transactions?.map(tx => 
                      tx.id === data.transactionId 
                        ? { ...tx, status: 'completed', receiptNumber: data.receiptNumber }
                        : tx
                    ) || []
                  };
              
              console.log(`✅ Updated order #${data.orderId} in state:`);
              console.log(`   paymentStatus: ${updatedOrder.paymentStatus}`);
              console.log(`   status: ${updatedOrder.status}`);
              console.log(`   receiptNumber: ${updatedOrder.receiptNumber}`);
              
              return updatedOrder;
            }
            return order;
          });
          // Re-sort after update and apply filters to update filteredOrders immediately
          const sorted = sortOrdersByStatus(updated);
          applyFilters(sorted, orderStatusFilter, transactionStatusFilter, searchQuery, customFilter, orderTab);
          return sorted;
        });
      }
    });

    return () => {
      socket.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Order status priority for sorting
  const getStatusPriority = (status) => {
    const priorityMap = {
      'pending': 1,
      // Used for walk-in POS orders that are created unpaid (e.g. M-Pesa prompt initiated)
      'in_progress': 2,
      'confirmed': 2,
      'out_for_delivery': 3,
      'delivered': 5,
      'completed': 6,
      'cancelled': 7
    };
    return priorityMap[status] || 999;
  };

  // Sort orders by status priority, then by creation date (newest first within same status)
  const sortOrdersByStatus = (ordersList) => {
    return [...ordersList].sort((a, b) => {
      const priorityA = getStatusPriority(a.status);
      const priorityB = getStatusPriority(b.status);
      
      // First sort by status priority
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      // If same status, sort by creation date (newest first)
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  };

  const fetchOrders = async ({ background = false } = {}) => {
    try {
      if (!background) setLoading(true);
      const response = await api.get(ORDERS_SUMMARY_QUERY);
      let orders = Array.isArray(response.data) ? response.data : (response.data?.orders || []);

      // Filter out any undefined or null orders
      orders = orders.filter(order => order != null);
      console.log('📦 fetchOrders after null filter:', orders.length, 'orders');

      // Additional sync: Check each order and ensure paymentStatus matches transaction status
      orders = orders.map(order => {
        if (!order) return null;
        if (order.transactions && order.transactions.length > 0) {
          const hasCompletedTransaction = order.transactions.some(tx => tx.status === 'completed');
          // If transaction is completed but paymentStatus is not 'paid', update it
          if (hasCompletedTransaction && order.paymentStatus !== 'paid') {
            console.log(`🔧 Frontend sync: Updating Order #${order.id} paymentStatus from ${order.paymentStatus} to 'paid'`);
            return { ...order, paymentStatus: 'paid' };
          }
        }
        return order;
      }).filter(order => order != null); // Filter out any null orders after mapping
      console.log('📦 fetchOrders after mapping:', orders.length, 'orders');

      const sortedOrders = sortOrdersByStatus(orders);
      console.log('📦 fetchOrders after sorting:', sortedOrders.length, 'orders');
      setOrders(sortedOrders);
      console.log('📦 fetchOrders - calling applyFilters with tab:', orderTab);
      setError(null);
      // Apply filters after fetching
      applyFilters(sortedOrders, orderStatusFilter, transactionStatusFilter, searchQuery, customFilter, orderTab);
    } catch (error) {
      console.error('Error fetching orders:', error);
      setError(error.response?.data?.error || error.message || 'Error loading orders');
    } finally {
      if (!background) setLoading(false);
    }
  };

  const scheduleOrdersRefresh = (delayMs = 900) => {
    if (ordersRefreshTimeoutRef.current) clearTimeout(ordersRefreshTimeoutRef.current);
    ordersRefreshTimeoutRef.current = setTimeout(() => {
      fetchOrders({ background: true });
    }, delayMs);
  };

  // Get transaction status for an order
  const getOrderTransactionStatus = (order) => {
    if (!order.transactions || order.transactions.length === 0) {
      if (order.paymentStatus === 'paid') return 'completed';
      if (order.paymentStatus === 'failed') return 'failed';
      return 'pending'; // No transaction created yet
    }
    // Avoid sorting/mutating on every filter pass; just scan once for newest tx.
    let latestTransaction = null;
    let latestTimestamp = -Infinity;
    for (const tx of order.transactions) {
      const ts = Date.parse(tx?.createdAt || '');
      const normalizedTs = Number.isFinite(ts) ? ts : -Infinity;
      if (normalizedTs > latestTimestamp) {
        latestTimestamp = normalizedTs;
        latestTransaction = tx;
      }
    }
    return latestTransaction?.status || order.transactions[0]?.status || 'pending';
  };

  // Apply filters to orders
  const applyFilters = (ordersList, orderStatus, transactionStatus, search, customFilter, tabFilter, cancelledView = cancelledSubTab) => {
    console.log('🔍 applyFilters called with:', { 
      ordersCount: ordersList.length, 
      tabFilter, 
      orderStatus, 
      transactionStatus, 
      search,
      customFilter 
    });
    
    let filtered = [...ordersList];
    const isWalkInOrder = (order) => {
      const addr = String(order?.deliveryAddress || '');
      return (
        addr === 'In-Store Purchase' ||
        addr.includes('In-Store Purchase') ||
        String(order?.customerPhone || '') === 'POS' ||
        String(order?.customerName || '') === 'POS'
      );
    };

    // Apply tab-based filtering first
    if (tabFilter === 'pending') {
      // Include in_progress so walk-in M-Pesa orders don't disappear from all tabs
      const beforeFilter = filtered.length;
      filtered = filtered.filter(order => (order.status === 'pending' || order.status === 'confirmed' || order.status === 'in_progress') && !(order.cancellationRequested && order.cancellationApproved === null));
      console.log(`🔍 'pending' tab filter: ${beforeFilter} → ${filtered.length} orders`);
    } else if (tabFilter === 'completed') {
      const beforeFilter = filtered.length;
      filtered = filtered.filter(order => order.status === 'completed');
      console.log(`🔍 'completed' tab filter: ${beforeFilter} → ${filtered.length} orders`);
    } else if (tabFilter === 'unassigned') {
      const beforeFilter = filtered.length;
      filtered = filtered
        .filter(order => !isWalkInOrder(order))
        .filter(order => !order.driverId || order.driver?.name === 'HOLD Driver');
      console.log(`🔍 'unassigned' tab filter: ${beforeFilter} → ${filtered.length} orders`);
    } else if (tabFilter === 'confirmed') {
      // "In Progress" tab should include walk-in POS orders created unpaid (status=in_progress)
      // as well as delivery orders that are confirmed/in-progress.
      const beforeFilter = filtered.length;
      filtered = filtered.filter(order => order.status === 'confirmed' || order.status === 'in_progress');
      console.log(`🔍 'confirmed' tab filter: ${beforeFilter} → ${filtered.length} orders`);
    } else if (tabFilter === 'out_for_delivery') {
      const beforeFilter = filtered.length;
      filtered = filtered.filter(order => order.status === 'out_for_delivery');
      console.log(`🔍 'out_for_delivery' tab filter: ${beforeFilter} → ${filtered.length} orders`);
    } else if (tabFilter === 'cancelled') {
      const beforeFilter = filtered.length;
      if (cancelledView === 'cancellation-requests') {
        filtered = filtered.filter(order => order.cancellationRequested && order.cancellationApproved === null);
      } else {
        filtered = filtered.filter(order => order.status === 'cancelled');
      }
      console.log(`🔍 'cancelled' tab filter: ${beforeFilter} → ${filtered.length} orders`);
    }

    // Apply custom filters from URL params
    if (customFilter === 'no-driver') {
      filtered = filtered.filter(order => !order.driverId || order.driver?.name === 'HOLD Driver');
    } else if (customFilter === 'pending') {
      filtered = filtered.filter(order => order.status === 'pending');
    }

    // Filter by search query (customer name or order number)
    if (search && search.trim()) {
      const searchLower = search.trim().toLowerCase();
      filtered = filtered.filter(order => {
        // Search by order number (ID)
        const orderNumberMatch = order.id.toString().includes(searchLower);
        
        // Search by customer name
        const customerNameMatch = order.customerName?.toLowerCase().includes(searchLower);
        
        return orderNumberMatch || customerNameMatch;
      });
    }

    // Filter by order status
    if (orderStatus !== 'all') {
      filtered = filtered.filter(order => order.status === orderStatus);
    }

    // Filter by transaction status
    if (transactionStatus !== 'all') {
      filtered = filtered.filter(order => {
        const txStatus = getOrderTransactionStatus(order);
        return txStatus === transactionStatus;
      });
    }

    if (riderFilter !== 'all') {
      if (riderFilter === 'unassigned') {
        filtered = filtered.filter(
          (order) => !order.driverId || order.driver?.name === 'HOLD Driver'
        );
      } else {
        const rid = parseInt(riderFilter, 10);
        if (!Number.isNaN(rid)) {
          filtered = filtered.filter((order) => Number(order.driverId) === rid);
        }
      }
    }

    // Sort filtered results
    const sorted = sortOrdersByStatus(filtered);
    console.log(`🔍 applyFilters final result: ${sorted.length} orders`);
    setFilteredOrders(sorted);
  };

  // Handle URL query parameters
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const filter = searchParams.get('filter');
    const action = searchParams.get('action');
    
    if (filter === 'no-driver') {
      setCustomFilter('no-driver');
      setOrderStatusFilter('all'); // Reset status filter when using custom filter
    } else if (filter === 'pending') {
      setCustomFilter('pending');
      setOrderStatusFilter('pending');
    } else {
      setCustomFilter(null);
    }
    
    if (action === 'assign') {
      // Find first order without driver and open assignment dialog
      const orderWithoutDriver = orders.find(order => !order.driverId || order.driver?.name === 'HOLD Driver');
      if (orderWithoutDriver) {
        setSelectedOrder(orderWithoutDriver);
        setDriverDialogOpen(true);
        // Clear the action from URL
        navigate(location.pathname, { replace: true });
      }
    }
  }, [location.search, orders, navigate, location.pathname]);

  // Update filters when filter values change
  useEffect(() => {
    applyFilters(orders, orderStatusFilter, transactionStatusFilter, searchQuery, customFilter, orderTab, cancelledSubTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderStatusFilter, transactionStatusFilter, riderFilter, searchQuery, orders, customFilter, orderTab, cancelledSubTab]);

  const handleStatusUpdate = async (orderId, newStatus) => {
    if (newStatus === 'cancelled') {
      const targetOrder = orders.find(order => order.id === orderId) || null;
      setCancelTargetOrder(targetOrder);
      setCancelReason('');
      setCancelReasonError('');
      setCancelDialogOpen(true);
      return;
    }

    try {
      const response = await api.patch(`/admin/orders/${orderId}/status`, { status: newStatus });

      // Update orders list
      setOrders(prevOrders => {
        const updated = prevOrders.map(order => 
          order.id === orderId ? { ...order, status: newStatus, paymentStatus: response.data.paymentStatus } : order
        );
        // Re-sort after status update
        return sortOrdersByStatus(updated);
      });

      // Update currently viewed order details if it matches
      setSelectedOrderForDetail(prev =>
        prev && prev.id === orderId
          ? { ...prev, status: newStatus, paymentStatus: response.data.paymentStatus }
          : prev
      );
    } catch (error) {
      console.error('Error updating order status:', error);
      setError(error.response?.data?.error || error.message);
    }
  };

  const handleCloseCancelDialog = () => {
    setCancelDialogOpen(false);
    setCancelReason('');
    setCancelReasonError('');
    setCancelTargetOrder(null);
  };

  const handleConfirmCancel = async () => {
    if (!cancelTargetOrder) {
      return;
    }

    const trimmedReason = cancelReason.trim();
    if (!trimmedReason) {
      setCancelReasonError('Cancellation reason is required');
      return;
    }

    if (trimmedReason.length > 100) {
      setCancelReasonError('Reason must be 100 characters or fewer');
      return;
    }

    try {
      const response = await api.patch(`/admin/orders/${cancelTargetOrder.id}/status`, {
        status: 'cancelled',
        reason: trimmedReason
      });

      setOrders((prevOrders) => {
        const updated = prevOrders.map((order) =>
          order.id === cancelTargetOrder.id ? { ...order, status: 'cancelled', ...response.data } : order
        );
        return sortOrdersByStatus(updated);
      });

      handleCloseCancelDialog();
    } catch (error) {
      console.error('Error cancelling order:', error);
      setCancelReasonError(error.response?.data?.error || 'Failed to cancel order');
    }
  };

  const handleOpenPaymentDialog = (order) => {
    setSelectedOrderForPayment(order);
    // Prepopulate with order's customer phone, but allow admin to change it
    const phoneNumber = order.customerPhone && order.customerPhone !== 'POS' ? order.customerPhone : '';
    setPaymentPhone(phoneNumber);
    setPaymentError('');
    setPaymentSuccess(false);
    setPaymentDialogOpen(true);
  };

  const handleClosePaymentDialog = () => {
    setPaymentDialogOpen(false);
    setSelectedOrderForPayment(null);
    setPaymentPhone('');
    setPaymentError('');
    setPaymentSuccess(false);
    setProcessingPayment(false);
  };

  const handleMarkPaymentAsCash = async () => {
    if (!selectedOrderForPayment) {
      setPaymentError('Order not found');
      return;
    }

    if (!window.confirm(`Mark payment as received in cash (admin cash at hand) for Order #${selectedOrderForPayment.id}?\n\nAmount: KES ${Math.round(parseFloat(selectedOrderForPayment.totalAmount || 0))}\n\n${selectedOrderForPayment.driverId ? 'Driver will receive 50% cash at hand credit and 50% savings credit.' : ''}`)) {
      return;
    }

    setProcessingPayment(true);
    setPaymentError('');

    try {
      const response = await api.post(`/admin/orders/${selectedOrderForPayment.id}/mark-payment-cash`);
      
      if (response.data.success) {
        setPaymentError('');
        setPaymentSuccess(true);
        setProcessingPayment(false);
        alert('Payment marked as received in cash (admin cash at hand).' + (selectedOrderForPayment.driverId ? '\n\nDriver has been credited with 50% cash at hand and 50% savings.' : ''));
        // Refresh orders after a short delay to get updated payment status
        setTimeout(() => {
          fetchOrders();
          handleClosePaymentDialog();
        }, 1000);
      } else {
        setPaymentError(response.data.error || 'Failed to mark payment as cash. Please try again.');
        setProcessingPayment(false);
      }
    } catch (error) {
      console.error('Error marking payment as cash:', error);
      setPaymentError(error.response?.data?.error || error.message || 'Failed to mark payment as cash. Please try again.');
      setProcessingPayment(false);
    }
  };

  const handleInitiateMobileMoneyPayment = async () => {
    if (!paymentPhone || !validateSafaricomPhone(paymentPhone)) {
      setPaymentError('Please enter a valid Safaricom phone number (e.g., 0712345678)');
      return;
    }

    if (!selectedOrderForPayment) {
      setPaymentError('Order not found');
      return;
    }

    setProcessingPayment(true);
    setPaymentError('');

    try {
      const formattedPhone = formatMpesaPhoneNumber(paymentPhone);
      
      console.log('Admin initiating M-Pesa STK Push for order:', {
        phoneNumber: formattedPhone,
        amount: selectedOrderForPayment.totalAmount,
        orderId: selectedOrderForPayment.id
      });
      
      const paymentResponse = await api.post('/mpesa/stk-push', {
        phoneNumber: formattedPhone,
        amount: parseFloat(selectedOrderForPayment.totalAmount),
        orderId: selectedOrderForPayment.id,
        accountReference: `ORDER-${selectedOrderForPayment.id}`
      });

      if (paymentResponse.data.success) {
        setPaymentError('');
        setPaymentSuccess(true);
        setProcessingPayment(false);
        // Refresh orders after a short delay to get updated payment status
        setTimeout(() => {
          fetchOrders();
          handleClosePaymentDialog();
        }, 2000);
      } else {
        setPaymentError(paymentResponse.data.error || paymentResponse.data.message || 'Failed to initiate payment. Please try again.');
        setProcessingPayment(false);
      }
    } catch (paymentError) {
      console.error('Payment error:', paymentError);
      const errorMessage = paymentError.response?.data?.error || 
                          paymentError.response?.data?.message || 
                          paymentError.message || 
                          'Failed to initiate payment. Please try again.';
      setPaymentError(errorMessage);
      setProcessingPayment(false);
    }
  };

  // eslint-disable-next-line no-unused-vars
  const handlePromptPayment = async (orderId, customerPhone = null) => {
    try {
      setLoading(true);
      // Include customerPhone in request body if provided (for admin orders where customerPhone might be 'POS' or missing)
      const payload = customerPhone && customerPhone !== 'POS' ? { customerPhone } : {};
      const response = await api.post(`/admin/orders/${orderId}/prompt-payment`, payload);
      setError(null);
      // Show success message
      alert(response.data.message || 'Payment request sent to customer. They will receive an M-Pesa prompt on their phone.');
      // Refresh orders to get updated status
      fetchOrders();
    } catch (error) {
      console.error('Error prompting payment:', error);
      setError(error.response?.data?.error || error.message || 'Failed to prompt payment');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateItemPrice = async () => {
    if (!editingItem || !selectedOrderForDetail) return;
    
    const priceValue = parseFloat(newPrice);
    if (isNaN(priceValue) || priceValue < 0) {
      alert('Please enter a valid price');
      return;
    }

    setUpdatingPrice(true);
    try {
      const response = await api.patch(
        `/admin/orders/${selectedOrderForDetail.id}/items/${editingItem.id}/price`,
        { price: priceValue }
      );

      if (response.data.success) {
        // Update the order detail with the new data and breakdown so total/delivery fee display correctly
        const { order, breakdown } = response.data;
        setSelectedOrderForDetail((prev) => {
          const merged = {
            ...prev,
            ...(order || {}),
            items: order?.items ?? prev?.items
          };
          const amounts = computeOrderDisplayAmounts(merged);
          const lineSum = sumLineItemsSubtotal(merged);
          return {
            ...merged,
            itemsTotal: breakdown?.itemsTotal ?? lineSum ?? prev?.itemsTotal,
            totalAmount: breakdown?.totalAmount ?? order?.totalAmount ?? merged.totalAmount,
            convenienceFee: Math.round(amounts.convenienceFee),
            deliveryFee: Math.round(amounts.territoryDeliveryFee),
            territoryDeliveryFee: merged.territoryDeliveryFee ?? prev?.territoryDeliveryFee
          };
        });

        // Refresh the orders list to reflect the change
        await fetchOrders();
        
        // Close the dialog
        setEditPriceDialogOpen(false);
        setEditingItem(null);
        setNewPrice('');
        
        alert('Price updated successfully');
      } else {
        alert(response.data.error || 'Failed to update price');
      }
    } catch (error) {
      console.error('Error updating item price:', error);
      alert(error.response?.data?.error || error.message || 'Failed to update price');
    } finally {
      setUpdatingPrice(false);
    }
  };

  const handleUpdateDeliveryFee = async () => {
    if (!selectedOrderForDetail) return;
    
    const deliveryFeeValue = parseFloat(newDeliveryFee);
    if (isNaN(deliveryFeeValue) || deliveryFeeValue < 0) {
      alert('Please enter a valid delivery fee');
      return;
    }

    setUpdatingDeliveryFee(true);
    try {
      console.log('🔍 [FRONTEND] Updating delivery fee for order:', selectedOrderForDetail.id, 'new fee:', deliveryFeeValue);
      const response = await api.patch(
        `/admin/orders/${selectedOrderForDetail.id}/delivery-fee`,
        { deliveryFee: deliveryFeeValue }
      );
      console.log('🔍 [FRONTEND] Delivery fee update response:', response.data);

      if (response.data.success) {
        const { order, breakdown } = response.data;
        // Update the order detail with the new data and breakdown so UI shows updated fee and total
        setSelectedOrderForDetail(prev => ({
          ...(order || prev),
          deliveryFee: breakdown?.deliveryFee ?? order?.deliveryFee ?? prev.deliveryFee,
          totalAmount: breakdown?.totalAmount ?? order?.totalAmount ?? prev.totalAmount,
          itemsTotal: breakdown?.itemsTotal ?? order?.itemsTotal ?? prev.itemsTotal
        }));
        // Refresh the orders list to reflect the change
        await fetchOrders();
        // Close the edit dialog
        setEditDeliveryFeeDialogOpen(false);
        setNewDeliveryFee('');
        // Show green checkmark for updated delivery fee
        if (updatedFeeTimeoutRef.current) clearTimeout(updatedFeeTimeoutRef.current);
        setRecentlyUpdatedInOrderDetail(prev => ({ ...prev, deliveryFee: true }));
        updatedFeeTimeoutRef.current = setTimeout(() => {
          setRecentlyUpdatedInOrderDetail(prev => ({ ...prev, deliveryFee: false }));
          updatedFeeTimeoutRef.current = null;
        }, 4000);
        alert('Delivery fee updated successfully');
      } else {
        alert(response.data.error || 'Failed to update delivery fee');
      }
    } catch (error) {
      console.error('Error updating delivery fee:', error);
      console.error('Error response:', error.response);
      console.error('Error status:', error.response?.status);
      console.error('Error data:', error.response?.data);
      const errorMessage = error.response?.data?.error || error.response?.statusText || error.message || 'Failed to update delivery fee';
      alert(`Error: ${errorMessage} (Status: ${error.response?.status || 'N/A'})`);
    } finally {
      setUpdatingDeliveryFee(false);
    }
  };

  const handleUpdateConvenienceFee = async () => {
    if (!selectedOrderForDetail) return;
    setUpdatingConvenienceFee(true);
    try {
      const feeValue = parseFloat(newConvenienceFee);
      if (Number.isNaN(feeValue) || feeValue < 0) {
        alert('Please enter a valid convenience fee amount');
        return;
      }

      const response = await api.patch(
        `/admin/orders/${selectedOrderForDetail.id}/convenience-fee`,
        { convenienceFee: feeValue }
      );

      if (response.data?.success) {
        const order = response.data?.order;
        const breakdown = response.data?.breakdown;
        setSelectedOrderForDetail((prev) => ({
          ...prev,
          ...(order && {
            totalAmount: order.totalAmount,
            convenienceFee: order.convenienceFee
          }),
          ...(breakdown && {
            itemsTotal: breakdown.itemsTotal,
            totalAmount: breakdown.totalAmount
          })
        }));
        await fetchOrders();
        setEditConvenienceFeeDialogOpen(false);
        setNewConvenienceFee('');
        alert('Convenience fee updated successfully');
      } else {
        alert(response.data?.error || 'Failed to update convenience fee');
      }
    } catch (error) {
      console.error('Error updating convenience fee:', error);
      alert(error.response?.data?.error || error.message || 'Failed to update convenience fee');
    } finally {
      setUpdatingConvenienceFee(false);
    }
  };

  const handleUpdateItemsSubtotal = async () => {
    if (!selectedOrderForDetail) return;

    const subtotalValue = parseFloat(newItemsSubtotal);
    if (isNaN(subtotalValue) || subtotalValue < 0) {
      alert('Please enter a valid items subtotal');
      return;
    }

    setUpdatingItemsSubtotal(true);
    try {
      const response = await api.patch(
        `/admin/orders/${selectedOrderForDetail.id}/items-subtotal`,
        { itemsSubtotal: subtotalValue }
      );

      if (response.data?.success) {
        const { order, breakdown } = response.data;
        setSelectedOrderForDetail((prev) => {
          const merged = {
            ...prev,
            ...(order || {}),
            items: order?.items ?? prev?.items
          };
          const amounts = computeOrderDisplayAmounts(merged);
          const lineSum = sumLineItemsSubtotal(merged);
          return {
            ...merged,
            itemsTotal: breakdown?.itemsTotal ?? lineSum ?? merged.itemsTotal,
            convenienceFee: Math.round(amounts.convenienceFee),
            // Screen uses deliveryFee for INTERNAL territory fee — never use breakdown.deliveryFee (customer residual).
            deliveryFee: Math.round(amounts.territoryDeliveryFee),
            territoryDeliveryFee:
              merged.territoryDeliveryFee ?? amounts.territoryDeliveryFee ?? prev?.territoryDeliveryFee,
            totalAmount: breakdown?.totalAmount ?? order?.totalAmount ?? merged.totalAmount
          };
        });
        await fetchOrders();
        setEditItemsSubtotalDialogOpen(false);
        setNewItemsSubtotal('');
        alert('Items subtotal updated successfully');
      } else {
        alert(response.data?.error || 'Failed to update items subtotal');
      }
    } catch (error) {
      console.error('Error updating items subtotal:', error);
      alert(error.response?.data?.error || error.message || 'Failed to update items subtotal');
    } finally {
      setUpdatingItemsSubtotal(false);
    }
  };

  const handleSaveOrderDetails = async () => {
    if (!selectedOrderForDetail) return;
    setSavingOrderDetails(true);

    try {
      const id = selectedOrderForDetail.id;

      // 1) Save customer + delivery address
      const name = (selectedOrderForDetail.customerName || '').trim();
      const phone = (selectedOrderForDetail.customerPhone || '').trim();
      const address = (selectedOrderForDetail.deliveryAddress || '').trim();

      await api.patch(`/admin/orders/${id}`, {
        customerName: name || null,
        customerPhone: phone || null,
        deliveryAddress: address || null
      });

      // 2) Save driver
      const driverIdPayload =
        selectedOrderForDetail.driverId == null ||
        selectedOrderForDetail.driverId === ''
          ? null
          : parseInt(selectedOrderForDetail.driverId, 10);

      const originalDriverId =
        originalOrderDetailRef.current &&
        originalOrderDetailRef.current.id === id
          ? originalOrderDetailRef.current.driverId
          : null;

      const normalizedOriginalDriverId =
        originalDriverId == null || originalDriverId === ''
          ? null
          : parseInt(originalDriverId, 10);

      const normalizedDriverIdPayload =
        driverIdPayload == null ? null : driverIdPayload;

      const driverChanged =
        (normalizedOriginalDriverId == null ? null : normalizedOriginalDriverId) !==
        (normalizedDriverIdPayload == null ? null : normalizedDriverIdPayload);

      // CRITICAL: Don't call driver assignment endpoint unless driver actually changed.
      // This prevents noisy errors when order is already delivered/completed.
      const orderIsDeliveredOrCompleted =
        selectedOrderForDetail.status === 'delivered' ||
        selectedOrderForDetail.status === 'completed';

      if (
        driverChanged &&
        !orderIsDeliveredOrCompleted &&
        (normalizedDriverIdPayload === null || !Number.isNaN(normalizedDriverIdPayload))
      ) {
        try {
          await api.patch(`/admin/orders/${id}/driver`, {
            driverId: normalizedDriverIdPayload
          });
          // Keep baseline in sync so subsequent saves don't re-fire
          originalOrderDetailRef.current = { id, driverId: normalizedDriverIdPayload };
        } catch (driverErr) {
          const backendError = driverErr?.response?.data?.error;
          // If status just became delivered/completed, backend will reject driver mutation.
          // Don't block saving other fields.
          if (!String(backendError || '').includes('Cannot modify driver assignment')) {
            throw driverErr;
          }
        }
      }

      // 3) Save territory — only when the dropdown changed. PATCH /territory always reapplies the
      // territory master delivery fee (deliveryFromCBD) and would wipe a custom territoryDeliveryFee (e.g. 600 → 10).
      const territoryId =
        selectedTerritoryId === '' || selectedTerritoryId == null
          ? null
          : parseInt(selectedTerritoryId, 10);

      const existingTerritoryId =
        selectedOrderForDetail.territoryId ?? selectedOrderForDetail.territory?.id ?? null;
      const territorySelectionChanged =
        (existingTerritoryId == null ? null : Number(existingTerritoryId)) !==
        (territoryId == null || Number.isNaN(territoryId) ? null : territoryId);

      if (
        territorySelectionChanged &&
        (territoryId === null || !Number.isNaN(territoryId))
      ) {
        const territoryPayload =
          territoryId === null ? { territoryId: null } : { territoryId };

        const territoryResponse = await api.patch(
          `/admin/orders/${id}/territory`,
          territoryPayload
        );

        const updatedOrder = territoryResponse.data;
        const bd = updatedOrder.breakdown;
        const territory =
          territoryId && territories.find((t) => t.id === territoryId);

        setSelectedOrderForDetail((prev) => ({
          ...prev,
          territoryId: updatedOrder.territoryId,
          territory: territory
            ? { id: territory.id, name: territory.name }
            : null,
          // IMPORTANT: On this screen, `deliveryFee` represents the INTERNAL territory delivery fee.
          // `bd.deliveryFee` is the customer-facing convenience fee derived from totalAmount/itemsTotal.
          ...(bd && {
            totalAmount: bd.totalAmount,
            itemsTotal: bd.itemsTotal
          }),
          territoryDeliveryFee: updatedOrder.territoryDeliveryFee ?? prev.territoryDeliveryFee,
          deliveryFee:
            updatedOrder.territoryDeliveryFee ??
            prev.deliveryFee
        }));

        setOrders((prev) =>
          prev.map((o) =>
            o.id === updatedOrder.id
              ? {
                  ...o,
                  territoryId: updatedOrder.territoryId,
                  territory: territory
                    ? { id: territory.id, name: territory.name }
                    : null,
                  ...(bd && {
                    totalAmount: bd.totalAmount,
                    itemsTotal: bd.itemsTotal
                  }),
                  territoryDeliveryFee:
                    updatedOrder.territoryDeliveryFee ?? o.territoryDeliveryFee,
                  deliveryFee:
                    updatedOrder.territoryDeliveryFee ?? o.deliveryFee
                }
              : o
          )
        );

        setFilteredOrders((prev) =>
          prev.map((o) =>
            o.id === updatedOrder.id
              ? {
                  ...o,
                  territoryId: updatedOrder.territoryId,
                  territory: territory
                    ? { id: territory.id, name: territory.name }
                    : null,
                  ...(bd && {
                    totalAmount: bd.totalAmount,
                    itemsTotal: bd.itemsTotal
                  }),
                  territoryDeliveryFee:
                    updatedOrder.territoryDeliveryFee ?? o.territoryDeliveryFee,
                  deliveryFee:
                    updatedOrder.territoryDeliveryFee ?? o.deliveryFee
                }
              : o
          )
        );
      }

      // 4) Save delivery fee when it was changed and backend allows edits (includes paid + completed)
      if (
        recentlyUpdatedInOrderDetail.deliveryFee &&
        canEditOrderFinancialAmounts(selectedOrderForDetail)
      ) {
        const rawFee = selectedOrderForDetail.deliveryFee;
        const deliveryFeeValue =
          rawFee === '' || rawFee == null ? null : parseFloat(rawFee);

        if (deliveryFeeValue != null) {
          if (Number.isNaN(deliveryFeeValue) || deliveryFeeValue < 0) {
            alert('Please enter a valid delivery fee');
          } else {
            const feeResponse = await api.patch(
              `/admin/orders/${id}/delivery-fee`,
              { deliveryFee: deliveryFeeValue }
            );

            if (feeResponse.data && feeResponse.data.success) {
              const { order, breakdown } = feeResponse.data;
              setSelectedOrderForDetail((prev) => ({
                ...(order || prev),
                deliveryFee:
                  order?.territoryDeliveryFee ??
                  order?.deliveryFee ??
                  prev.deliveryFee,
                totalAmount:
                  breakdown?.totalAmount ??
                  order?.totalAmount ??
                  prev.totalAmount,
                itemsTotal:
                  breakdown?.itemsTotal ??
                  order?.itemsTotal ??
                  prev.itemsTotal
              }));

              // We'll refresh once at the end
            }
          }
        }
      }
      // Single refresh after all saves
      await fetchOrders();
    } catch (error) {
      console.error('Error saving order details:', error);
      alert(
        error.response?.data?.error ||
          error.message ||
          'Failed to save order details'
      );
    } finally {
      setSavingOrderDetails(false);
    }
  };

  const handleCloseDriverDialog = () => {
    setDriverDialogOpen(false);
    setSelectedOrder(null);
    setSelectedDriverId('');
  };

  const handleAssignDriver = async () => {
    if (!selectedOrder) return;
    
    try {
      const driverId = selectedDriverId === '' ? null : parseInt(selectedDriverId);
      await api.patch(`/admin/orders/${selectedOrder.id}/driver`, { driverId });
      
      // Refresh orders to get updated data
      await fetchOrders();
      handleCloseDriverDialog();
    } catch (error) {
      console.error('Error assigning driver:', error);
      setError(error.response?.data?.error || error.message);
    }
  };

  // eslint-disable-next-line no-unused-vars
  const _handleOpenBranchDialog = (order) => {
    // Prevent opening dialog for cancelled or completed orders
    if (order.status === 'cancelled') {
      setError('Cannot change branch assignment for cancelled orders.');
      return;
    }
    if (order.status === 'completed') {
      setError('Cannot change branch assignment for completed orders.');
      return;
    }
    setSelectedOrder(order);
    setSelectedBranchId(order.branchId || '');
    setReassignDriver(false); // Reset reassign driver option
    setBranchDialogOpen(true);
  };

  const handleCloseBranchDialog = () => {
    setBranchDialogOpen(false);
    setSelectedOrder(null);
    setSelectedBranchId('');
    setReassignDriver(false);
  };

  const handleAssignBranch = async () => {
    if (!selectedOrder) return;
    
    // Prevent branch assignment for cancelled or completed orders
    if (selectedOrder.status === 'cancelled') {
      setError('Cannot change branch assignment for cancelled orders.');
      return;
    }
    if (selectedOrder.status === 'completed') {
      setError('Cannot change branch assignment for completed orders.');
      return;
    }
    
    try {
      const branchId = selectedBranchId === '' ? null : parseInt(selectedBranchId);
      const oldBranchId = selectedOrder.branchId;
      
      // Only show driver reassignment option if branch is actually changing and new branch is set
      const shouldReassignDriver = reassignDriver && branchId !== oldBranchId && branchId !== null;
      
      await api.patch(`/admin/orders/${selectedOrder.id}/branch`, { 
        branchId,
        reassignDriver: shouldReassignDriver
      });
      
      // Refresh orders to get updated data
      await fetchOrders();
      handleCloseBranchDialog();
    } catch (error) {
      console.error('Error assigning branch:', error);
      setError(error.response?.data?.error || error.message);
    }
  };

  // Route Optimisation functions

  const fetchRiderRoutes = async () => {
    try {
      setRoutesLoading(true);
      const [ridersResponse, ordersResponse, locationsResponse] = await Promise.all([
        api.get('/drivers'),
        api.get('/admin/orders?summary=1&limit=300'),
        api.get('/admin/drivers/locations').catch(() => ({ data: { locations: [] } }))
      ]);
      
      // Ensure ridersResponse.data is an array
      const ridersData = ridersResponse.data;
      const fetchedRiders = Array.isArray(ridersData) 
        ? ridersData 
        : (ridersData && Array.isArray(ridersData.data) ? ridersData.data : []);
      setAllRiders(fetchedRiders);
      const allOrders = Array.isArray(ordersResponse.data)
        ? ordersResponse.data
        : (ordersResponse.data?.orders || []);
      
      // Store rider locations
      const locationsMap = {};
      if (locationsResponse.data?.locations) {
        locationsResponse.data.locations.forEach(loc => {
          locationsMap[loc.id] = {
            lat: loc.latitude,
            lng: loc.longitude
          };
        });
      }
      setRiderLocations(locationsMap);
      
      // Filter orders that are assigned and active (not cancelled or completed)
      const activeOrders = allOrders.filter(order => 
        order.driverId && 
        order.status !== 'cancelled' && 
        order.status !== 'completed'
      );
      
      // Group orders by rider and sort by deliverySequence (if available) or createdAt
      const routes = fetchedRiders.map(rider => {
        const riderOrders = activeOrders
          .filter(order => order.driverId === rider.id)
          .sort((a, b) => {
            // Sort by deliverySequence if available, otherwise by createdAt
            if (a.deliverySequence !== null && b.deliverySequence !== null) {
              return (a.deliverySequence || 0) - (b.deliverySequence || 0);
            }
            if (a.deliverySequence !== null) return -1;
            if (b.deliverySequence !== null) return 1;
            return new Date(a.createdAt) - new Date(b.createdAt);
          });
        
        return {
          rider,
          orders: riderOrders
        };
      }).filter(route => route.orders.length > 0);
      
      // Fetch stops from database
      const stopsMap = {};
      try {
        for (const route of routes) {
          const stopsResponse = await api.get(`/admin/stops/driver/${route.rider.id}`);
          if (stopsResponse.data?.stops) {
            stopsMap[route.rider.id] = stopsResponse.data.stops.map(stop => ({
              stop: {
                id: stop.id,
                name: stop.name,
                location: stop.location,
                instruction: stop.instruction,
                payment: stop.payment,
                sequence: stop.sequence
              },
              insertAfterIndex: stop.insertAfterIndex
            }));
          }
        }
        setStops(stopsMap);
      } catch (stopsError) {
        console.error('Error fetching stops:', stopsError);
        // Continue without stops if API fails
      }
      
      // Always update allRiderRoutes with all routes
      setAllRiderRoutes(routes);
      
      // Update riderRoutes based on selectedRiders filter
      if (selectedRiders.length > 0) {
        const selectedIds = selectedRiders.map(rider => rider.id);
        const existingRoutes = routes.filter(route => selectedIds.includes(route.rider.id));
        const ridersWithoutRoutes = selectedRiders.filter(rider => 
          !routes.some(route => route.rider.id === rider.id)
        );
        const newRoutes = ridersWithoutRoutes.map(rider => ({
          rider,
          orders: []
        }));
        setRiderRoutes([...existingRoutes, ...newRoutes]);
      } else {
        // No selected riders, show all routes
        setRiderRoutes(routes);
      }
    } catch (error) {
      console.error('Error fetching rider routes:', error);
      setError(error.response?.data?.error || error.message);
      setAllRiders([]);
      setAllRiderRoutes([]);
      setRiderRoutes([]);
    } finally {
      setRoutesLoading(false);
    }
  };


  // eslint-disable-next-line no-unused-vars
  const handleRefreshLocations = async () => {
    setRefreshingLocations(true);
    try {
      const locationsResponse = await api.get('/admin/drivers/locations');
      const locationsMap = {};
      if (locationsResponse.data?.locations) {
        locationsResponse.data.locations.forEach(loc => {
          locationsMap[loc.id] = {
            lat: loc.latitude,
            lng: loc.longitude
          };
        });
      }
      setRiderLocations(locationsMap);
    } catch (error) {
      console.error('Error refreshing locations:', error);
    } finally {
      setRefreshingLocations(false);
    }
  };



  // Helper function to update optimization progress
  // eslint-disable-next-line no-unused-vars
  const updateOptimizationProgress = (step, currentStep, progress) => {
    setOptimizationProgress({
      open: true,
      step,
      totalSteps: 9,
      currentStep,
      progress
    });
  };

  useEffect(() => {
    if (!optimizationProgress.open) return undefined;
    const timeoutId = setTimeout(() => {
      setOptimizationProgress((prev) => ({ ...prev, open: false }));
    }, 30000);
    return () => clearTimeout(timeoutId);
  }, [optimizationProgress.open]);
  
  const getNextStatusOptions = (currentStatus, paymentType, paymentStatus) => {
    const options = [];
    
    if (currentStatus === 'pending') {
      // For Pay Later orders, admin confirms manually
      // For Pay Now orders, they should already be confirmed automatically when payment completes
      // But if still pending, allow manual confirmation
      if (paymentType === 'pay_on_delivery') {
        options.push({ value: 'confirmed', label: 'Confirm Order (Manual)' });
      } else {
        // Pay Now but still pending - allow confirmation
        options.push({ value: 'confirmed', label: 'Confirm Order' });
      }
      options.push({ value: 'cancelled', label: 'Cancel' });
    } else if (currentStatus === 'confirmed') {
      options.push({ value: 'out_for_delivery', label: 'On the Way' });
      options.push({ value: 'cancelled', label: 'Cancel' });
    } else if (currentStatus === 'out_for_delivery') {
      options.push({ value: 'delivered', label: 'Mark as Delivered' });
    } else if (currentStatus === 'delivered') {
      // If payment is paid, can mark as completed
      if (paymentStatus === 'paid') {
        options.push({ value: 'completed', label: 'Mark as Completed' });
      }
      // If unpaid, show button to mark payment received
    }
    
    return options;
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>Loading orders...</Typography>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="error">Error loading orders: {error}</Alert>
      </Container>
    );
  }

  const pendingCancellationRequestsCount = orders.filter(
    (order) => order.cancellationRequested && order.cancellationApproved === null
  ).length;

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Assignment sx={{ color: colors.accentText, fontSize: 40 }} />
            <Typography variant="h4" component="h1" gutterBottom sx={{ color: colors.accentText, fontWeight: 700 }}>
              Orders
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<ShoppingCart />}
            onClick={() => setNewOrderDialogOpen(true)}
            sx={{
              backgroundColor: colors.accentText,
              color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
              '&:hover': { backgroundColor: '#00C4A3' }
            }}
          >
            POS
          </Button>
        </Box>
        <Typography variant="h6" color="text.secondary">
          Manage customer orders and track their status
        </Typography>
      </Box>

      {/* Orders Management */}
      <Box>
      {/* Order Tabs: Completed, Pending, Unassigned */}
      <Paper sx={{ mb: 3, backgroundColor: colors.paper }}>
        <Tabs
          value={orderTab}
          onChange={(event, newValue) => {
            setOrderTab(newValue);
            if (newValue !== 'cancelled') {
              setCancelledSubTab('cancelled');
            }
            setPage(0);
            applyFilters(orders, orderStatusFilter, transactionStatusFilter, searchQuery, customFilter, newValue, cancelledSubTab);
          }}
          variant={isMobile ? "scrollable" : "standard"}
          scrollButtons={isMobile ? "auto" : false}
          allowScrollButtonsMobile
          sx={{
            '& .MuiTab-root': {
              minHeight: 48,
              color: colors.textSecondary,
              fontSize: isMobile ? '0.85rem' : '0.95rem',
              minWidth: isMobile ? 'auto' : 160,
              px: isMobile ? 2 : 3,
              '&.Mui-selected': {
                color: colors.accentText,
                fontWeight: 600
              }
            },
            '& .MuiTabs-indicator': {
              backgroundColor: colors.accentText,
              height: 3
            }
          }}
        >
          <Tab label="Unassigned" value="unassigned" />
          <Tab label="Pending" value="pending" />
          <Tab label="In Progress" value="confirmed" />
          <Tab label="Out for Delivery" value="out_for_delivery" />
          <Tab label="Completed" value="completed" />
          <Tab
            value="cancelled"
            label={
              <Badge
                color="warning"
                variant="dot"
                invisible={pendingCancellationRequestsCount === 0}
                sx={{
                  '& .MuiBadge-badge': {
                    right: -6,
                    top: 4
                  }
                }}
              >
                Cancelled
              </Badge>
            }
          />
        </Tabs>
      </Paper>

      {orderTab === 'cancelled' && (
        <Paper sx={{ mb: 3, backgroundColor: colors.paper }}>
          <Tabs
            value={cancelledSubTab}
            onChange={(event, newValue) => {
              setCancelledSubTab(newValue);
              setPage(0);
              applyFilters(orders, orderStatusFilter, transactionStatusFilter, searchQuery, customFilter, 'cancelled', newValue);
            }}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              '& .MuiTab-root': {
                minHeight: 44,
                color: colors.textSecondary,
                fontSize: '0.9rem',
                '&.Mui-selected': {
                  color: colors.accentText,
                  fontWeight: 600
                }
              },
              '& .MuiTabs-indicator': {
                backgroundColor: colors.accentText,
                height: 3
              }
            }}
          >
            <Tab label="Cancelled Orders" value="cancelled" />
            <Tab
              value="cancellation-requests"
              label={
                pendingCancellationRequestsCount > 0
                  ? `Cancellation Requests (${pendingCancellationRequestsCount})`
                  : 'Cancellation Requests'
              }
            />
          </Tabs>
        </Paper>
      )}

      {/* Filters */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search Input */}
        <TextField
          size="small"
          placeholder={isMobile ? "Search orders..." : "Search by order number or customer name..."}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ color: colors.accentText }} />
              </InputAdornment>
            ),
            endAdornment: searchQuery && (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  onClick={() => setSearchQuery('')}
                  sx={{ color: 'text.secondary' }}
                >
                  <Clear fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
          }}
            sx={{
              minWidth: isMobile ? '100%' : 300,
              flexGrow: isMobile ? 1 : 0,
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: colors.accentText,
                },
                '&:hover fieldset': {
                  borderColor: '#00C4A3',
                },
                '&.Mui-focused fieldset': {
                  borderColor: colors.accentText,
                },
              },
              '& .MuiInputBase-input': {
                color: colors.textPrimary,
              },
              '& .MuiInputBase-input::placeholder': {
                color: colors.textSecondary,
                opacity: 1,
              },
            }}
        />

        <FormControl size="small" sx={{ minWidth: isMobile ? '100%' : 200, flexGrow: isMobile ? 1 : 0 }}>
          <InputLabel>Filter by Order Status</InputLabel>
          <Select
            value={orderStatusFilter}
            label="Filter by Order Status"
            onChange={(e) => setOrderStatusFilter(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: colors.accentText,
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: '#00C4A3',
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: colors.accentText,
              },
            }}
          >
            <MenuItem value="all">All Statuses</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="confirmed">In Progress</MenuItem>
            <MenuItem value="out_for_delivery">On the Way</MenuItem>
            <MenuItem value="delivered">Delivered</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
            <MenuItem value="pos_order">POS Order</MenuItem>
            <MenuItem value="cancelled">Cancelled</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: isMobile ? '100%' : 200, flexGrow: isMobile ? 1 : 0 }}>
          <InputLabel>Filter by Transaction Status</InputLabel>
          <Select
            value={transactionStatusFilter}
            label="Filter by Transaction Status"
            onChange={(e) => setTransactionStatusFilter(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: colors.accentText,
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: '#00C4A3',
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: colors.accentText,
              },
            }}
          >
            <MenuItem value="all">All Transactions</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
            <MenuItem value="failed">Failed</MenuItem>
            <MenuItem value="cancelled">Cancelled</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: isMobile ? '100%' : 220, flexGrow: isMobile ? 1 : 0 }}>
          <InputLabel>Rider</InputLabel>
          <Select
            value={riderFilter}
            label="Rider"
            onChange={(e) => setRiderFilter(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: colors.accentText,
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: '#00C4A3',
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: colors.accentText,
              },
            }}
          >
            <MenuItem value="all">All riders</MenuItem>
            <MenuItem value="unassigned">Unassigned / HOLD</MenuItem>
            {[...drivers]
              .filter((d) => d && d.id != null && String(d.name || '').trim() !== 'HOLD Driver')
              .sort((a, b) =>
                String(a.name || '').localeCompare(String(b.name || ''), undefined, {
                  sensitivity: 'base'
                })
              )
              .map((d) => (
                <MenuItem key={d.id} value={String(d.id)}>
                  {d.name || `Rider #${d.id}`}
                </MenuItem>
              ))}
          </Select>
        </FormControl>

        {(orderStatusFilter !== 'all' ||
          transactionStatusFilter !== 'all' ||
          searchQuery ||
          riderFilter !== 'all') && (
          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              setOrderStatusFilter('all');
              setTransactionStatusFilter('all');
              setRiderFilter('all');
              setSearchQuery('');
            }}
            sx={{
              borderColor: colors.border,
              color: colors.textPrimary,
              '&:hover': { borderColor: colors.textSecondary }
            }}
          >
            Clear Filters
          </Button>
        )}

        <Box sx={{ ml: 'auto' }}>
          <Typography variant="body2">
            Showing {filteredOrders.length} of {orders.length} orders
          </Typography>
        </Box>
      </Box>

      {filteredOrders.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <ShoppingCart sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            No orders found
          </Typography>
        </Paper>
      ) : isMobile ? (
        // Mobile Card View
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {filteredOrders.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((order) => {
            const isUnpaidDelivered = order.status === 'delivered' && order.paymentStatus === 'unpaid';
            const hasPendingCancellation = order.cancellationRequested && order.cancellationApproved === null;
            const paymentStatusChip = getPaymentStatusChipProps(order.paymentStatus, order.status);
            const orderStatusChip = getOrderStatusChipProps(order.status);
            
            return (
              <Card
                key={order.id}
                onClick={() => openOrderDetails(order)}
                sx={{
                  backgroundColor: hasPendingCancellation 
                    ? 'rgba(255, 193, 7, 0.1)' 
                    : isUnpaidDelivered 
                      ? 'rgba(255, 51, 102, 0.05)' 
                      : colors.paper,
                  borderLeft: hasPendingCancellation ? '4px solid #FFC107' : isUnpaidDelivered ? '4px solid #f44336' : 'none',
                  cursor: 'pointer',
                  '&:active': {
                    backgroundColor: hasPendingCancellation 
                      ? 'rgba(255, 193, 7, 0.2)' 
                      : isUnpaidDelivered 
                        ? 'rgba(255, 51, 102, 0.1)' 
                        : 'rgba(0, 224, 184, 0.05)'
                  }
                }}
              >
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  {/* Header: Order ID and Amount */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem', mb: 0.5 }}>
                        #{order.id}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(order.createdAt).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: colors.accentText }}>
                        KES {Math.round(computeOrderSummaryCustomerTotal(order))}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {order.paymentType === 'pay_now' ? 'Paid Now' : 'Cash on Delivery'}
                      </Typography>
                    </Box>
                  </Box>

                  <Divider sx={{ my: 1.5 }} />

                  {/* Customer Info */}
                  <Box sx={{ mb: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Person fontSize="small" sx={{ color: 'text.secondary' }} />
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {order.customerName}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 3.5 }}>
                      <Phone fontSize="small" sx={{ color: 'text.secondary' }} />
                      <Typography variant="caption" color="text.secondary">
                        {order.customerPhone || 'N/A'}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Delivery Address */}
                  {order.deliveryAddress && order.deliveryAddress !== 'In-Store Purchase' && (
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1.5 }}>
                      <LocationOn fontSize="small" sx={{ color: 'text.secondary', mt: 0.25 }} />
                      <Typography variant="body2" color="text.secondary" sx={{ flex: 1, wordBreak: 'break-word' }}>
                        {order.deliveryAddress.split(',').slice(0, 2).join(',')}
                      </Typography>
                    </Box>
                  )}

                  {/* Driver Info */}
                  {order.driverId && order.driver && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                      <LocalShipping fontSize="small" sx={{ color: 'text.secondary' }} />
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {order.driver.name}
                      </Typography>
                      {order.driverAccepted === true && (
                        <Chip label="Accepted" size="small" color="success" sx={{ height: 20, fontSize: '0.7rem' }} />
                      )}
                    </Box>
                  )}

                  {/* Status Chips */}
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
                    {orderStatusChip && (
                      <Chip
                        size="small"
                        {...orderStatusChip}
                        sx={{ ...orderStatusChip.sx, fontSize: '0.75rem' }}
                      />
                    )}
                    {paymentStatusChip && (
                      <Chip
                        size="small"
                        {...paymentStatusChip}
                        sx={{ ...paymentStatusChip.sx, fontSize: '0.75rem' }}
                      />
                    )}
                    {order.deliveryAddress === 'In-Store Purchase' && (
                      <Chip label="POS" size="small" color="success" sx={{ fontSize: '0.75rem' }} />
                    )}
                    {hasPendingCancellation && (
                      <Chip label="Cancellation Req" color="warning" size="small" sx={{ fontSize: '0.75rem' }} />
                    )}
                    {isUnpaidDelivered && (
                      <Chip label="Unpaid!" color="error" size="small" sx={{ fontSize: '0.75rem' }} />
                    )}
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Box>
      ) : (
        // Desktop Table View
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Order ID</TableCell>
                <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Customer</TableCell>
                <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Total Amount</TableCell>
                <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Payment Status</TableCell>
                <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Delivery Address</TableCell>
                <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Driver</TableCell>
                <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredOrders.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((order) => {
                const isUnpaidDelivered = order.status === 'delivered' && order.paymentStatus === 'unpaid';
                const hasPendingCancellation = order.cancellationRequested && order.cancellationApproved === null;
                const paymentStatusChip = getPaymentStatusChipProps(order.paymentStatus, order.status);
                const deliveryAddressShort = (order.deliveryAddress || '')
                  .trim()
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .join(' ');
                
                return (
                  <TableRow
                    key={order.id}
                    onClick={() => openOrderDetails(order)}
                    sx={{
                      backgroundColor: hasPendingCancellation 
                        ? 'rgba(255, 193, 7, 0.2)' 
                        : isUnpaidDelivered 
                          ? 'rgba(255, 51, 102, 0.1)' 
                          : 'transparent',
                      cursor: 'pointer',
                      borderLeft: hasPendingCancellation ? '4px solid #FFC107' : 'none',
                      '&:hover': {
                        backgroundColor: hasPendingCancellation 
                          ? 'rgba(255, 193, 7, 0.25)' 
                          : isUnpaidDelivered 
                            ? 'rgba(255, 51, 102, 0.15)' 
                            : 'rgba(0, 224, 184, 0.05)'
                      }
                    }}
                  >
                    <TableCell>
                      <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '1rem' }}>
                        #{order.id}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.95rem' }}>
                          {order.customerName}
                        </Typography>
                        <Typography variant="caption">
                          {order.customerPhone || 'N/A'}
                        </Typography>
                        {order.customerEmail && (
                          <Typography variant="caption" display="block">
                            {order.customerEmail}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '1rem' }}>
                          KES {Math.round(computeOrderSummaryCustomerTotal(order))}
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          <Typography variant="caption">
                            {order.paymentType === 'pay_now' ? 'Paid Now' : 'Pay on Delivery'}
                          </Typography>
                          {(() => {
                            // Calculate profit/loss (subtract territory delivery fee, not convenience fee)
                            const totalAmount = computeOrderSummaryCustomerTotal(order);
                            const orderItems = order.items || order.orderItems || [];
                            const { territoryDeliveryFee } = computeOrderDisplayAmounts(order);
                            
                            let totalPurchaseCost = 0;
                            orderItems.forEach(item => {
                              if (item.drink && item.drink.purchasePrice !== null && item.drink.purchasePrice !== undefined) {
                                const purchasePriceRaw = item.drink.purchasePrice;
                                const strValue = String(purchasePriceRaw).trim();
                                if (strValue !== '' && strValue !== 'null' && strValue !== 'undefined') {
                                  const purchasePrice = parseFloat(strValue);
                                  if (!isNaN(purchasePrice) && isFinite(purchasePrice) && purchasePrice >= 0) {
                                    const quantity = parseInt(item.quantity) || 0;
                                    totalPurchaseCost += purchasePrice * quantity;
                                  }
                                }
                              }
                            });
                            
                            const profit = totalAmount - totalPurchaseCost - territoryDeliveryFee;
                            
                            if (totalPurchaseCost > 0) {
                              const profitAmount = Math.abs(profit);
                              const profitLabel = profit >= 0 
                                ? `PROFIT +KES ${Math.round(profitAmount)}`
                                : `LOSS -KES ${Math.round(profitAmount)}`;
                              return (
                                <Chip
                                  label={profitLabel}
                                  size="small"
                                  sx={{
                                    backgroundColor: profit >= 0 ? 'rgba(76, 175, 80, 0.2)' : '#e0e0e0',
                                    color: profit >= 0 ? '#2e7d32' : '#000000',
                                    fontWeight: 600,
                                    fontSize: '0.7rem',
                                    height: '20px'
                                  }}
                                />
                              );
                            }
                            return null;
                          })()}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                        {paymentStatusChip ? (
                          <Chip
                            size="small"
                            {...paymentStatusChip}
                          />
                        ) : (
                          <Chip size="small" label="—" />
                        )}
                        {order.paymentMethod && (() => {
                          const methodChip = getPaymentMethodChipProps(order.paymentMethod);
                          if (methodChip) {
                            return (
                              <Chip
                                size="small"
                                label={methodChip.label}
                                sx={{
                                  fontSize: '0.7rem',
                                  height: '20px',
                                  ...methodChip.sx
                                }}
                              />
                            );
                          }
                          return null;
                        })()}
                        {isUnpaidDelivered && (
                          <Tooltip title="This order has been delivered but payment is still unpaid">
                            <IconButton size="small" sx={{ color: 'error.main' }}>
                              <Warning />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
                          {deliveryAddressShort || '—'}
                        </Typography>
                        {order.deliveryAddress === 'In-Store Purchase' && (
                          <Chip
                            label="POS"
                            size="small"
                            sx={{
                              backgroundColor: 'rgba(76, 175, 80, 0.2)',
                              color: '#2e7d32',
                              fontWeight: 600,
                              fontSize: '0.65rem',
                              height: '20px'
                            }}
                          />
                        )}
                        {order.adminOrder && (
                          <Chip
                            label="Admin Order"
                            size="small"
                            sx={{
                              backgroundColor: '#e0e0e0',
                              color: '#000000',
                              fontWeight: 600,
                              fontSize: '0.65rem',
                              height: '20px'
                            }}
                          />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      {order.driverId && order.driver ? (
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <Person fontSize="small" color="text.secondary" />
                            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.95rem' }}>
                              {order.driver.name}
                            </Typography>
                          </Box>
                          {order.driverAccepted === true && (
                            <Chip 
                              label="Accepted" 
                              size="small" 
                              sx={{ 
                                mt: 0.5,
                                backgroundColor: 'rgba(76, 175, 80, 0.2)',
                                color: '#2e7d32',
                                fontWeight: 600
                              }}
                            />
                          )}
                          {order.driverAccepted === false && (
                            <Chip 
                              label="Rejected" 
                              size="small" 
                              sx={{ 
                                mt: 0.5,
                                backgroundColor: '#e0e0e0',
                                color: '#000000',
                                fontWeight: 600
                              }}
                            />
                          )}
                          {order.driverAccepted === null && order.driverId && (
                            <Chip 
                              label="Pending Response" 
                              size="small" 
                              sx={{ 
                                mt: 0.5,
                                backgroundColor: '#e0e0e0',
                                color: '#000000',
                                fontWeight: 600
                              }}
                            />
                          )}
                          {hasPendingCancellation && (
                            <Chip 
                              label="Cancellation Requested" 
                              color="warning" 
                              size="small" 
                              sx={{ 
                                mt: 0.5,
                                backgroundColor: '#FFC107',
                                color: '#000',
                                fontWeight: 600
                              }}
                            />
                          )}
                        </Box>
                      ) : !order.driverId ? (
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <Person fontSize="small" color="disabled" />
                            <Typography
                              variant="body2"
                              sx={{ fontWeight: 600, color: '#000000', fontSize: '0.95rem' }}
                            >
                              Unassigned
                            </Typography>
                          </Box>
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.95rem' }}>
                          Not assigned
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Typography>
                      <Typography variant="caption">
                        {new Date(order.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box
                        sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {hasPendingCancellation && (
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                              variant="contained"
                              size="small"
                              onClick={() => handleApproveCancellation(order.id)}
                              disabled={processingCancellationRequest}
                              sx={{
                                backgroundColor: colors.accentText,
                                color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
                                '&:hover': { backgroundColor: '#00C4A3' },
                                '&.Mui-disabled': { backgroundColor: colors.border, color: colors.textSecondary }
                              }}
                            >
                              Approve
                            </Button>
                            <Button
                              variant="outlined"
                              size="small"
                              onClick={() => handleRejectCancellation(order.id)}
                              disabled={processingCancellationRequest}
                              sx={{
                                borderColor: '#000000',
                                color: '#000000',
                                '&:hover': {
                                  borderColor: '#000000',
                                  backgroundColor: 'rgba(0,0,0,0.04)'
                                },
                                '&.Mui-disabled': { borderColor: colors.border, color: colors.textSecondary }
                              }}
                            >
                              Reject
                            </Button>
                          </Box>
                        )}
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<Edit />}
                          onClick={() => openOrderDetails(order)}
                          sx={{
                            borderColor: '#000000',
                            color: '#000000',
                            '&:hover': {
                              borderColor: '#000000',
                              backgroundColor: 'rgba(0,0,0,0.04)'
                            }
                          }}
                        >
                          Details
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={filteredOrders.length}
            page={page}
            onPageChange={(event, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(event) => {
              setRowsPerPage(parseInt(event.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={isMobile ? [5, 10, 25] : [10, 25, 50, 100]}
            labelRowsPerPage={isMobile ? 'Per page:' : 'Rows per page:'}
            sx={{
              backgroundColor: colors.paper,
              borderTop: `1px solid ${colors.border}`,
              '& .MuiTablePagination-toolbar': {
                color: colors.textPrimary
              },
              '& .MuiTablePagination-selectLabel': {
                color: colors.textPrimary
              },
              '& .MuiTablePagination-displayedRows': {
                color: colors.textPrimary
              },
              '& .MuiTablePagination-select': {
                color: colors.textPrimary,
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: colors.border
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: colors.accentText
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: colors.accentText
                }
              },
              '& .MuiIconButton-root': {
                color: colors.textPrimary,
                '&:hover': {
                  backgroundColor: 'rgba(0, 224, 184, 0.1)',
                  color: colors.accentText
                },
                '&.Mui-disabled': {
                  color: colors.textSecondary
                }
              }
            }}
          />
        </TableContainer>
      )}

      {/* Branch Assignment Dialog */}
      <Dialog 
        open={branchDialogOpen} 
        onClose={handleCloseBranchDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: colors.accentText, fontWeight: 700 }}>
          {selectedOrder?.branch ? 'Change Branch' : 'Assign Branch'}
        </DialogTitle>
        <DialogContent>
          {selectedOrder?.status === 'cancelled' && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              This order has been cancelled. Branch assignment cannot be changed.
            </Alert>
          )}
          {selectedOrder?.status === 'completed' && (
            <Alert severity="info" sx={{ mb: 2 }}>
              This order has been completed. Branch assignment cannot be changed.
            </Alert>
          )}
          <Box sx={{ mt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Select Branch</InputLabel>
              <Select
                value={selectedBranchId}
                label="Select Branch"
                disabled={selectedOrder?.status === 'cancelled' || selectedOrder?.status === 'completed'}
                onChange={(e) => {
                  setSelectedBranchId(e.target.value);
                  // Reset reassign driver option when branch changes
                  setReassignDriver(false);
                }}
              >
                <MenuItem value="">
                  <em>No Branch (Unassign)</em>
                </MenuItem>
                {branches.map((branch) => (
                  <MenuItem key={branch.id} value={branch.id}>
                    {branch.name} - {branch.address}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {selectedOrder && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Order #{selectedOrder.id} - {selectedOrder.customerName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Delivery: {selectedOrder.deliveryAddress}
                </Typography>
                {selectedOrder.driver && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Current Driver: {selectedOrder.driver.name}
                  </Typography>
                )}
              </Box>
            )}
            {/* Show driver reassignment option only if branch is changing and new branch is selected */}
            {selectedOrder && 
             selectedBranchId !== '' && 
             parseInt(selectedBranchId) !== selectedOrder.branchId && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                  Driver Assignment
                </Typography>
                <FormControl fullWidth>
                  <Select
                    value={reassignDriver ? 'reassign' : 'keep'}
                    onChange={(e) => setReassignDriver(e.target.value === 'reassign')}
                  >
                    <MenuItem value="keep">
                      Keep Current Driver ({selectedOrder.driver?.name || 'No Driver'})
                    </MenuItem>
                    <MenuItem value="reassign">
                      Auto-assign Nearest Active Driver to New Branch
                    </MenuItem>
                  </Select>
                </FormControl>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  {reassignDriver 
                    ? 'A new active driver nearest to the selected branch will be assigned.'
                    : 'The current driver will remain assigned to this order.'}
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleCloseBranchDialog}
            sx={{ color: 'text.secondary' }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAssignBranch}
            variant="contained"
            disabled={selectedOrder?.status === 'cancelled' || selectedOrder?.status === 'completed'}
            sx={{
              backgroundColor: colors.accentText,
              color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
              '&:hover': {
                backgroundColor: '#00C4A3'
              },
              '&.Mui-disabled': {
                backgroundColor: colors.textSecondary,
                color: colors.paper
              }
            }}
          >
            {selectedOrder?.branch ? 'Update Branch' : 'Assign Branch'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Driver Assignment Dialog */}
      <Dialog 
        open={driverDialogOpen} 
        onClose={handleCloseDriverDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: colors.accentText, fontWeight: 700 }}>
          Assign Driver to Order #{selectedOrder?.id}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Select Driver</InputLabel>
              <Select
                value={selectedDriverId}
                label="Select Driver"
                onChange={(e) => setSelectedDriverId(e.target.value)}
              >
                <MenuItem value="">
                  <em>No Driver (Unassign)</em>
                </MenuItem>
                {drivers.map((driver) => {
                  const statusLabel = driver.status === 'active' ? 'On Shift' :
                                     driver.status === 'offline' ? 'Off Shift' :
                                     driver.status === 'on_delivery' ? 'On Delivery' :
                                     driver.status || 'Unknown';
                  const cashAtHand = Math.round(parseFloat(driver.cashAtHand || 0));
                  return (
                    <MenuItem key={driver.id} value={driver.id}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {driver.name} - {driver.phoneNumber}
                          </Typography>
                          <Chip 
                            label={statusLabel}
                            size="small"
                            color={driver.status === 'active' ? 'success' : 
                                   driver.status === 'offline' ? 'error' : 
                                   driver.status === 'on_delivery' ? 'warning' : 'default'}
                            sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                          />
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                          Cash at Hand: KES {cashAtHand}
                        </Typography>
                      </Box>
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
            {selectedOrder && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Customer: {selectedOrder.customerName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Amount: KES {Math.round(computeOrderSummaryCustomerTotal(selectedOrder))}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Address: {selectedOrder.deliveryAddress}
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={handleCloseDriverDialog}
            sx={{ color: 'text.secondary' }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAssignDriver}
            variant="contained"
            sx={{
              backgroundColor: colors.accentText,
              color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
              '&:hover': {
                backgroundColor: '#00C4A3'
              }
            }}
          >
            Assign Driver
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={cancelDialogOpen}
        onClose={handleCloseCancelDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Cancel Order</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Please provide a reason for cancelling Order #{cancelTargetOrder?.id}. This will be saved for audit purposes.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={2}
            label="Cancellation Reason"
            value={cancelReason}
            onChange={(e) => {
              setCancelReason(e.target.value);
              if (cancelReasonError) {
                setCancelReasonError('');
              }
            }}
            inputProps={{ maxLength: 100 }}
            helperText={`${cancelReason.length}/100`}
            error={Boolean(cancelReasonError)}
          />
          {cancelReasonError && (
            <Typography variant="caption" color="error">
              {cancelReasonError}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCancelDialog}>Back</Button>
          <Button
            onClick={handleConfirmCancel}
            variant="contained"
            sx={{ backgroundColor: '#FF3366', color: isDarkMode ? '#0D0D0D' : '#FFFFFF', '&:hover': { backgroundColor: '#FF1744' } }}
          >
            Confirm Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Order Details Dialog - now full screen */}
      <Dialog
        open={orderDetailDialogOpen}
        onClose={() => setOrderDetailDialogOpen(false)}
        fullScreen
        scroll="paper"
      >
        <DialogTitle sx={{ color: colors.accentText, fontWeight: 700 }}>
          Order Details #{selectedOrderForDetail?.id}
        </DialogTitle>
        <DialogContent>
          {selectedOrderForDetail && (
            <Box sx={{ pt: 2 }}>
              {/* Customer Information */}
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: colors.accentText }}>
                    Customer Information
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TextField
                      label="Customer Name"
                      value={selectedOrderForDetail.customerName || ''}
                      onChange={(e) => {
                        setSelectedOrderForDetail(prev => prev ? { ...prev, customerName: e.target.value } : prev);
                      }}
                      size="small"
                      fullWidth
                      sx={{ maxWidth: 400 }}
                    />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <TextField
                        label="Customer Phone"
                        value={selectedOrderForDetail.customerPhone || ''}
                        onChange={(e) => {
                          setSelectedOrderForDetail(prev => prev ? { ...prev, customerPhone: e.target.value } : prev);
                        }}
                        size="small"
                        sx={{ maxWidth: 300 }}
                      />
                      {selectedOrderForDetail.customerPhone && selectedOrderForDetail.customerPhone !== 'POS' && (
                        <Button
                          size="small"
                          startIcon={<Phone />}
                          href={`tel:${selectedOrderForDetail.customerPhone}`}
                          sx={{
                            color: colors.accentText,
                            fontSize: '0.75rem',
                            minWidth: 'auto',
                            padding: '2px 8px'
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          Call
                        </Button>
                      )}
                    </Box>
                    {selectedOrderForDetail.customerEmail && (
                      <Typography variant="body1">
                        <strong>Email:</strong> {selectedOrderForDetail.customerEmail}
                      </Typography>
                    )}
                    <AddressAutocomplete
                      label="Delivery Address"
                      value={selectedOrderForDetail.deliveryAddress || ''}
                      onChange={(e) => {
                        const newValue = e?.target?.value ?? '';
                        setSelectedOrderForDetail(prev =>
                          prev ? { ...prev, deliveryAddress: newValue } : prev
                        );
                      }}
                      size="small"
                      fullWidth
                    />
                    <Typography variant="body1">
                      <strong>Delivery Notes:</strong> {selectedOrderForDetail.notes?.trim() ? selectedOrderForDetail.notes : '—'}
                    </Typography>
                    {recentlyUpdatedInOrderDetail.customer && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CheckCircle sx={{ color: '#2e7d32', fontSize: 20 }} aria-label="Updated" />
                      </Box>
                    )}
                  </Box>
                </CardContent>
              </Card>

              {/* Delivery Details (territory, driver, fee) */}
              {selectedOrderForDetail && selectedOrderForDetail.deliveryFee !== undefined && (
                <Card sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: colors.accentText }}>
                      Delivery Details
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                        <FormControl size="small" sx={{ minWidth: 200 }}>
                          <InputLabel>Driver</InputLabel>
                          <Select
                            label="Driver"
                            value={selectedOrderForDetail.driverId || ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              const driverId = value === '' ? null : parseInt(value, 10);
                              const driver =
                                driverId && drivers.find((d) => d.id === driverId);
                              setSelectedOrderForDetail((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      driverId: driverId,
                                      driver: driver
                                        ? { id: driver.id, name: driver.name }
                                        : null
                                    }
                                  : prev
                              );
                            }}
                          >
                            <MenuItem value="">
                              <em>No Driver (Unassign)</em>
                            </MenuItem>
                            {drivers.map((driver) => {
                              const statusLabel =
                                driver.status === 'active'
                                  ? 'On Shift'
                                  : driver.status === 'offline'
                                  ? 'Off Shift'
                                  : driver.status === 'on_delivery'
                                  ? 'On Delivery'
                                  : driver.status || 'Unknown';
                              const cashAtHand = Math.round(
                                parseFloat(driver.cashAtHand || 0)
                              );
                              return (
                                <MenuItem key={driver.id} value={driver.id}>
                                  <Box
                                    sx={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      width: '100%'
                                    }}
                                  >
                                    <Box
                                      sx={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        width: '100%'
                                      }}
                                    >
                                      <Typography
                                        variant="body2"
                                        sx={{ fontWeight: 600 }}
                                      >
                                        {driver.name}
                                      </Typography>
                                      <Typography
                                        variant="caption"
                                        color="text.secondary"
                                      >
                                        {statusLabel}
                                      </Typography>
                                    </Box>
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                    >
                                      Cash at Hand: KES {cashAtHand}
                                    </Typography>
                                  </Box>
                                </MenuItem>
                              );
                            })}
                          </Select>
                        </FormControl>
                        {(() => {
                          const options = getNextStatusOptions(
                            selectedOrderForDetail.status,
                            selectedOrderForDetail.paymentType,
                            selectedOrderForDetail.paymentStatus
                          );
                          if (!options || options.length === 0) return null;
                          return (
                            <FormControl size="small" sx={{ minWidth: 200 }}>
                              <InputLabel>Update Status</InputLabel>
                              <Select
                                value={selectedOrderForDetail.status || ''}
                                label="Update Status"
                                onChange={(e) =>
                                  handleStatusUpdate(
                                    selectedOrderForDetail.id,
                                    e.target.value
                                  )
                                }
                              >
                                <MenuItem value={selectedOrderForDetail.status || ''} disabled>
                                  {String(selectedOrderForDetail.status || '—').replace(/_/g, ' ')}
                                </MenuItem>
                                {options.map((option) => (
                                  <MenuItem
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          );
                        })()}
                        <FormControl size="small" sx={{ minWidth: 200 }}>
                          <InputLabel>Territory</InputLabel>
                          <Select
                            value={selectedTerritoryId}
                            label="Territory"
                            onChange={(e) => {
                              const val = e.target.value;
                              setSelectedTerritoryId(val);
                              if (val === '' || val == null) {
                                return;
                              }
                              const t = territories.find((tr) => String(tr.id) === String(val));
                              if (t) {
                                const fee = Number(t.deliveryFromCBD ?? 0);
                                setSelectedOrderForDetail((prev) =>
                                  prev ? { ...prev, deliveryFee: fee } : prev
                                );
                              }
                            }}
                            sx={{ fontSize: '0.95rem' }}
                          >
                            <MenuItem value="">
                              <em>No territory</em>
                            </MenuItem>
                            {territories.map((t) => (
                              <MenuItem key={t.id} value={t.id}>
                                {t.name}
                                <Typography
                                  component="span"
                                  sx={{
                                    color: colors.textSecondary,
                                    fontSize: '0.85rem',
                                    ml: 0.75,
                                    fontWeight: 400
                                  }}
                                >
                                  (KES {Math.round(Number(t.deliveryFromCBD ?? 0)).toLocaleString('en-KE')})
                                </Typography>
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <TextField
                          label="Territory Delivery Fee (KES)"
                          type="number"
                          size="small"
                          value={
                            selectedOrderForDetail.deliveryFee ?? ''
                          }
                          disabled={!canEditOrderFinancialAmounts(selectedOrderForDetail)}
                          onChange={(e) => {
                            const v = e.target.value;
                            setSelectedOrderForDetail((prev) =>
                              prev ? { ...prev, deliveryFee: v } : prev
                            );
                            setRecentlyUpdatedInOrderDetail((r) => ({ ...r, deliveryFee: true }));
                          }}
                          sx={{ maxWidth: 200 }}
                        />
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              )}

              {/* Order Items */}
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: colors.accentText }}>
                    Order Items ({selectedOrderForDetail.items?.length || 0})
                  </Typography>
                  {selectedOrderForDetail.items && selectedOrderForDetail.items.length > 0 ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {selectedOrderForDetail.items.map((item, index) => (
                        <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1, borderBottom: `1px solid ${colors.border}` }}>
                          <Box>
                            {(() => {
                              const inferCapacityFromPrice = () => {
                                const rows = Array.isArray(item.drink?.capacityPricing) ? item.drink.capacityPricing : [];
                                const itemPrice = Number(item.price);
                                if (!rows.length || !Number.isFinite(itemPrice)) return null;
                                const exactMatch = rows.find((row) => {
                                  const rowPrice = Number(
                                    row?.currentPrice ??
                                    row?.price ??
                                    row?.originalPrice
                                  );
                                  return Number.isFinite(rowPrice) && Math.abs(rowPrice - itemPrice) < 0.01;
                                });
                                const label = exactMatch?.capacity ?? exactMatch?.size;
                                if (label == null || String(label).trim() === '') return null;
                                return String(label).trim();
                              };
                              const capacity =
                                (item.selectedCapacity != null && String(item.selectedCapacity).trim() !== '' && String(item.selectedCapacity).trim()) ||
                                (item.capacity != null && String(item.capacity).trim() !== '' && String(item.capacity).trim()) ||
                                inferCapacityFromPrice() ||
                                null;
                              return (
                                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                  {item.drink?.name || 'Unknown Item'}{capacity ? ` (${capacity})` : ''}
                                </Typography>
                              );
                            })()}
                            {item.quantity > 1 && (
                              <Typography variant="caption" color="text.secondary">
                                Quantity: {item.quantity}
                              </Typography>
                            )}
                            {item.specialInstructions && (
                              <Typography variant="caption" color="text.secondary" display="block">
                                Note: {item.specialInstructions}
                              </Typography>
                            )}
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body1" sx={{ fontWeight: 600, color: colors.accentText }}>
                              KES {Math.round(Number(item.price || 0))}
                            </Typography>
                            {canEditOrderFinancialAmounts(selectedOrderForDetail) && (
                              <IconButton
                                size="small"
                                onClick={() => {
                                  setEditingItem(item);
                                  setNewPrice(Math.round(Number(item.price || 0)));
                                  setEditPriceDialogOpen(true);
                                }}
                                sx={{ color: colors.accentText }}
                              >
                                <Edit fontSize="small" />
                              </IconButton>
                            )}
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No items found
                    </Typography>
                  )}
                </CardContent>
              </Card>

              {/* Order Summary */}
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: colors.accentText }}>
                    Order Summary
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {/* Items Subtotal */}
                    {selectedOrderForDetail.items && selectedOrderForDetail.items.length > 0 && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body1">
                          <strong>Items Subtotal:</strong>
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body1">
                            KES {(() => {
                              const fromLines = sumLineItemsSubtotal(selectedOrderForDetail);
                              const itemsTotal =
                                fromLines != null
                                  ? fromLines
                                  : Number(selectedOrderForDetail.itemsTotal || 0);
                              return Math.round(Number(itemsTotal));
                            })()}
                          </Typography>
                          {canEditOrderFinancialAmounts(selectedOrderForDetail) && (
                              <IconButton
                                size="small"
                                onClick={() => {
                                  const fromLines = sumLineItemsSubtotal(selectedOrderForDetail);
                                  const current =
                                    fromLines != null
                                      ? fromLines
                                      : Number(selectedOrderForDetail.itemsTotal || 0);
                                  setNewItemsSubtotal(String(Math.round(Number(current))));
                                  setEditItemsSubtotalDialogOpen(true);
                                }}
                              >
                                <Edit fontSize="small" />
                              </IconButton>
                            )}
                        </Box>
                      </Box>
                    )}
                    {/* Convenience Fee (customer-facing) */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body1">
                        <strong>Convenience Fee:</strong>
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body1">
                          KES {Math.round(Number(selectedOrderForDetail.convenienceFee || 0))}
                        </Typography>
                        {canEditOrderFinancialAmounts(selectedOrderForDetail) && (
                            <IconButton
                              size="small"
                              onClick={() => {
                                setNewConvenienceFee(String(selectedOrderForDetail.convenienceFee ?? ''));
                                setEditConvenienceFeeDialogOpen(true);
                              }}
                            >
                              <Edit fontSize="small" />
                            </IconButton>
                          )}
                      </Box>
                    </Box>
                    {/* Territory Delivery Fee in Summary */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body1">
                        <strong>Territory Delivery Fee:</strong>
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body1">
                          KES {Math.round(Number(selectedOrderForDetail.deliveryFee || 0))}
                        </Typography>
                        {canEditOrderFinancialAmounts(selectedOrderForDetail) && (
                          <IconButton
                            size="small"
                            onClick={() => {
                              setNewDeliveryFee(
                                String(Math.round(Number(selectedOrderForDetail.deliveryFee || 0)))
                              );
                              setEditDeliveryFeeDialogOpen(true);
                            }}
                          >
                            <Edit fontSize="small" />
                          </IconButton>
                        )}
                      </Box>
                    </Box>
                    {/* Tip Amount */}
                    {selectedOrderForDetail.tipAmount && parseFloat(selectedOrderForDetail.tipAmount) > 0 && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body1">
                          <strong>Tip:</strong>
                        </Typography>
                        <Typography variant="body1">
                          KES {Math.round(Number(selectedOrderForDetail.tipAmount))}
                        </Typography>
                      </Box>
                    )}
                    <Divider sx={{ my: 1 }} />
                    {/* Total Amount */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body1">
                        <strong>Total Amount:</strong>
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600, color: '#FF3366' }}>
                        KES{' '}
                        {Math.round(computeOrderSummaryCustomerTotal(selectedOrderForDetail))}
                      </Typography>
                    </Box>
                    {/* Cost & Profit/Loss when we have purchase prices */}
                    {(() => {
                      const orderItems = selectedOrderForDetail.items || [];
                      let totalPurchaseCost = 0;
                      orderItems.forEach((item) => {
                        if (item.drink && item.drink.purchasePrice != null && item.drink.purchasePrice !== '') {
                          const pp = parseFloat(item.drink.purchasePrice);
                          if (!Number.isNaN(pp) && pp >= 0) {
                            const qty = parseInt(item.quantity, 10) || 0;
                            totalPurchaseCost += pp * qty;
                          }
                        }
                      });
                      const totalAmount =
                        computeOrderSummaryCustomerTotal(selectedOrderForDetail);
                      const territoryDeliveryFee = parseFloat(selectedOrderForDetail.deliveryFee) || 0;
                      const profitLoss = totalAmount - totalPurchaseCost - territoryDeliveryFee;
                      if (totalPurchaseCost > 0) {
                        return (
                          <>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="body1">
                                <strong>Cost:</strong>
                              </Typography>
                              <Typography variant="body1" sx={{ color: colors.textSecondary }}>
                                KES {Math.round(totalPurchaseCost)}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="body1">
                                <strong>Profit / Loss:</strong>
                              </Typography>
                              <Chip
                                size="small"
                                label={profitLoss >= 0 ? `PROFIT +KES ${Math.round(profitLoss)}` : `LOSS -KES ${Math.round(Math.abs(profitLoss))}`}
                                sx={{
                                  backgroundColor: profitLoss >= 0 ? 'rgba(76, 175, 80, 0.2)' : '#e0e0e0',
                                  color: profitLoss >= 0 ? '#2e7d32' : '#000000',
                                  fontWeight: 600,
                                  fontSize: '0.8rem'
                                }}
                              />
                            </Box>
                          </>
                        );
                      }
                      return null;
                    })()}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body1">
                        <strong>Payment Type:</strong>
                      </Typography>
                      <Typography variant="body1">
                        {selectedOrderForDetail.paymentType === 'pay_now' ? 'Paid Now' : 'Pay on Delivery'}
                      </Typography>
                    </Box>
                    {selectedOrderForDetail.paymentMethod && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body1">
                          <strong>Payment Method:</strong>
                        </Typography>
                        <Typography variant="body1">
                          {selectedOrderForDetail.paymentMethod === 'mobile_money' ? 'M-Pesa' : 
                           selectedOrderForDetail.paymentMethod === 'cash' ? 'Cash' : 
                           selectedOrderForDetail.paymentMethod}
                        </Typography>
                      </Box>
                    )}
                    {selectedOrderForDetail.staffPurchaseDriverId && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body1">
                          <strong>Staff Purchase:</strong>
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>
                          {(() => {
                            const purchaser = drivers.find(d => d.id === selectedOrderForDetail.staffPurchaseDriverId);
                            return purchaser?.name
                              ? `${purchaser.name} (Rider #${selectedOrderForDetail.staffPurchaseDriverId})`
                              : `Rider #${selectedOrderForDetail.staffPurchaseDriverId}`;
                          })()}
                        </Typography>
                      </Box>
                    )}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body1">
                        <strong>Payment Status:</strong>
                      </Typography>
                      {(() => {
                        const paymentStatusChip = getPaymentStatusChipProps(selectedOrderForDetail.paymentStatus, selectedOrderForDetail.status);
                        return paymentStatusChip ? (
                          <Chip size="small" {...paymentStatusChip} />
                        ) : (
                          <Typography variant="body1">—</Typography>
                        );
                      })()}
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body1">
                        <strong>Order Status:</strong>
                      </Typography>
                      {(() => {
                        const statusChip = getOrderStatusChipProps(selectedOrderForDetail.status);
                        return <Chip size="small" {...statusChip} />;
                      })()}
                    </Box>
                    {selectedOrderForDetail.deliveryDistance && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body1">
                          <strong>Delivery Distance:</strong>
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>
                          {Number(selectedOrderForDetail.deliveryDistance).toFixed(1)} km
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </CardContent>
              </Card>

              {/* Branch Information */}
              {selectedOrderForDetail.branch && (
                <Card sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: colors.accentText }}>
                      Branch Information
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Typography variant="body1">
                        <strong>Name:</strong> {selectedOrderForDetail.branch.name}
                      </Typography>
                      {selectedOrderForDetail.branch.address && (
                        <Typography variant="body1">
                          <strong>Address:</strong> {selectedOrderForDetail.branch.address}
                        </Typography>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              )}

              {/* Driver Information */}
              {selectedOrderForDetail.driver && (
                <Card sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: colors.accentText }}>
                      Driver Information
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Typography variant="body1">
                        <strong>Name:</strong> {selectedOrderForDetail.driver.name}
                      </Typography>
                      {selectedOrderForDetail.driver.phoneNumber && (
                        <Typography variant="body1">
                          <strong>Phone:</strong> {selectedOrderForDetail.driver.phoneNumber}
                        </Typography>
                      )}
                      {selectedOrderForDetail.driverAccepted === true && (
                        <Chip label="Accepted" color="success" size="small" sx={{ width: 'fit-content' }} />
                      )}
                      {selectedOrderForDetail.driverAccepted === false && (
                        <Chip label="Rejected" color="error" size="small" sx={{ width: 'fit-content' }} />
                      )}
                      {selectedOrderForDetail.driverAccepted === null && selectedOrderForDetail.driverId && (
                        <Chip label="Pending Response" color="warning" size="small" sx={{ width: 'fit-content' }} />
                      )}
                    </Box>
                  </CardContent>
                </Card>
              )}

              {/* Order Date */}
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: colors.accentText }}>
                    Order Date
                  </Typography>
                  <Typography variant="body1">
                    {new Date(selectedOrderForDetail.createdAt).toLocaleDateString('en-US', { 
                      weekday: 'long',
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {new Date(selectedOrderForDetail.createdAt).toLocaleTimeString('en-US', { 
                      hour: 'numeric', 
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </Typography>
                </CardContent>
              </Card>

              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Posted by:</strong>{' '}
                  {selectedOrderForDetail.servicedByAdmin?.username ||
                    selectedOrderForDetail.servicedByAdmin?.name ||
                    selectedOrderForDetail.servicedByAdmin?.email ||
                    '—'}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          {selectedOrderForDetail && (
            <>
              {selectedOrderForDetail.cancellationRequested &&
                selectedOrderForDetail.cancellationApproved === null && (
                  <>
                    <Button
                      variant="contained"
                      onClick={() => handleApproveCancellation(selectedOrderForDetail.id)}
                      disabled={processingCancellationRequest}
                      sx={{
                        backgroundColor: colors.accentText,
                        color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
                        mr: 1,
                        '&:hover': { backgroundColor: '#00C4A3' },
                        '&.Mui-disabled': {
                          backgroundColor: colors.border,
                          color: colors.textSecondary
                        }
                      }}
                    >
                      Approve Cancellation
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => handleRejectCancellation(selectedOrderForDetail.id)}
                      disabled={processingCancellationRequest}
                      sx={{
                        borderColor: '#000000',
                        color: '#000000',
                        mr: 1,
                        '&:hover': {
                          borderColor: '#000000',
                          backgroundColor: 'rgba(0,0,0,0.04)'
                        },
                        '&.Mui-disabled': { borderColor: colors.border, color: colors.textSecondary }
                      }}
                    >
                      Reject Cancellation
                    </Button>
                  </>
                )}
              <Button
                variant="contained"
                startIcon={<Payment />}
                onClick={() => {
                  handleOpenPaymentDialog(selectedOrderForDetail);
                }}
                disabled={
                  selectedOrderForDetail.paymentStatus === 'paid' ||
                  selectedOrderForDetail.status === 'cancelled'
                }
                sx={{
                  backgroundColor: colors.accentText,
                  color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
                  mr: 1,
                  '&:hover': {
                    backgroundColor: '#00C4A3'
                  },
                  '&.Mui-disabled': {
                    backgroundColor: colors.border,
                    color: colors.textSecondary
                  }
                }}
              >
                Payment
              </Button>
              <Button
                variant="contained"
                onClick={handleSaveOrderDetails}
                disabled={savingOrderDetails}
                sx={{
                  backgroundColor: colors.accentText,
                  color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
                  mr: 1,
                  '&:hover': {
                    backgroundColor: '#00C4A3'
                  },
                  '&:disabled': {
                    backgroundColor: colors.border,
                    color: colors.textSecondary
                  }
                }}
              >
                {savingOrderDetails ? 'Saving...' : 'Save'}
              </Button>
            </>
          )}
          <Button 
            onClick={() => {
              setOrderDetailDialogOpen(false);
              if (paymentPollingInterval) {
                clearInterval(paymentPollingInterval);
                setPaymentPollingInterval(null);
              }
              setPromptingPayment(false);
            }}
            sx={{ color: colors.textSecondary }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Price Dialog */}
      <Dialog
        open={editPriceDialogOpen}
        onClose={() => {
          setEditPriceDialogOpen(false);
          setEditingItem(null);
          setNewPrice('');
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: colors.accentText, fontWeight: 700 }}>
          Edit Item Price
        </DialogTitle>
        <DialogContent>
          {editingItem && (
            <Box sx={{ pt: 2 }}>
              <Typography variant="body1" sx={{ mb: 2 }}>
                <strong>Item:</strong> {editingItem.drink?.name || 'Unknown Item'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Current Price: KES {Math.round(Number(editingItem.price || 0))}
              </Typography>
              <TextField
                autoFocus
                fullWidth
                label="New Price"
                type="number"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                InputProps={{
                  startAdornment: <InputAdornment position="start">KES</InputAdornment>
                }}
                inputProps={{
                  min: 0,
                  step: 0.01
                }}
                sx={{ mt: 2 }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setEditPriceDialogOpen(false);
              setEditingItem(null);
              setNewPrice('');
            }}
            disabled={updatingPrice}
            sx={{ color: colors.textSecondary }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpdateItemPrice}
            variant="contained"
            disabled={updatingPrice}
            sx={{
              backgroundColor: colors.accentText,
              color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
              '&:hover': {
                backgroundColor: '#00C4A3'
              },
              '&:disabled': {
                backgroundColor: colors.border,
                color: colors.textSecondary
              }
            }}
          >
            {updatingPrice ? 'Updating...' : 'Update Price'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Territory Delivery Fee Dialog */}
      <Dialog
        open={editDeliveryFeeDialogOpen}
        onClose={() => {
          setEditDeliveryFeeDialogOpen(false);
          setNewDeliveryFee('');
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: colors.accentText, fontWeight: 700 }}>
          Edit Territory Delivery Fee
        </DialogTitle>
        <DialogContent>
          {selectedOrderForDetail && (
            <Box sx={{ pt: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Current Territory Delivery Fee: KES {Math.round(Number(selectedOrderForDetail.deliveryFee || 0))}
              </Typography>
              <TextField
                autoFocus
                fullWidth
                label="New Territory Delivery Fee"
                type="number"
                value={newDeliveryFee}
                onChange={(e) => setNewDeliveryFee(e.target.value)}
                InputProps={{
                  startAdornment: <InputAdornment position="start">KES</InputAdornment>
                }}
                inputProps={{
                  min: 0,
                  step: 0.01
                }}
                sx={{ mt: 2 }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setEditDeliveryFeeDialogOpen(false);
              setNewDeliveryFee('');
            }}
            disabled={updatingDeliveryFee}
            sx={{ color: colors.textSecondary }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpdateDeliveryFee}
            variant="contained"
            disabled={updatingDeliveryFee}
            sx={{
              backgroundColor: colors.accentText,
              color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
              '&:hover': {
                backgroundColor: '#00C4A3'
              },
              '&:disabled': {
                backgroundColor: colors.border,
                color: colors.textSecondary
              }
            }}
          >
            {updatingDeliveryFee ? 'Updating...' : 'Update Territory Delivery Fee'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Convenience Fee Dialog */}
      <Dialog
        open={editConvenienceFeeDialogOpen}
        onClose={() => {
          setEditConvenienceFeeDialogOpen(false);
          setNewConvenienceFee('');
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: colors.accentText, fontWeight: 700 }}>
          Edit Convenience Fee
        </DialogTitle>
        <DialogContent>
          {selectedOrderForDetail && (
            <Box sx={{ pt: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Current Convenience Fee: KES {Math.round(Number(selectedOrderForDetail.convenienceFee || 0))}
              </Typography>
              <TextField
                autoFocus
                fullWidth
                label="New Convenience Fee"
                type="number"
                value={newConvenienceFee}
                onChange={(e) => setNewConvenienceFee(e.target.value)}
                InputProps={{
                  startAdornment: <InputAdornment position="start">KES</InputAdornment>
                }}
                inputProps={{
                  min: 0,
                  step: 0.01
                }}
                sx={{ mt: 2 }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setEditConvenienceFeeDialogOpen(false);
              setNewConvenienceFee('');
            }}
            disabled={updatingConvenienceFee}
            sx={{ color: colors.textSecondary }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpdateConvenienceFee}
            variant="contained"
            disabled={updatingConvenienceFee}
            sx={{
              backgroundColor: colors.accentText,
              color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
              '&:hover': {
                backgroundColor: '#00C4A3'
              },
              '&:disabled': {
                backgroundColor: colors.border,
                color: colors.textSecondary
              }
            }}
          >
            {updatingConvenienceFee ? 'Updating...' : 'Update Convenience Fee'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Items Subtotal Dialog */}
      <Dialog
        open={editItemsSubtotalDialogOpen}
        onClose={() => {
          setEditItemsSubtotalDialogOpen(false);
          setNewItemsSubtotal('');
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: colors.accentText, fontWeight: 700 }}>
          Edit Items Subtotal
        </DialogTitle>
        <DialogContent>
          {selectedOrderForDetail && (
            <Box sx={{ pt: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Current Items Subtotal: KES{' '}
                {Math.round(
                  Number(
                    sumLineItemsSubtotal(selectedOrderForDetail) ??
                      selectedOrderForDetail.itemsTotal ??
                      0
                  )
                )}
              </Typography>
              <TextField
                autoFocus
                fullWidth
                label="New Items Subtotal"
                type="number"
                value={newItemsSubtotal}
                onChange={(e) => setNewItemsSubtotal(e.target.value)}
                InputProps={{
                  startAdornment: <InputAdornment position="start">KES</InputAdornment>
                }}
                inputProps={{
                  min: 0,
                  step: 0.01
                }}
                sx={{ mt: 2 }}
              />
              <Alert severity="info" sx={{ mt: 2 }}>
                This will adjust item prices proportionally to match the subtotal.
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setEditItemsSubtotalDialogOpen(false);
              setNewItemsSubtotal('');
            }}
            disabled={updatingItemsSubtotal}
            sx={{ color: colors.textSecondary }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpdateItemsSubtotal}
            variant="contained"
            disabled={updatingItemsSubtotal}
            sx={{
              backgroundColor: colors.accentText,
              color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
              '&:hover': {
                backgroundColor: '#00C4A3'
              },
              '&:disabled': {
                backgroundColor: colors.border,
                color: colors.textSecondary
              }
            }}
          >
            {updatingItemsSubtotal ? 'Updating...' : 'Update Items Subtotal'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Payment Failure Dialog */}
      <Dialog
        open={paymentFailureDialogOpen}
        onClose={() => {
          setPaymentFailureDialogOpen(false);
          setPaymentFailureData(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: colors.error, fontWeight: 700 }}>
          Payment Failed
        </DialogTitle>
        <DialogContent>
          {paymentFailureData && (
            <Box sx={{ pt: 2 }}>
              <Typography variant="body1" sx={{ mb: 2 }}>
                <strong>Order #:</strong> {paymentFailureData.orderId}
              </Typography>
              <Alert severity="error" sx={{ mb: 2 }}>
                {paymentFailureData.errorMessage}
              </Alert>
              <Typography variant="body2" color="text.secondary">
                {paymentFailureData.errorType === 'wrong_pin' && 
                  'The customer entered an incorrect PIN. Please ask them to try again.'}
                {paymentFailureData.errorType === 'insufficient_balance' && 
                  'The customer has insufficient balance. Please ask them to top up their M-Pesa account.'}
                {paymentFailureData.errorType === 'timeout' && 
                  'The payment request timed out. The customer did not complete the payment in time.'}
                {!['wrong_pin', 'insufficient_balance', 'timeout'].includes(paymentFailureData.errorType) && 
                  'The payment could not be processed. Please try again or contact the customer.'}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setPaymentFailureDialogOpen(false);
              setPaymentFailureData(null);
            }}
            sx={{ color: colors.textSecondary }}
          >
            Cancel
          </Button>
          <Button
            onClick={async () => {
              if (paymentFailureData) {
                // Get the order to find customer phone
                const order = orders.find(o => o.id === paymentFailureData.orderId);
                const customerPhone = order?.customerPhone && order.customerPhone !== 'POS' 
                  ? order.customerPhone 
                  : null;
                
                // Close dialog first
                setPaymentFailureDialogOpen(false);
                const orderId = paymentFailureData.orderId;
                setPaymentFailureData(null);
                
                // Retry payment prompt
                await handlePromptPayment(orderId, customerPhone);
              }
            }}
            variant="contained"
            sx={{
              backgroundColor: colors.accentText,
              color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
              '&:hover': {
                backgroundColor: '#00C4A3'
              }
            }}
          >
            Retry
          </Button>
        </DialogActions>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog
        open={paymentDialogOpen}
        onClose={handleClosePaymentDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: colors.accentText, fontWeight: 700 }}>
          Payment
        </DialogTitle>
        <DialogContent>
          {selectedOrderForPayment && (
            <Box sx={{ pt: 2 }}>
              <Typography variant="body1" sx={{ mb: 2 }}>
                <strong>Order #:</strong> {selectedOrderForPayment.id}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Customer: {selectedOrderForPayment.customerName || 'N/A'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Amount: <strong>KES {Math.round(parseFloat(selectedOrderForPayment.totalAmount || 0))}</strong>
              </Typography>
              <TextField
                autoFocus
                fullWidth
                label="Phone Number"
                type="tel"
                value={paymentPhone}
                onChange={(e) => {
                  // Allow users to type/paste common formats like "0712…", "2547…", "+254 7…".
                  // We normalize/validate on submit via formatMpesaPhoneNumber/validateSafaricomPhone.
                  setPaymentPhone(e.target.value);
                  setPaymentError('');
                }}
                placeholder="0712345678"
                InputProps={{
                  startAdornment: <InputAdornment position="start"><Phone /></InputAdornment>
                }}
                helperText={selectedOrderForPayment.customerPhone && selectedOrderForPayment.customerPhone !== 'POS' 
                  ? `Order phone: ${selectedOrderForPayment.customerPhone}` 
                  : 'Enter customer phone number'}
                sx={{ mt: 2, mb: 2 }}
              />
              {paymentSuccess && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  Payment request sent. Please check the customer's phone to enter their M-Pesa PIN.
                </Alert>
              )}
              {paymentError && (
                <Alert severity="error" sx={{ mt: 2 }} onClose={() => setPaymentError('')}>
                  {paymentError}
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleClosePaymentDialog}
            disabled={processingPayment}
            sx={{ color: colors.textSecondary }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleMarkPaymentAsCash}
            variant="outlined"
            disabled={processingPayment}
            startIcon={<AttachMoney />}
            sx={{
              borderColor: colors.accentText,
              color: colors.accentText,
              mr: 1,
              '&:hover': {
                borderColor: '#00C4A3',
                backgroundColor: 'rgba(0, 224, 184, 0.08)'
              },
              '&:disabled': {
                borderColor: colors.border,
                color: colors.textSecondary
              }
            }}
          >
            {processingPayment ? (
              <>
                <CircularProgress size={16} sx={{ mr: 1 }} />
                Processing...
              </>
            ) : (
              'Mark as Cash Received'
            )}
          </Button>
          <Button
            onClick={handleInitiateMobileMoneyPayment}
            variant="contained"
            disabled={processingPayment || !paymentPhone || !validateSafaricomPhone(paymentPhone)}
            sx={{
              backgroundColor: colors.accentText,
              color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
              '&:hover': {
                backgroundColor: '#00C4A3'
              },
              '&:disabled': {
                backgroundColor: colors.border,
                color: colors.textSecondary
              }
            }}
          >
            {processingPayment ? (
              <>
                <CircularProgress size={16} sx={{ mr: 1 }} />
                Processing...
              </>
            ) : (
              'Send Payment Request'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* New Order Dialog - Outside conditional blocks so it can appear from any tab */}
      <NewOrderDialog
        open={newOrderDialogOpen}
        onClose={() => setNewOrderDialogOpen(false)}
        onOrderCreated={(orderResponse) => {
          // Refresh orders list
          fetchOrders();
          setNewOrderDialogOpen(false);
          
          // Check if it's a POS/walk-in order
          const order = orderResponse?.order || orderResponse?.data?.order || orderResponse;
          const isPOS = order?.customerPhone === 'POS' || order?.customerName === 'POS' || 
                       order?.deliveryAddress?.includes('In-Store') || 
                       order?.deliveryAddress?.includes('POS');
          
          if (isPOS && order?.id) {
            // Show success toast
            setToastMessage(`POS order #${order.orderNumber || order.id} created successfully!`);
            setToastOpen(true);
            
            // Navigate to the order after a short delay to allow toast to show
            setTimeout(() => {
              navigate(`/orders?orderId=${order.id}`);
            }, 500);
          }
        }}
      />
      
      {/* Toast Notification */}
      <Snackbar
        open={toastOpen}
        autoHideDuration={3000}
        onClose={() => setToastOpen(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setToastOpen(false)} 
          severity="success" 
          sx={{ width: '100%' }}
        >
          {toastMessage}
        </Alert>
      </Snackbar>

      {/* Add Stop Dialog */}
      <Dialog
        open={stopDialogOpen}
        onClose={() => {
          setStopDialogOpen(false);
          setStopFormData({ name: '', location: '', instruction: '', payment: '' });
          setSelectedRiderForStop(null);
          setSelectedOrderIndexForStop(null);
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: colors.paper,
            color: colors.textPrimary
          }
        }}
      >
        <DialogTitle sx={{ 
          color: colors.accentText, 
          fontWeight: 700,
          borderBottom: `1px solid ${colors.border}`
        }}>
          {editingStop ? 'Edit Stop' : 'Add Stop'}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <TextField
            fullWidth
            label="Stop Name"
            value={stopFormData.name}
            onChange={(e) => setStopFormData({ ...stopFormData, name: e.target.value })}
            sx={{ mb: 2 }}
            required
            InputProps={{
              sx: {
                color: colors.textPrimary,
                '& fieldset': {
                  borderColor: colors.border,
                },
                '&:hover fieldset': {
                  borderColor: colors.accentText,
                },
                '&.Mui-focused fieldset': {
                  borderColor: colors.accentText,
                },
              },
            }}
            InputLabelProps={{
              sx: {
                color: colors.textSecondary,
                '&.Mui-focused': {
                  color: colors.accentText,
                },
              },
            }}
          />
          <AddressAutocomplete
            label="Stop Location"
            value={stopFormData.location}
            onChange={(e) => {
              // Update location with what user types or selects
              setStopFormData({ ...stopFormData, location: e.target.value });
            }}
            onPlaceSelect={(place) => {
              // Don't override the location - onChange already handled it with the selected description
              // The location is already set via onChange with what the user selected
              // onPlaceSelect is called after onChange, so we should preserve the user's selection
            }}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Stop Instruction"
            value={stopFormData.instruction}
            onChange={(e) => setStopFormData({ ...stopFormData, instruction: e.target.value })}
            multiline
            rows={3}
            sx={{ mb: 2 }}
            InputProps={{
              sx: {
                color: colors.textPrimary,
                '& fieldset': {
                  borderColor: colors.border,
                },
                '&:hover fieldset': {
                  borderColor: colors.accentText,
                },
                '&.Mui-focused fieldset': {
                  borderColor: colors.accentText,
                },
              },
            }}
            InputLabelProps={{
              sx: {
                color: colors.textSecondary,
                '&.Mui-focused': {
                  color: colors.accentText,
                },
              },
            }}
          />
          <TextField
            fullWidth
            label="Stop Payment (KES)"
            type="number"
            value={stopFormData.payment}
            onChange={(e) => setStopFormData({ ...stopFormData, payment: e.target.value })}
            InputProps={{
              sx: {
                color: colors.textPrimary,
                '& fieldset': {
                  borderColor: colors.border,
                },
                '&:hover fieldset': {
                  borderColor: colors.accentText,
                },
                '&.Mui-focused fieldset': {
                  borderColor: colors.accentText,
                },
              },
            }}
            InputLabelProps={{
              sx: {
                color: colors.textSecondary,
                '&.Mui-focused': {
                  color: colors.accentText,
                },
              },
            }}
          />
        </DialogContent>
        <DialogActions sx={{ borderTop: `1px solid ${colors.border}`, p: 2 }}>
          <Button
            onClick={() => {
              setStopDialogOpen(false);
              setStopFormData({ name: '', location: '', instruction: '', payment: '' });
              setSelectedRiderForStop(null);
              setSelectedOrderIndexForStop(null);
              setEditingStop(null);
            }}
            sx={{ color: colors.textSecondary }}
          >
            Cancel
          </Button>
          <Button
            onClick={async () => {
              if (stopFormData.name && selectedRiderForStop !== null) {
                try {
                  let response;
                  if (editingStop) {
                    // Update existing stop
                    response = await api.patch(`/admin/stops/${editingStop.id}`, {
                      name: stopFormData.name,
                      location: stopFormData.location,
                      instruction: stopFormData.instruction || '',
                      payment: stopFormData.payment || 0,
                      // insertAfterIndex and sequence are handled by drag/drop or move buttons
                    });
                  } else {
                    // Calculate sequence (count of existing stops at this insertAfterIndex)
                    const existingStops = stops[selectedRiderForStop] || [];
                    const stopsAtSameIndex = existingStops.filter(s => s.insertAfterIndex === selectedOrderIndexForStop);
                    const sequence = stopsAtSameIndex.length;
                    
                    // Create new stop
                    response = await api.post('/admin/stops', {
                      driverId: selectedRiderForStop,
                      name: stopFormData.name,
                      location: stopFormData.location,
                      instruction: stopFormData.instruction || '',
                      payment: stopFormData.payment || 0,
                      insertAfterIndex: selectedOrderIndexForStop,
                      sequence
                    });
                  }
                  
                  if (response.data?.stop) {
                    // Refresh stops from database to ensure correct ordering and position
                    await fetchRiderRoutes();
                  }
                  
                  setStopDialogOpen(false);
                  setStopFormData({ name: '', location: '', instruction: '', payment: '' });
                  setSelectedRiderForStop(null);
                  setSelectedOrderIndexForStop(null);
                  setEditingStop(null); // Clear editing state
                } catch (error) {
                  console.error('Error saving stop:', error);
                  setError(error.response?.data?.error || 'Failed to save stop');
                }
              }
            }}
            variant="contained"
            disabled={!stopFormData.name}
            sx={{
              backgroundColor: colors.accentText,
              color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
              '&:hover': {
                backgroundColor: '#00C4A3'
              },
              '&:disabled': {
                backgroundColor: colors.border,
                color: colors.textSecondary
              }
            }}
          >
            {editingStop ? 'Update Stop' : 'Add Stop'}
          </Button>
        </DialogActions>
      </Dialog>

      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.1); }
        }
      `}</style>
      {/* Optimization Progress Dialog */}
      <Dialog 
        open={optimizationProgress.open}
        onClose={() => setOptimizationProgress((prev) => ({ ...prev, open: false }))}
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            background: isDarkMode 
              ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)'
              : 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
            borderRadius: 3,
            border: `2px solid ${colors.accentText}`,
            boxShadow: `0 8px 32px rgba(0, 224, 184, 0.3)`
          }
        }}
      >
        <DialogTitle sx={{ 
          color: colors.accentText, 
          fontWeight: 700,
          fontSize: '1.5rem',
          pb: 2,
          borderBottom: `1px solid ${colors.border}`
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AutoAwesome sx={{ fontSize: '2rem' }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Optimizing Routes
              </Typography>
            </Box>
            <IconButton
              size="small"
              onClick={() => setOptimizationProgress((prev) => ({ ...prev, open: false }))}
              sx={{ color: colors.accentText }}
            >
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 4, pb: 4 }}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="body1" sx={{ 
              color: colors.textPrimary, 
              mb: 2, 
              textAlign: 'center',
              fontWeight: 500
            }}>
              {optimizationProgress.currentStep || 'Initializing optimization engine...'}
            </Typography>
            
            {/* Futuristic Progress Bar */}
            <Box sx={{ 
              position: 'relative',
              width: '100%',
              height: 40,
              backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              borderRadius: 20,
              overflow: 'hidden',
              border: `2px solid ${colors.accentText}`,
              boxShadow: `0 0 20px rgba(0, 224, 184, 0.3)`
            }}>
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  height: '100%',
                  width: `${optimizationProgress.progress}%`,
                  background: `linear-gradient(90deg, ${colors.accentText} 0%, #00C4A3 100%)`,
                  borderRadius: 20,
                  transition: 'width 0.5s ease',
                  boxShadow: `0 0 20px rgba(0, 224, 184, 0.6)`
                }}
              />
              <Box sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                color: isDarkMode ? '#fff' : '#000',
                fontWeight: 700,
                fontSize: '0.9rem',
                textShadow: '0 1px 2px rgba(0,0,0,0.2)',
                zIndex: 1
              }}>
                {Math.round(optimizationProgress.progress)}%
              </Box>
            </Box>
            
            <Typography variant="caption" sx={{ 
              color: colors.textSecondary, 
              mt: 1, 
              display: 'block',
              textAlign: 'center'
            }}>
              Step {optimizationProgress.step} of {optimizationProgress.totalSteps}
            </Typography>
          </Box>
        </DialogContent>
      </Dialog>



        </Box>
      </Container>
  );
};

export default Orders;
