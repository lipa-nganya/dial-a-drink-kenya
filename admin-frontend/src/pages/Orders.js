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
  Card,
  CardContent,
  Divider,
  Autocomplete,
  ToggleButton,
  ToggleButtonGroup,
  Menu
} from '@mui/material';
import {
  ShoppingCart,
  Warning,
  Assignment,
  Edit,
  Person,
  Delete,
  MoreVert,
  Search,
  Clear,
  PictureAsPdf,
  Route as RouteIcon,
  LocalShipping,
  AccessTime,
  LocationOn,
  Add,
  Map,
  List,
  Refresh,
  Close,
  KeyboardArrowUp,
  KeyboardArrowDown,
  AutoAwesome,
  Phone,
  Payment,
  CheckCircle
} from '@mui/icons-material';
import { api } from '../services/api';
import io from 'socket.io-client';
import { useTheme } from '../contexts/ThemeContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { getBackendUrl } from '../utils/backendUrl';
import { getOrderStatusChipProps, getPaymentStatusChipProps, getPaymentMethodChipProps } from '../utils/chipStyles';
import NewOrderDialog from '../components/NewOrderDialog';
import { useJsApiLoader } from '@react-google-maps/api';
import AddressAutocomplete from '../components/AddressAutocomplete';
import RouteMapView from '../components/RouteMapView';

// Google Maps libraries - moved outside component to prevent performance warnings
const GOOGLE_MAPS_LIBRARIES = ['places', 'geometry'];

const Orders = () => {
  const { isDarkMode, colors } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [transactionStatusFilter, setTransactionStatusFilter] = useState('all');
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
  const [editingItem, setEditingItem] = useState(null);
  const [newPrice, setNewPrice] = useState('');
  const [updatingPrice, setUpdatingPrice] = useState(false);
  const [editDeliveryFeeDialogOpen, setEditDeliveryFeeDialogOpen] = useState(false);
  const [newDeliveryFee, setNewDeliveryFee] = useState('');
  const [updatingDeliveryFee, setUpdatingDeliveryFee] = useState(false);
  const [selectedTerritoryId, setSelectedTerritoryId] = useState('');
  const [updatingTerritory, setUpdatingTerritory] = useState(false);
  const [applyingTerritoryFee, setApplyingTerritoryFee] = useState(false);
  const [recentlyUpdatedInOrderDetail, setRecentlyUpdatedInOrderDetail] = useState({ deliveryFee: false, territory: false });
  const updatedFeeTimeoutRef = useRef(null);
  const updatedTerritoryTimeoutRef = useRef(null);
  const [adminDeliveryFees, setAdminDeliveryFees] = useState({
    deliveryFeeWithAlcohol: 50,
    deliveryFeeWithoutAlcohol: 30
  });
  
  // Payment dialog state
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState(null);
  const [paymentPhone, setPaymentPhone] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  
  // Route Optimisation state
  const [activeTab, setActiveTab] = useState(0);
  const [orderTab, setOrderTab] = useState('all'); // 'all', 'completed', 'pending', 'unassigned', 'confirmed', 'cancelled', 'cancellation-requests'
  const [riderRoutes, setRiderRoutes] = useState([]);
  const [allRiderRoutes, setAllRiderRoutes] = useState([]);
  const [allRiders, setAllRiders] = useState([]);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [selectedRiders, setSelectedRiders] = useState([]);
  const [draggedOrder, setDraggedOrder] = useState(null);
  const [draggedStop, setDraggedStop] = useState(null);
  const [dragOverRider, setDragOverRider] = useState(null);
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
  const [routeViewMode, setRouteViewMode] = useState('list');
  const [riderLocations, setRiderLocations] = useState({});
  const [refreshingLocations, setRefreshingLocations] = useState(false);
  const [mapCenter, setMapCenter] = useState({ lat: -1.2921, lng: 36.8219 });
  const [optimizedRoutes, setOptimizedRoutes] = useState({}); // riderId -> array of order IDs in optimized order
  const [optimizing, setOptimizing] = useState(false);
  const [, setOptimizationSavings] = useState({}); // riderId -> { timeSaved, costSaved }
  const [optimizationProgress, setOptimizationProgress] = useState({
    open: false,
    step: 0,
    totalSteps: 9,
    currentStep: '',
    progress: 0
  });

  
  // Google Maps API loader
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
    fetchAdminDeliveryFees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (updatedFeeTimeoutRef.current) clearTimeout(updatedFeeTimeoutRef.current);
      if (updatedTerritoryTimeoutRef.current) clearTimeout(updatedTerritoryTimeoutRef.current);
    };
  }, []);

  const fetchTerritories = async () => {
    try {
      const response = await api.get('/territories');
      setTerritories(response.data || []);
    } catch (error) {
      console.error('Error fetching territories:', error);
    }
  };

  const fetchAdminDeliveryFees = async () => {
    try {
      const [withRes, withoutRes] = await Promise.all([
        api.get('/settings/deliveryFeeWithAlcohol').catch(() => ({ data: { value: '50' } })),
        api.get('/settings/deliveryFeeWithoutAlcohol').catch(() => ({ data: { value: '30' } }))
      ]);
      setAdminDeliveryFees({
        deliveryFeeWithAlcohol: parseFloat(withRes.data?.value || '50'),
        deliveryFeeWithoutAlcohol: parseFloat(withoutRes.data?.value || '30')
      });
    } catch (error) {
      console.error('Error fetching admin delivery fees:', error);
    }
  };

  const fetchBranches = async () => {
    try {
      const response = await api.get('/branches?activeOnly=true');
      setBranches(response.data || []);
    } catch (error) {
      console.error('Error fetching branches:', error);
    }
  };

  const fetchDrivers = async () => {
    try {
      const response = await api.get('/drivers');
      setDrivers(response.data || []);
    } catch (error) {
      console.error('Error fetching drivers:', error);
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
      
      // Fetch the full order details with items and transactions
      try {
        const response = await api.get(`/admin/orders`);
        const allOrders = response.data;
        
        // Find the new order (should be the most recent, so check first few)
        const newOrder = allOrders.find(o => o.id === data.order?.id) || allOrders[0];
        
        if (newOrder) {
          // Add or update order, then sort by status
          setOrders(prevOrders => {
            // Check if order already exists
            const existingIndex = prevOrders.findIndex(o => o.id === newOrder.id);
            let updated;
            
            if (existingIndex >= 0) {
              // Update existing order
              updated = [...prevOrders];
              updated[existingIndex] = newOrder;
            } else {
              // Add new order
              updated = [newOrder, ...prevOrders];
            }
            
            // Sort by status priority
            const sorted = sortOrdersByStatus(updated);
            // Apply filters after update
            applyFilters(sorted, orderStatusFilter, transactionStatusFilter, searchQuery, customFilter, orderTab);
            return sorted;
          });
        }
      } catch (error) {
        console.error('Error fetching new order details:', error);
        // Fallback: if order data is in the event, use it
        if (data.order) {
          setOrders(prevOrders => {
            const exists = prevOrders.some(o => o.id === data.order.id);
            if (!exists) {
              return [data.order, ...prevOrders];
            }
            return prevOrders;
          });
        }
      }
    });

    // Listen for order updates (including driver assignment)
    socket.on('order-updated', async (data) => {
      console.log('✅ Order updated via Socket.IO:', data);
      await fetchOrders(); // Refresh orders list
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
      await fetchOrders();
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
      
      // Switch to cancellation-requests tab to show the new request
      setOrderTab('cancellation-requests');
      
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
          applyFilters(sorted, orderStatusFilter, transactionStatusFilter, searchQuery, customFilter, 'cancellation-requests');
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
          
          // If cancellation was approved and we're on cancellation-requests tab, switch to cancelled tab
          if (data.approved && orderTab === 'cancellation-requests' && data.order.status === 'cancelled') {
            setOrderTab('cancelled');
            applyFilters(sorted, orderStatusFilter, transactionStatusFilter, searchQuery, customFilter, 'cancelled');
          } else if (!data.approved && orderTab === 'cancellation-requests') {
            // If cancellation was rejected and we're on cancellation-requests tab, switch to pending tab
            setOrderTab('pending');
            applyFilters(sorted, orderStatusFilter, transactionStatusFilter, searchQuery, customFilter, 'pending');
          } else {
            applyFilters(sorted, orderStatusFilter, transactionStatusFilter, searchQuery, customFilter, orderTab);
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

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/orders');
      let orders = response.data || [];
      
      // Filter out any undefined or null orders
      orders = orders.filter(order => order != null);
      
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
      
      const sortedOrders = sortOrdersByStatus(orders);
      setOrders(sortedOrders);
      setError(null);
      // Apply filters after fetching
      applyFilters(sortedOrders, orderStatusFilter, transactionStatusFilter, searchQuery, customFilter, orderTab);
    } catch (error) {
      console.error('Error fetching orders:', error);
      setError(error.response?.data?.error || error.message || 'Error loading orders');
    } finally {
      setLoading(false);
    }
  };

  // Get transaction status for an order
  const getOrderTransactionStatus = (order) => {
    if (!order.transactions || order.transactions.length === 0) {
      return 'pending'; // No transaction created yet
    }
    // Get the most recent transaction
    const latestTransaction = order.transactions.sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    )[0];
    return latestTransaction.status || 'pending';
  };

  // Apply filters to orders
  const applyFilters = (ordersList, orderStatus, transactionStatus, search, customFilter, tabFilter) => {
    let filtered = [...ordersList];

    // Apply tab-based filtering first
    if (tabFilter === 'pending') {
      filtered = filtered.filter(order => (order.status === 'pending' || order.status === 'confirmed') && !(order.cancellationRequested && order.cancellationApproved === null));
    } else if (tabFilter === 'cancellation-requests') {
      // Show only orders with pending cancellation requests
      filtered = filtered.filter(order => order.cancellationRequested && order.cancellationApproved === null);
    } else if (tabFilter === 'completed') {
      filtered = filtered.filter(order => order.status === 'completed');
    } else if (tabFilter === 'unassigned') {
      filtered = filtered.filter(order => !order.driverId || order.driver?.name === 'HOLD Driver');
    } else if (tabFilter === 'confirmed') {
      filtered = filtered.filter(order => order.status === 'confirmed');
    } else if (tabFilter === 'cancelled') {
      filtered = filtered.filter(order => order.status === 'cancelled');
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

    // Sort filtered results
    const sorted = sortOrdersByStatus(filtered);
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
    applyFilters(orders, orderStatusFilter, transactionStatusFilter, searchQuery, customFilter, orderTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderStatusFilter, transactionStatusFilter, searchQuery, orders, customFilter, orderTab]);

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
      setOrders(prevOrders => {
        const updated = prevOrders.map(order => 
          order.id === orderId ? { ...order, status: newStatus, paymentStatus: response.data.paymentStatus } : order
        );
        // Re-sort after status update
        return sortOrdersByStatus(updated);
      });
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

  const handleDownloadReceipt = async (orderId) => {
    try {
      const response = await api.get(`/orders/${orderId}/receipt`, {
        responseType: 'blob', // Important for downloading files
      });

      // Create a blob from the response data
      const blob = new Blob([response.data], { type: 'application/pdf' });

      // Create a link element, set the download attribute, and click it
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `receipt-order-${orderId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading receipt:', error);
      alert('Failed to download receipt: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleApproveCancellation = async (orderId) => {
    try {
      const response = await api.patch(`/admin/orders/${orderId}/cancellation-request`, { approved: true });
      setOrders(prevOrders => {
        const updated = prevOrders.map(order => 
          order.id === orderId ? { ...order, ...response.data } : order
        );
        const sorted = sortOrdersByStatus(updated);
        // If we're on cancellation-requests tab and order is now cancelled, switch to cancelled tab
        if (orderTab === 'cancellation-requests' && response.data.status === 'cancelled') {
          setOrderTab('cancelled');
          applyFilters(sorted, orderStatusFilter, transactionStatusFilter, searchQuery, customFilter, 'cancelled');
        } else {
          applyFilters(sorted, orderStatusFilter, transactionStatusFilter, searchQuery, customFilter, orderTab);
        }
        return sorted;
      });
      setError(null);
    } catch (error) {
      console.error('Error approving cancellation:', error);
      setError(error.response?.data?.error || error.message);
    }
  };

  const handleRejectCancellation = async (orderId) => {
    try {
      const response = await api.patch(`/admin/orders/${orderId}/cancellation-request`, { approved: false });
      setOrders(prevOrders => {
        const updated = prevOrders.map(order => 
          order.id === orderId ? { ...order, ...response.data } : order
        );
        const sorted = sortOrdersByStatus(updated);
        // If we're on cancellation-requests tab and cancellation was rejected, switch to pending tab
        if (orderTab === 'cancellation-requests') {
          setOrderTab('pending');
          applyFilters(sorted, orderStatusFilter, transactionStatusFilter, searchQuery, customFilter, 'pending');
        } else {
          applyFilters(sorted, orderStatusFilter, transactionStatusFilter, searchQuery, customFilter, orderTab);
        }
        return sorted;
      });
      setError(null);
    } catch (error) {
      console.error('Error rejecting cancellation:', error);
      setError(error.response?.data?.error || error.message);
    }
  };

  const handlePaymentStatusUpdate = async (orderId, paymentStatus) => {
    try {
      const response = await api.patch(`/admin/orders/${orderId}/payment-status`, { paymentStatus });
      setOrders(prevOrders => {
        const updated = prevOrders.map(order => 
          order.id === orderId ? { ...order, paymentStatus, status: response.data.status } : order
        );
        // Re-sort after payment status update (status might have changed to completed)
        const sorted = sortOrdersByStatus(updated);
        // Apply filters to updated orders
        applyFilters(sorted, orderStatusFilter, transactionStatusFilter, searchQuery, customFilter, orderTab);
        return sorted;
      });
    } catch (error) {
      console.error('Error updating payment status:', error);
      setError(error.response?.data?.error || error.message);
    }
  };

  // Phone number formatting and validation
  const formatMpesaPhoneNumber = (phone) => {
    if (!phone) return '';
    
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');
    
    // If starts with 0, replace with 254
    if (cleaned.startsWith('0')) {
      cleaned = '254' + cleaned.substring(1);
    } else if (!cleaned.startsWith('254')) {
      // If doesn't start with 254 and is 9 digits, add 254
      if (cleaned.length === 9 && cleaned.startsWith('7')) {
        cleaned = '254' + cleaned;
      }
    }
    
    return cleaned;
  };

  const validateSafaricomPhone = (phone) => {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length >= 9 && (cleaned.startsWith('07') || cleaned.startsWith('2547') || (cleaned.startsWith('7') && cleaned.length === 9));
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
        // Update the order detail with the new data
        setSelectedOrderForDetail(response.data.order);
        
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

  const handleUpdateOrderTerritory = async () => {
    if (!selectedOrderForDetail) return;
    const territoryId = selectedTerritoryId === '' ? null : parseInt(selectedTerritoryId, 10);
    if (territoryId !== null && isNaN(territoryId)) return;
    setUpdatingTerritory(true);
    try {
      const response = await api.patch(`/admin/orders/${selectedOrderForDetail.id}/territory`, { territoryId });
      const updatedOrder = response.data;
      const territory = territoryId ? territories.find(t => t.id === territoryId) : null;
      setSelectedOrderForDetail(prev => ({ ...prev, territoryId: updatedOrder.territoryId, territory: territory ? { id: territory.id, name: territory.name } : null }));
      setOrders(prev => prev.map(o => o.id === updatedOrder.id ? { ...o, territoryId: updatedOrder.territoryId, territory: territory ? { id: territory.id, name: territory.name } : null } : o));
      setFilteredOrders(prev => prev.map(o => o.id === updatedOrder.id ? { ...o, territoryId: updatedOrder.territoryId, territory: territory ? { id: territory.id, name: territory.name } : null } : o));
      if (response.data) {
        if (updatedTerritoryTimeoutRef.current) clearTimeout(updatedTerritoryTimeoutRef.current);
        setRecentlyUpdatedInOrderDetail(prev => ({ ...prev, territory: true }));
        updatedTerritoryTimeoutRef.current = setTimeout(() => {
          setRecentlyUpdatedInOrderDetail(prev => ({ ...prev, territory: false }));
          updatedTerritoryTimeoutRef.current = null;
        }, 4000);
      }
    } catch (error) {
      console.error('Error updating order territory:', error);
      alert(error.response?.data?.error || error.message || 'Failed to update territory');
    } finally {
      setUpdatingTerritory(false);
    }
  };

  const handleApplyTerritoryDeliveryFee = async (fee) => {
    if (!selectedOrderForDetail) return;
    if (selectedOrderForDetail.status === 'completed' || selectedOrderForDetail.status === 'cancelled' || selectedOrderForDetail.paymentStatus === 'paid') {
      alert('Cannot change delivery fee for completed, cancelled, or paid orders.');
      return;
    }
    setApplyingTerritoryFee(true);
    try {
      const response = await api.patch(`/admin/orders/${selectedOrderForDetail.id}/delivery-fee`, { deliveryFee: fee });
      if (response.data?.success && response.data?.breakdown) {
        const { breakdown } = response.data;
        setSelectedOrderForDetail(prev => ({
          ...prev,
          deliveryFee: breakdown.deliveryFee,
          totalAmount: breakdown.totalAmount,
          itemsTotal: breakdown.itemsTotal
        }));
        setOrders(prev => prev.map(o => o.id === selectedOrderForDetail.id ? { ...o, totalAmount: breakdown.totalAmount, deliveryFee: breakdown.deliveryFee } : o));
        setFilteredOrders(prev => prev.map(o => o.id === selectedOrderForDetail.id ? { ...o, totalAmount: breakdown.totalAmount, deliveryFee: breakdown.deliveryFee } : o));
        if (updatedFeeTimeoutRef.current) clearTimeout(updatedFeeTimeoutRef.current);
        setRecentlyUpdatedInOrderDetail(prev => ({ ...prev, deliveryFee: true }));
        updatedFeeTimeoutRef.current = setTimeout(() => {
          setRecentlyUpdatedInOrderDetail(prev => ({ ...prev, deliveryFee: false }));
          updatedFeeTimeoutRef.current = null;
        }, 4000);
      }
    } catch (error) {
      console.error('Error applying territory delivery fee:', error);
      alert(error.response?.data?.error || error.message || 'Failed to update delivery fee');
    } finally {
      setApplyingTerritoryFee(false);
    }
  };

  const handleOpenDriverDialog = (order) => {
    setSelectedOrder(order);
    setSelectedDriverId(order.driverId || '');
    setDriverDialogOpen(true);
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

  const handleRemoveDriver = async (order) => {
    if (!window.confirm(`Are you sure you want to remove ${order.driver?.name || 'the driver'} from Order #${order.id}?`)) {
      return;
    }
    
    try {
      await api.patch(`/admin/orders/${order.id}/driver`, { driverId: null });
      
      // Refresh orders to get updated data
      await fetchOrders();
    } catch (error) {
      console.error('Error removing driver:', error);
      setError(error.response?.data?.error || error.message);
    }
  };

  // Route Optimisation functions
  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const fetchRiderRoutes = async () => {
    try {
      setRoutesLoading(true);
      const [ridersResponse, ordersResponse, locationsResponse] = await Promise.all([
        api.get('/drivers'),
        api.get('/admin/orders'),
        api.get('/admin/drivers/locations').catch(() => ({ data: { locations: [] } }))
      ]);
      
      const fetchedRiders = ridersResponse.data || [];
      setAllRiders(fetchedRiders);
      const allOrders = ordersResponse.data || [];
      
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

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    if (newValue === 1) {
      // Route Optimisation tab selected
      fetchRiderRoutes();
    }
  };

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

  // Check if routes are currently optimized
  const isRouteOptimized = () => {
    if (Object.keys(optimizedRoutes).length === 0) return false;
    
    // Check if current order matches optimized order for each rider
    for (const route of riderRoutes) {
      const optimizedOrder = optimizedRoutes[route.rider.id];
      if (!optimizedOrder) continue;
      
      const currentOrder = route.orders.map(o => o.id);
      if (currentOrder.length !== optimizedOrder.length) return false;
      
      // Check if orders match
      for (let i = 0; i < currentOrder.length; i++) {
        if (currentOrder[i] !== optimizedOrder[i]) return false;
      }
    }
    
    return true;
  };


  // Helper function to update optimization progress
  const updateOptimizationProgress = (step, currentStep, progress) => {
    setOptimizationProgress({
      open: true,
      step,
      totalSteps: 9,
      currentStep,
      progress
    });
  };
  
  // Optimize routes using Google Maps and TSP-like algorithm
  const handleOptimizeRoutes = async () => {
    if (!window.google || !isMapLoaded) {
      setError('Google Maps is not loaded. Please wait and try again.');
      return;
    }

    setOptimizing(true);
    setError(null);
    
    // Open progress dialog
    updateOptimizationProgress(0, 'Initializing optimization engine...', 0);

    try {
      // Step 1: Check current driver locations
      updateOptimizationProgress(1, 'Checking current driver locations...', 11);
      await handleRefreshLocations();
      await new Promise(resolve => setTimeout(resolve, 300)); // Small delay for UX
      
      const geocoder = new window.google.maps.Geocoder();
      const distanceMatrixService = new window.google.maps.DistanceMatrixService();
      const newOptimizedRoutes = {};
      const newSavings = {};
      
      // Step 2: Check order locations
      updateOptimizationProgress(2, 'Checking order locations...', 22);
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Step 3: Check stop locations  
      updateOptimizationProgress(3, 'Checking stop locations...', 33);
      await new Promise(resolve => setTimeout(resolve, 300));

      // Step 4: Rearrange orders and stops based on driver locations
      updateOptimizationProgress(4, 'Rearranging orders and stops based on driver locations...', 44);
      
      // Optimize each rider's route
      for (const route of riderRoutes) {
        if (route.orders.length < 2) {
          // No optimization needed for 0 or 1 order
          continue;
        }

        // Get rider's current location
        const riderLocation = riderLocations[route.rider.id];
        if (!riderLocation) {
          console.warn(`No location found for rider ${route.rider.id}`);
          continue;
        }

        // Geocode all order addresses
        // const orderLocations = []; // Unused
        const geocodePromises = route.orders.map(async (order) => {
          if (!order.deliveryAddress || order.deliveryAddress === 'In-Store Purchase') {
            return null;
          }
          
          return new Promise((resolve) => {
            geocoder.geocode({ address: order.deliveryAddress }, (results, status) => {
              if (status === window.google.maps.GeocoderStatus.OK && results && results.length > 0) {
                const location = results[0].geometry.location;
                resolve({
                  orderId: order.id,
                  location: { lat: location.lat(), lng: location.lng() },
                  address: order.deliveryAddress
                });
              } else {
                resolve(null);
              }
            });
          });
        });

        const geocoded = (await Promise.all(geocodePromises)).filter(Boolean);
        
        if (geocoded.length < 2) {
          // Not enough geocoded addresses
          continue;
        }

        // Calculate distance matrix
        const origins = [riderLocation, ...geocoded.map(o => o.location)];
        const destinations = [...geocoded.map(o => o.location), riderLocation];
        
        const distanceMatrix = await new Promise((resolve) => {
          distanceMatrixService.getDistanceMatrix(
            {
              origins: origins.map(orig => new window.google.maps.LatLng(orig.lat, orig.lng)),
              destinations: destinations.map(dest => new window.google.maps.LatLng(dest.lat, dest.lng)),
              travelMode: window.google.maps.TravelMode.DRIVING,
              unitSystem: window.google.maps.UnitSystem.METRIC
            },
            (response, status) => {
              if (status === window.google.maps.DistanceMatrixStatus.OK) {
                resolve(response);
              } else {
                resolve(null);
              }
            }
          );
        });

        if (!distanceMatrix) continue;

        // Extract distances and durations from matrix
        const distances = [];
        const durations = [];
        for (let i = 0; i < origins.length; i++) {
          distances[i] = [];
          durations[i] = [];
          for (let j = 0; j < destinations.length; j++) {
            const element = distanceMatrix.rows[i].elements[j];
            distances[i][j] = element.distance.value; // meters
            durations[i][j] = element.duration.value; // seconds
          }
        }

        // Nearest neighbor algorithm for TSP
        const optimizedOrderIds = [];
        const unvisited = [...geocoded.map(o => o.orderId)];
        let currentIndex = 0; // Start from rider location (index 0)
        
        while (unvisited.length > 0) {
          let nearestIndex = -1;
          let nearestDistance = Infinity;
          
          // Find nearest unvisited order
          for (let i = 0; i < geocoded.length; i++) {
            const orderId = geocoded[i].orderId;
            if (!unvisited.includes(orderId)) continue;
            
            const destIndex = i; // destination index in distance matrix
            const distance = distances[currentIndex][destIndex + 1]; // +1 because rider is at index 0
            
            if (distance < nearestDistance) {
              nearestDistance = distance;
              nearestIndex = i;
            }
          }
          
          if (nearestIndex === -1) break;
          
          const nearestOrderId = geocoded[nearestIndex].orderId;
          optimizedOrderIds.push(nearestOrderId);
          unvisited.splice(unvisited.indexOf(nearestOrderId), 1);
          currentIndex = nearestIndex + 1; // +1 because rider is at index 0
        }

        // Calculate current route total distance/time
        let currentTotalDistance = 0;
        let currentTotalTime = 0;
        for (let i = 0; i < route.orders.length - 1; i++) {
          const currentOrder = route.orders[i];
          const nextOrder = route.orders[i + 1];
          
          const currentGeocoded = geocoded.find(g => g.orderId === currentOrder.id);
          const nextGeocoded = geocoded.find(g => g.orderId === nextOrder.id);
          
          if (currentGeocoded && nextGeocoded) {
            const fromIndex = i === 0 ? 0 : geocoded.findIndex(g => g.orderId === currentOrder.id) + 1;
            const toIndex = geocoded.findIndex(g => g.orderId === nextOrder.id) + 1;
            
            if (distances[fromIndex] && distances[fromIndex][toIndex] !== undefined) {
              currentTotalDistance += distances[fromIndex][toIndex];
              currentTotalTime += durations[fromIndex][toIndex];
            }
          }
        }

        // Step 5: Estimate total distance travelled per selected rider
        // Calculate optimized route total distance/time
        let optimizedTotalDistance = 0;
        let optimizedTotalTime = 0;
        for (let i = 0; i < optimizedOrderIds.length - 1; i++) {
          const fromIndex = i === 0 ? 0 : geocoded.findIndex(g => g.orderId === optimizedOrderIds[i]) + 1;
          const toIndex = geocoded.findIndex(g => g.orderId === optimizedOrderIds[i + 1]) + 1;
          
          if (distances[fromIndex] && distances[fromIndex][toIndex] !== undefined) {
            optimizedTotalDistance += distances[fromIndex][toIndex];
            optimizedTotalTime += durations[fromIndex][toIndex];
          }
        }
        
        // Step 6: Estimate total travel time per selected rider (already calculated above)

        // Calculate savings
        const distanceSaved = currentTotalDistance - optimizedTotalDistance; // meters
        const timeSaved = currentTotalTime - optimizedTotalTime; // seconds
        
        // Estimate cost savings (assuming fuel cost per km and time cost)
        const fuelCostPerKm = 120; // KES per km (approximate)
        const driverCostPerHour = 500; // KES per hour (approximate)
        const distanceSavedKm = distanceSaved / 1000;
        const timeSavedHours = timeSaved / 3600;
        const costSaved = (distanceSavedKm * fuelCostPerKm) + (timeSavedHours * driverCostPerHour);

        newOptimizedRoutes[route.rider.id] = optimizedOrderIds;
        newSavings[route.rider.id] = {
          timeSaved: Math.round(timeSaved / 60), // minutes
          costSaved: Math.round(costSaved), // KES
          distanceSaved: Math.round(distanceSavedKm * 10) / 10 // km, 1 decimal
        };

        // Update order sequences in database
        for (let i = 0; i < optimizedOrderIds.length; i++) {
          try {
            await api.patch(`/admin/orders/${optimizedOrderIds[i]}/sequence`, {
              deliverySequence: i
            });
          } catch (error) {
            console.error(`Error updating sequence for order ${optimizedOrderIds[i]}:`, error);
          }
        }
      }
      
      // Step 5: Update progress after distance calculation
      updateOptimizationProgress(5, 'Estimating total distance per rider...', 56);
      
      // Step 6: Update progress after time calculation
      updateOptimizationProgress(6, 'Estimating total travel time per rider...', 67);
      
      // Step 7: Check if additional riders are required (30min per card)
      updateOptimizationProgress(7, 'Checking if additional riders are required...', 78);
      // TODO: Implement logic to check if routes exceed 30 minutes per rider
      // and recommend additional riders if needed
      
      // Step 8: Recommend best additional driver if needed
      updateOptimizationProgress(8, 'Recommending best additional drivers...', 89);
      // TODO: Implement logic to recommend best additional drivers
      
      setOptimizedRoutes(newOptimizedRoutes);
      setOptimizationSavings(newSavings);
      
      // Step 9: Apply optimization and update UI
      updateOptimizationProgress(9, 'Applying optimization and updating routes...', 100);
      
      // Refresh routes to show optimized order
      await fetchRiderRoutes();
      
      // Close progress dialog
      setOptimizationProgress(prev => ({ ...prev, open: false }));
      
      // Show success message
      console.log('Routes optimized successfully!');
    } catch (error) {
      console.error('Error optimizing routes:', error);
      setError(error.message || 'Failed to optimize routes');
      setOptimizationProgress(prev => ({ ...prev, open: false }));
    } finally {
      setOptimizing(false);
    }
  };

  // Move order up/down in timeline
  const handleMoveOrder = async (riderId, orderId, direction) => {
    const route = riderRoutes.find(r => r.rider.id === riderId);
    if (!route) return;
    
    const orders = [...route.orders];
    const orderIndex = orders.findIndex(o => o.id === orderId);
    
    if (orderIndex === -1) return;
    if (direction === 'up' && orderIndex === 0) return; // Already at top
    if (direction === 'down' && orderIndex === orders.length - 1) return; // Already at bottom
    
    const newIndex = direction === 'up' ? orderIndex - 1 : orderIndex + 1;
    
    // Get current deliverySequence values (or use index as fallback)
    const currentOrder = orders[orderIndex];
    const swapOrder = orders[newIndex];
    
    // Update local state immediately for UI responsiveness
    setRiderRoutes(prevRoutes => {
      return prevRoutes.map(r => {
        if (r.rider.id !== riderId) return r;
        const updatedOrders = [...r.orders];
        [updatedOrders[orderIndex], updatedOrders[newIndex]] = [updatedOrders[newIndex], updatedOrders[orderIndex]];
        return { ...r, orders: updatedOrders };
      });
    });
    
    setAllRiderRoutes(prevRoutes => {
      return prevRoutes.map(r => {
        if (r.rider.id !== riderId) return r;
        const updatedOrders = [...r.orders];
        const idx = updatedOrders.findIndex(o => o.id === orderId);
        if (idx === -1) return r;
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= updatedOrders.length) return r;
        [updatedOrders[idx], updatedOrders[swapIdx]] = [updatedOrders[swapIdx], updatedOrders[idx]];
        return { ...r, orders: updatedOrders };
      });
    });
    
    // Save to database
    try {
      // Swap deliverySequence values
      const currentSeq = currentOrder.deliverySequence !== null && currentOrder.deliverySequence !== undefined 
        ? currentOrder.deliverySequence 
        : orderIndex;
      const swapSeq = swapOrder.deliverySequence !== null && swapOrder.deliverySequence !== undefined
        ? swapOrder.deliverySequence 
        : newIndex;
      
      await Promise.all([
        api.patch(`/admin/orders/${orderId}/sequence`, { deliverySequence: swapSeq }),
        api.patch(`/admin/orders/${swapOrder.id}/sequence`, { deliverySequence: currentSeq })
      ]);
      
      // Refresh data to ensure consistency
      await fetchRiderRoutes();
    } catch (error) {
      console.error('Error updating order sequence:', error);
      setError(error.response?.data?.error || 'Failed to update order sequence');
      // Revert on error
      await fetchRiderRoutes();
    }
  };

  // Move stop up/down in timeline (can move with orders or stops)
  const handleMoveStop = async (riderId, stopIndex, direction) => {
    const route = riderRoutes.find(r => r.rider.id === riderId);
    if (!route) return;
    
    const riderStops = stops[riderId] || [];
    if (stopIndex === -1 || stopIndex >= riderStops.length) return;
    
    const stopToMove = riderStops[stopIndex];
    if (!stopToMove.stop?.id) return;
    
    // Build timeline to find current position
    const timelineItems = [];
    route.orders.forEach((order, orderIndex) => {
      timelineItems.push({ type: 'order', data: order, orderIndex });
      const stopsAfterThisOrder = riderStops.filter(s => s.insertAfterIndex === orderIndex);
      // Sort stops by sequence
      stopsAfterThisOrder.sort((a, b) => (a.stop.sequence || 0) - (b.stop.sequence || 0));
      stopsAfterThisOrder.forEach((stopItem) => {
        const originalIndex = riderStops.findIndex(s => s === stopItem);
        timelineItems.push({ type: 'stop', data: stopItem.stop, stopIndex: originalIndex, stopItem });
      });
    });
    const stopsAfterLastOrder = riderStops.filter(s => s.insertAfterIndex === -1);
    // Sort stops by sequence
    stopsAfterLastOrder.sort((a, b) => (a.stop.sequence || 0) - (b.stop.sequence || 0));
    stopsAfterLastOrder.forEach(stopItem => {
      const originalIndex = riderStops.findIndex(s => s === stopItem);
      timelineItems.push({ type: 'stop', data: stopItem.stop, stopIndex: originalIndex, stopItem });
    });
    
    // Find the stop's position in timeline
    const currentTimelineIndex = timelineItems.findIndex(item => 
      item.type === 'stop' && item.stopIndex === stopIndex
    );
    
    if (currentTimelineIndex === -1) return;
    if (direction === 'up' && currentTimelineIndex === 0) return; // Already at top
    if (direction === 'down' && currentTimelineIndex === timelineItems.length - 1) return; // Already at bottom
    
    const targetTimelineIndex = direction === 'up' ? currentTimelineIndex - 1 : currentTimelineIndex + 1;
    const targetItem = timelineItems[targetTimelineIndex];
    
    try {
      if (targetItem.type === 'order') {
        // Moving past an order - update insertAfterIndex
        const targetOrderIndex = targetItem.orderIndex;
        const newInsertAfterIndex = direction === 'up' ? targetOrderIndex - 1 : targetOrderIndex;
        
        // Calculate new sequence (count of stops at new insertAfterIndex)
        const stopsAtNewPosition = riderStops.filter(s => 
          s.insertAfterIndex === newInsertAfterIndex && s !== stopToMove
        );
        const newSequence = stopsAtNewPosition.length;
        
        // Update stop's insertAfterIndex and sequence
        await api.patch(`/admin/stops/${stopToMove.stop.id}`, {
          insertAfterIndex: newInsertAfterIndex,
          sequence: newSequence
        });
      } else {
        // Moving past another stop - swap sequence if same insertAfterIndex, otherwise update insertAfterIndex
        const targetStopItem = targetItem.stopItem;
        if (stopToMove.insertAfterIndex === targetStopItem.insertAfterIndex) {
          // Same group - swap sequence
          const stopId = stopToMove.stop.id;
          const swapStopId = targetStopItem.stop.id;
          const currentSeq = stopToMove.stop.sequence !== undefined ? stopToMove.stop.sequence : 0;
          const swapSeq = targetStopItem.stop.sequence !== undefined ? targetStopItem.stop.sequence : 0;
          
          await Promise.all([
            api.patch(`/admin/stops/${stopId}`, { sequence: swapSeq }),
            api.patch(`/admin/stops/${swapStopId}`, { sequence: currentSeq })
          ]);
        } else {
          // Different group - move to target stop's position
          const newInsertAfterIndex = targetStopItem.insertAfterIndex;
          const stopsAtNewPosition = riderStops.filter(s => 
            s.insertAfterIndex === newInsertAfterIndex && s !== stopToMove
          );
          const newSequence = direction === 'up' 
            ? stopsAtNewPosition.length // Add at end
            : 0; // Insert at beginning (we'll need to shift others)
          
          // If inserting at beginning, we need to increment sequence of existing stops
          if (newSequence === 0 && stopsAtNewPosition.length > 0) {
            await Promise.all([
              api.patch(`/admin/stops/${stopToMove.stop.id}`, {
                insertAfterIndex: newInsertAfterIndex,
                sequence: 0
              }),
              ...stopsAtNewPosition.map((s, idx) => 
                api.patch(`/admin/stops/${s.stop.id}`, { sequence: idx + 1 })
              )
            ]);
          } else {
            await api.patch(`/admin/stops/${stopToMove.stop.id}`, {
              insertAfterIndex: newInsertAfterIndex,
              sequence: newSequence
            });
          }
        }
      }
      
      // Refresh data to ensure consistency
      await fetchRiderRoutes();
    } catch (error) {
      console.error('Error updating stop position:', error);
      setError(error.response?.data?.error || 'Failed to update stop position');
      // Revert on error
      await fetchRiderRoutes();
    }
  };

  // Handle edit stop
  const handleEditStop = (stop, riderId) => {
    const riderStops = stops[riderId] || [];
    const stopItem = riderStops.find(s => s.stop.id === stop.id);
    if (stopItem) {
      setEditingStop(stop);
      setSelectedRiderForStop(riderId);
      setSelectedOrderIndexForStop(stopItem.insertAfterIndex);
      setStopFormData({
        name: stop.name || '',
        location: stop.location || '',
        instruction: stop.instruction || '',
        payment: stop.payment || 0
      });
      setStopDialogOpen(true);
    }
  };

  // Handle delete stop
  const handleDeleteStop = async (stop, riderId) => {
    if (!window.confirm(`Are you sure you want to delete the stop "${stop.name}"?`)) {
      return;
    }

    try {
      await api.delete(`/admin/stops/${stop.id}`);
      await fetchRiderRoutes();
    } catch (error) {
      console.error('Error deleting stop:', error);
      setError(error.response?.data?.error || 'Failed to delete stop');
    }
  };

  // Stop menu component
  const StopMenu = ({ stop, riderId, onEdit, onDelete }) => {
    const [anchorEl, setAnchorEl] = useState(null);
    const open = Boolean(anchorEl);

    const handleClick = (event) => {
      event.stopPropagation();
      setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
      setAnchorEl(null);
    };

    const handleEditClick = () => {
      handleClose();
      onEdit(stop, riderId);
    };

    const handleDeleteClick = () => {
      handleClose();
      onDelete(stop, riderId);
    };

    return (
      <>
        <IconButton
          size="small"
          onClick={handleClick}
          sx={{ color: colors.textSecondary }}
        >
          <MoreVert fontSize="small" />
        </IconButton>
        <Menu
          anchorEl={anchorEl}
          open={open}
          onClose={handleClose}
          onClick={(e) => e.stopPropagation()}
        >
          <MenuItem onClick={handleEditClick}>
            <Edit fontSize="small" sx={{ mr: 1 }} />
            Edit
          </MenuItem>
          <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main' }}>
            <Delete fontSize="small" sx={{ mr: 1 }} />
            Delete
          </MenuItem>
        </Menu>
      </>
    );
  };

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
          {activeTab === 0 && (
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
              NEW ORDER
            </Button>
          )}
        </Box>
        <Typography variant="h6" color="text.secondary">
          {activeTab === 0 ? 'Manage customer orders and track their status' : 'Optimize rider routes and manage deliveries'}
        </Typography>
      </Box>

      {/* Tabs */}
      <Paper sx={{ mb: 3, backgroundColor: colors.paper }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          sx={{
            '& .MuiTab-root': {
              minHeight: 56,
              color: colors.textSecondary,
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
          <Tab icon={<Assignment />} iconPosition="start" label="Orders Management" />
          <Tab icon={<RouteIcon />} iconPosition="start" label="Route Optimisation" />
        </Tabs>
      </Paper>

      {/* Orders Management Tab */}
      {activeTab === 0 && (
        <Box>
      {/* Order Tabs: Completed, Pending, Unassigned */}
      <Paper sx={{ mb: 3, backgroundColor: colors.paper }}>
        <Tabs
          value={orderTab}
          onChange={(event, newValue) => {
            setOrderTab(newValue);
            setPage(0);
            applyFilters(orders, orderStatusFilter, transactionStatusFilter, searchQuery, customFilter, newValue);
          }}
          sx={{
            '& .MuiTab-root': {
              minHeight: 48,
              color: colors.textSecondary,
              fontSize: '0.95rem',
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
          <Tab label="All Orders" value="all" />
          <Tab label="Pending" value="pending" />
          <Tab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <span>Cancellation Requests</span>
                {orders.filter(o => o.cancellationRequested && o.cancellationApproved === null).length > 0 && (
                  <Chip 
                    label={orders.filter(o => o.cancellationRequested && o.cancellationApproved === null).length}
                    size="small"
                    sx={{
                      backgroundColor: '#FFC107',
                      color: '#000',
                      fontWeight: 700,
                      height: 20,
                      minWidth: 20,
                      fontSize: '0.7rem'
                    }}
                  />
                )}
              </Box>
            } 
            value="cancellation-requests" 
          />
          <Tab label="Confirmed" value="confirmed" />
          <Tab label="Completed" value="completed" />
          <Tab label="Unassigned" value="unassigned" />
          <Tab label="Cancelled" value="cancelled" />
        </Tabs>
      </Paper>

      {/* Filters */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search Input */}
        <TextField
          size="small"
          placeholder="Search by order number or customer name..."
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
              minWidth: 300,
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

        <FormControl size="small" sx={{ minWidth: 200 }}>
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
            <MenuItem value="confirmed">Confirmed</MenuItem>
            <MenuItem value="out_for_delivery">On the Way</MenuItem>
            <MenuItem value="delivered">Delivered</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
            <MenuItem value="pos_order">POS Order</MenuItem>
            <MenuItem value="cancelled">Cancelled</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 200 }}>
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

        {(orderStatusFilter !== 'all' || transactionStatusFilter !== 'all' || searchQuery) && (
          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              setOrderStatusFilter('all');
              setTransactionStatusFilter('all');
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
          <Typography variant="body2" color="text.secondary">
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
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Order ID</TableCell>
                <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Customer</TableCell>
                <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Total Amount</TableCell>
                <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Payment Status</TableCell>
                <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Order Status</TableCell>
                <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Territory</TableCell>
                <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Driver</TableCell>
                <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredOrders.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((order) => {
                const isUnpaidDelivered = order.status === 'delivered' && order.paymentStatus === 'unpaid';
                const hasPendingCancellation = order.cancellationRequested && order.cancellationApproved === null;
                const statusChip = getOrderStatusChipProps(order.status);
                const paymentStatusChip = getPaymentStatusChipProps(order.paymentStatus, order.status);
                const nextStatusOptions = getNextStatusOptions(order.status, order.paymentType, order.paymentStatus);
                
                return (
                  <TableRow
                    key={order.id}
                    onClick={async () => {
                      // Calculate deliveryFee and itemsTotal if not present
                      let orderWithBreakdown = { ...order };
                      
                      if (orderWithBreakdown.deliveryFee === undefined || orderWithBreakdown.itemsTotal === undefined) {
                        // Calculate itemsTotal
                        const itemsTotal = orderWithBreakdown.items?.reduce((sum, item) => 
                          sum + (parseFloat(item.price || 0) * parseFloat(item.quantity || 0)), 0
                        ) || 0;
                        
                        // Calculate deliveryFee: totalAmount - tipAmount - itemsTotal
                        const tipAmount = parseFloat(orderWithBreakdown.tipAmount || 0);
                        const totalAmount = parseFloat(orderWithBreakdown.totalAmount || 0);
                        const deliveryFee = Math.max(totalAmount - tipAmount - itemsTotal, 0);
                        
                        orderWithBreakdown.itemsTotal = Number(itemsTotal.toFixed(2));
                        orderWithBreakdown.deliveryFee = Number(deliveryFee.toFixed(2));
                      }
                      
                      setSelectedOrderForDetail(orderWithBreakdown);
                      setSelectedTerritoryId(orderWithBreakdown.territoryId ?? orderWithBreakdown.territory?.id ?? '');
                      setRecentlyUpdatedInOrderDetail({ deliveryFee: false, territory: false });
                      setOrderDetailDialogOpen(true);
                    }}
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
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                          {order.customerPhone || 'N/A'}
                        </Typography>
                        {order.customerEmail && (
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.85rem' }}>
                            {order.customerEmail}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body1" sx={{ fontWeight: 600, color: '#FF3366', fontSize: '1rem' }}>
                        KES {Number(order.totalAmount).toFixed(2)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                        {order.paymentType === 'pay_now' ? 'Paid Now' : 'Pay on Delivery'}
                      </Typography>
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
                        <Chip
                          size="small"
                          {...statusChip}
                        />
                        {order.deliveryAddress === 'In-Store Purchase' && (
                          <Chip
                            label="POS"
                            size="small"
                            sx={{
                              backgroundColor: '#00E0B8',
                              color: '#003B2F',
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
                              backgroundColor: '#9C27B0',
                              color: '#FFFFFF',
                              fontWeight: 600,
                              fontSize: '0.65rem',
                              height: '20px'
                            }}
                          />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={order.territory?.name || 'No territory'}
                        size="small"
                        sx={{
                          backgroundColor: '#9e9e9e',
                          color: '#fff',
                          fontWeight: 500,
                          borderRadius: '16px',
                          '& .MuiChip-label': { px: 1.25 }
                        }}
                      />
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
                              color="success" 
                              size="small" 
                              sx={{ mt: 0.5 }}
                            />
                          )}
                          {order.driverAccepted === false && (
                            <Chip 
                              label="Rejected" 
                              color="error" 
                              size="small" 
                              sx={{ mt: 0.5 }}
                            />
                          )}
                          {order.driverAccepted === null && order.driverId && (
                            <Chip 
                              label="Pending Response" 
                              color="warning" 
                              size="small" 
                              sx={{ mt: 0.5 }}
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
                            <Person fontSize="small" color="error" />
                            <Typography variant="body2" sx={{ fontWeight: 600, color: 'error.main', fontSize: '0.95rem' }}>
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
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.95rem' }}>
                        {new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(order.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }} onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<Edit />}
                          onClick={() => handleOpenDriverDialog(order)}
                          disabled={order.status === 'delivered' || order.status === 'completed' || order.status === 'cancelled'}
                          sx={{
                            borderColor: (order.status === 'delivered' || order.status === 'completed' || order.status === 'cancelled') ? colors.border : colors.accentText,
                            color: (order.status === 'delivered' || order.status === 'completed' || order.status === 'cancelled') ? colors.textSecondary : colors.accentText,
                            '&:hover': {
                              borderColor: (order.status === 'delivered' || order.status === 'completed' || order.status === 'cancelled') ? colors.border : '#00C4A3',
                              backgroundColor: (order.status === 'delivered' || order.status === 'completed' || order.status === 'cancelled') ? 'transparent' : 'rgba(0, 224, 184, 0.1)'
                            },
                            '&.Mui-disabled': {
                              borderColor: colors.border,
                              color: colors.textSecondary
                            }
                          }}
                        >
                          {order.driver ? 'Change Driver' : 'Assign Driver'}
                        </Button>
                        {order.driver && (
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<Delete />}
                            onClick={() => handleRemoveDriver(order)}
                            disabled={order.status === 'delivered' || order.status === 'completed' || order.status === 'cancelled'}
                            sx={{
                            borderColor: (order.status === 'delivered' || order.status === 'completed' || order.status === 'cancelled') ? colors.border : '#FF3366',
                            color: (order.status === 'delivered' || order.status === 'completed' || order.status === 'cancelled') ? colors.textSecondary : '#FF3366',
                            '&:hover': {
                              borderColor: (order.status === 'delivered' || order.status === 'completed' || order.status === 'cancelled') ? colors.border : '#FF1744',
                              backgroundColor: (order.status === 'delivered' || order.status === 'completed' || order.status === 'cancelled') ? 'transparent' : 'rgba(255, 51, 102, 0.1)'
                            },
                            '&.Mui-disabled': {
                              borderColor: colors.border,
                              color: colors.textSecondary
                            }
                            }}
                          >
                            Remove Driver
                          </Button>
                        )}
                        {nextStatusOptions.length > 0 && (
                          <FormControl size="small" sx={{ minWidth: 150 }}>
                            <InputLabel>Update Status</InputLabel>
                            <Select
                              value=""
                              label="Update Status"
                              onChange={(e) => handleStatusUpdate(order.id, e.target.value)}
                            >
                              {nextStatusOptions.map(option => (
                                <MenuItem key={option.value} value={option.value}>
                                  {option.label}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        )}
                        
                        {hasPendingCancellation && (
                          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                            <Button
                              variant="contained"
                              size="small"
                              color="success"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleApproveCancellation(order.id);
                              }}
                              sx={{ flex: 1 }}
                            >
                              Approve Cancellation
                            </Button>
                            <Button
                              variant="contained"
                              size="small"
                              color="error"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRejectCancellation(order.id);
                              }}
                              sx={{ flex: 1 }}
                            >
                              Reject
                            </Button>
                          </Box>
                        )}
                        {order.paymentStatus !== 'paid' && order.status !== 'cancelled' && (
                          <Button
                            variant="contained"
                            size="small"
                            color="primary"
                            startIcon={<Payment />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenPaymentDialog(order);
                            }}
                            sx={{ mt: 1, mr: 1 }}
                          >
                            Prompt Payment
                          </Button>
                        )}
                        {order.status === 'delivered' && order.paymentStatus === 'unpaid' && (
                          <Button
                            variant="contained"
                            size="small"
                            color="success"
                            onClick={async () => {
                              await handlePaymentStatusUpdate(order.id, 'paid');
                              // This will automatically update order to completed
                            }}
                            sx={{ mt: 1 }}
                          >
                            Mark Payment Received
                          </Button>
                        )}
                        
                        {/* Manual payment verification for M-Pesa orders that are still pending */}
                        {order.paymentMethod === 'mobile_money' && 
                         order.paymentStatus === 'pending' && 
                         order.status === 'pending' &&
                         getOrderTransactionStatus(order) !== 'completed' && (
                          <Button
                            variant="outlined"
                            size="small"
                            color="primary"
                            onClick={async () => {
                              if (window.confirm(`Verify payment for Order #${order.id}?\n\nThis will mark the order as paid and confirmed.`)) {
                                try {
                                  const response = await api.post(`/admin/orders/${order.id}/verify-payment`, {
                                    receiptNumber: prompt('Enter M-Pesa receipt number (optional):') || null
                                  });
                                  if (response.data.success) {
                                    // Refresh orders to show updated status
                                    await fetchOrders();
                                    alert('Payment verified successfully!');
                                  }
                                } catch (error) {
                                  console.error('Error verifying payment:', error);
                                  alert('Failed to verify payment: ' + (error.response?.data?.error || error.message));
                                }
                              }
                            }}
                            sx={{ mt: 1, borderColor: colors.accentText, color: colors.accentText }}
                          >
                            Verify Payment
                          </Button>
                        )}
                        
                        {/* Download Receipt button for complete orders */}
                        {(order.status === 'completed' || order.status === 'delivered' || order.paymentStatus === 'paid') && (
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<PictureAsPdf />}
                            onClick={() => handleDownloadReceipt(order.id)}
                            sx={{ 
                              mt: 1, 
                              borderColor: colors.accentText, 
                              color: colors.accentText,
                              '&:hover': {
                                borderColor: '#00C4A3',
                                backgroundColor: 'rgba(0, 224, 184, 0.08)'
                              }
                            }}
                          >
                            Download Receipt
                          </Button>
                        )}
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
            rowsPerPageOptions={[10, 25, 50, 100]}
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
                  const cashAtHand = parseFloat(driver.cashAtHand || 0).toFixed(2);
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
                  Amount: KES {Number(selectedOrder.totalAmount).toFixed(2)}
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

      {/* Order Details Dialog */}
      <Dialog
        open={orderDetailDialogOpen}
        onClose={() => setOrderDetailDialogOpen(false)}
        maxWidth="md"
        fullWidth
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
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Typography variant="body1">
                      <strong>Name:</strong> {selectedOrderForDetail.customerName || 'N/A'}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body1">
                        <strong>Phone:</strong> {selectedOrderForDetail.customerPhone || 'N/A'}
                      </Typography>
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
                    {selectedOrderForDetail.deliveryAddress && (
                      <Typography variant="body1">
                        <strong>Delivery Address:</strong> {selectedOrderForDetail.deliveryAddress}
                      </Typography>
                    )}
                    <Typography variant="body1">
                      <strong>Delivery Notes:</strong> {selectedOrderForDetail.notes?.trim() ? selectedOrderForDetail.notes : '—'}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>

              {/* Delivery fee (includes territory and set-fee options) */}
              {selectedOrderForDetail && selectedOrderForDetail.deliveryFee !== undefined && (
                <Card sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: colors.accentText }}>
                      Delivery fee
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography variant="body2" sx={{ color: colors.textPrimary }}>
                          <strong>Current delivery fee:</strong> KES {Number(selectedOrderForDetail.deliveryFee ?? 0).toFixed(2)}
                        </Typography>
                        {recentlyUpdatedInOrderDetail.deliveryFee && (
                          <CheckCircle sx={{ color: '#2e7d32', fontSize: 20 }} aria-label="Updated" />
                        )}
                        {selectedOrderForDetail.status !== 'completed' && selectedOrderForDetail.status !== 'cancelled' && selectedOrderForDetail.paymentStatus !== 'paid' && (
                          <IconButton
                            size="small"
                            onClick={() => {
                              setNewDeliveryFee(Number(selectedOrderForDetail.deliveryFee ?? 0).toFixed(2));
                              setEditDeliveryFeeDialogOpen(true);
                            }}
                            sx={{ color: colors.accentText }}
                            aria-label="Edit delivery fee"
                          >
                            <Edit fontSize="small" />
                          </IconButton>
                        )}
                        <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block', width: '100%' }}>
                          Fee set when order was placed (admin or customer). Click edit to change.
                        </Typography>
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                        <FormControl size="small" sx={{ minWidth: 220 }}>
                          <InputLabel>Territory</InputLabel>
                          <Select
                            value={selectedTerritoryId}
                            label="Territory"
                            onChange={(e) => setSelectedTerritoryId(e.target.value)}
                            sx={{ fontSize: '0.95rem' }}
                          >
                            <MenuItem value="">
                              <em>No territory</em>
                            </MenuItem>
                            {territories.map((t) => (
                              <MenuItem key={t.id} value={t.id}>
                                {t.name}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <Button
                          variant="contained"
                          size="small"
                          onClick={handleUpdateOrderTerritory}
                          disabled={updatingTerritory}
                          sx={{
                            backgroundColor: colors.accentText,
                            color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
                            '&:hover': { backgroundColor: '#00C4A3' }
                          }}
                        >
                          {updatingTerritory ? <CircularProgress size={20} /> : 'Save'}
                        </Button>
                        <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {selectedOrderForDetail.territory?.name || 'No territory assigned'}
                          {recentlyUpdatedInOrderDetail.territory && (
                            <CheckCircle sx={{ color: '#2e7d32', fontSize: 18 }} aria-label="Updated" />
                          )}
                        </Typography>
                      </Box>

                      {(() => {
                        const tid = selectedTerritoryId === '' ? (selectedOrderForDetail.territoryId ?? selectedOrderForDetail.territory?.id) : selectedTerritoryId;
                        const hasTerritory = tid != null && tid !== '';
                        const territoryForFee = hasTerritory ? territories.find(t => Number(t.id) === Number(tid)) : null;
                        const feeCBD = territoryForFee ? Number(territoryForFee.deliveryFromCBD ?? 0) : null;
                        const feeRuaka = territoryForFee ? Number(territoryForFee.deliveryFromRuaka ?? 0) : null;
                        if (!hasTerritory || (selectedOrderForDetail.status === 'completed' || selectedOrderForDetail.status === 'cancelled' || selectedOrderForDetail.paymentStatus === 'paid')) return null;
                        return (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            <Typography variant="subtitle2" sx={{ width: '100%', color: colors.textPrimary }}>
                              Set delivery fee to:
                            </Typography>
                            {feeCBD != null && (
                              <Button
                                variant="outlined"
                                size="small"
                                onClick={() => handleApplyTerritoryDeliveryFee(feeCBD)}
                                disabled={applyingTerritoryFee}
                                sx={{ fontSize: '0.8rem' }}
                              >
                                {applyingTerritoryFee ? <CircularProgress size={16} /> : `Territory – CBD (KES ${feeCBD.toFixed(2)})`}
                              </Button>
                            )}
                            {feeRuaka != null && (
                              <Button
                                variant="outlined"
                                size="small"
                                onClick={() => handleApplyTerritoryDeliveryFee(feeRuaka)}
                                disabled={applyingTerritoryFee}
                                sx={{ fontSize: '0.8rem' }}
                              >
                                {applyingTerritoryFee ? <CircularProgress size={16} /> : `Territory – Ruaka (KES ${feeRuaka.toFixed(2)})`}
                              </Button>
                            )}
                            <Button
                              variant="outlined"
                              size="small"
                              onClick={() => handleApplyTerritoryDeliveryFee(adminDeliveryFees.deliveryFeeWithAlcohol)}
                              disabled={applyingTerritoryFee}
                              sx={{ fontSize: '0.8rem' }}
                            >
                              {applyingTerritoryFee ? <CircularProgress size={16} /> : `Admin – With alcohol (KES ${Number(adminDeliveryFees.deliveryFeeWithAlcohol).toFixed(2)})`}
                            </Button>
                            <Button
                              variant="outlined"
                              size="small"
                              onClick={() => handleApplyTerritoryDeliveryFee(adminDeliveryFees.deliveryFeeWithoutAlcohol)}
                              disabled={applyingTerritoryFee}
                              sx={{ fontSize: '0.8rem' }}
                            >
                              {applyingTerritoryFee ? <CircularProgress size={16} /> : `Admin – Without alcohol (KES ${Number(adminDeliveryFees.deliveryFeeWithoutAlcohol).toFixed(2)})`}
                            </Button>
                          </Box>
                        );
                      })()}
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
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>
                              {item.drink?.name || 'Unknown Item'}
                            </Typography>
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
                              KES {Number(item.price || 0).toFixed(2)}
                            </Typography>
                            {selectedOrderForDetail.status !== 'completed' && 
                             selectedOrderForDetail.status !== 'cancelled' && 
                             selectedOrderForDetail.paymentStatus !== 'paid' && (
                              <IconButton
                                size="small"
                                onClick={() => {
                                  setEditingItem(item);
                                  setNewPrice(Number(item.price || 0).toFixed(2));
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
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body1">
                          <strong>Items Subtotal:</strong>
                        </Typography>
                        <Typography variant="body1">
                          KES {(() => {
                            const itemsTotal = selectedOrderForDetail.itemsTotal || 
                              selectedOrderForDetail.items.reduce((sum, item) => 
                                sum + (parseFloat(item.price || 0) * parseFloat(item.quantity || 0)), 0
                              );
                            return Number(itemsTotal).toFixed(2);
                          })()}
                        </Typography>
                      </Box>
                    )}
                    {/* Delivery Fee in Summary */}
                    {selectedOrderForDetail.deliveryFee !== undefined && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body1">
                          <strong>Delivery Fee:</strong>
                        </Typography>
                        <Typography variant="body1">
                          KES {Number(selectedOrderForDetail.deliveryFee || 0).toFixed(2)}
                        </Typography>
                      </Box>
                    )}
                    {/* Tip Amount */}
                    {selectedOrderForDetail.tipAmount && parseFloat(selectedOrderForDetail.tipAmount) > 0 && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body1">
                          <strong>Tip:</strong>
                        </Typography>
                        <Typography variant="body1">
                          KES {Number(selectedOrderForDetail.tipAmount).toFixed(2)}
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
                        KES {Number(selectedOrderForDetail.totalAmount).toFixed(2)}
                      </Typography>
                    </Box>
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
                          {Number(selectedOrderForDetail.deliveryDistance).toFixed(2)} km
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
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          {selectedOrderForDetail && 
           selectedOrderForDetail.paymentStatus !== 'paid' && 
           selectedOrderForDetail.status !== 'cancelled' && (
            <Button
              variant="contained"
              startIcon={<Payment />}
              onClick={() => {
                handleOpenPaymentDialog(selectedOrderForDetail);
              }}
              sx={{
                backgroundColor: colors.accentText,
                color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
                mr: 1,
                '&:hover': {
                  backgroundColor: '#00C4A3'
                }
              }}
            >
              Prompt Payment
            </Button>
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
                Current Price: KES {Number(editingItem.price || 0).toFixed(2)}
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

      {/* Edit Delivery Fee Dialog */}
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
          Edit Delivery Fee
        </DialogTitle>
        <DialogContent>
          {selectedOrderForDetail && (
            <Box sx={{ pt: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Current Delivery Fee: KES {Number(selectedOrderForDetail.deliveryFee || 0).toFixed(2)}
              </Typography>
              <TextField
                autoFocus
                fullWidth
                label="New Delivery Fee"
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
            {updatingDeliveryFee ? 'Updating...' : 'Update Delivery Fee'}
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
          Prompt Payment
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
                Amount: <strong>KES {parseFloat(selectedOrderForPayment.totalAmount || 0).toFixed(2)}</strong>
              </Typography>
              <TextField
                autoFocus
                fullWidth
                label="Phone Number"
                type="tel"
                value={paymentPhone}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 12);
                  setPaymentPhone(value);
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
              'Send Payment Prompt'
            )}
          </Button>
        </DialogActions>
      </Dialog>
        </Box>
      )}

      {/* New Order Dialog - Outside conditional blocks so it can appear from any tab */}
      <NewOrderDialog
        open={newOrderDialogOpen}
        onClose={() => setNewOrderDialogOpen(false)}
        onOrderCreated={(newOrder) => {
          // Refresh orders list
          fetchOrders();
          setNewOrderDialogOpen(false);
        }}
      />

      {/* Route Optimisation Tab */}
      {activeTab === 1 && (
        <Box>
          {routesLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box>
              {/* View Mode Switcher and Search */}
              <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                <ToggleButtonGroup
                  value={routeViewMode}
                  exclusive
                  onChange={(e, newMode) => newMode && setRouteViewMode(newMode)}
                  sx={{
                    '& .MuiToggleButton-root': {
                      color: colors.textSecondary,
                      borderColor: colors.border,
                      '&.Mui-selected': {
                        backgroundColor: colors.accentText,
                        color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
                        '&:hover': {
                          backgroundColor: '#00C4A3'
                        }
                      }
                    }
                  }}
                >
                  <ToggleButton value="list">
                    <List sx={{ mr: 1 }} />
                    List View
                  </ToggleButton>
                  <ToggleButton value="map">
                    <Map sx={{ mr: 1 }} />
                    Map View
                  </ToggleButton>
                </ToggleButtonGroup>

                {routeViewMode === 'map' && (
                  <Tooltip title="Refresh rider locations">
                    <IconButton
                      onClick={handleRefreshLocations}
                      disabled={refreshingLocations}
                      sx={{
                        color: colors.accentText,
                        '&:hover': {
                          backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.1)' : 'rgba(0, 224, 184, 0.05)',
                        },
                      }}
                    >
                      {refreshingLocations ? <CircularProgress size={24} /> : <Refresh />}
                    </IconButton>
                  </Tooltip>
                )}

                <Button
                  variant="contained"
                  startIcon={optimizing ? <CircularProgress size={20} /> : <AutoAwesome />}
                  onClick={handleOptimizeRoutes}
                  disabled={optimizing || isRouteOptimized()}
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
                  {optimizing ? 'Optimizing...' : isRouteOptimized() ? 'Optimized' : 'Optimize Routes'}
                </Button>

                <Box sx={{ flex: 1, minWidth: '500px' }}>
                  <Autocomplete
                    multiple
                    options={allRiders}
                    getOptionLabel={(option) => {
                      const status = option.status || 'offline';
                      const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
                      return `${option.name} (${option.phoneNumber}) - ${statusLabel}`;
                    }}
                    value={selectedRiders}
                    onChange={(event, newValue) => {
                      if (newValue.length <= 3) {
                        setSelectedRiders(newValue);
                        if (newValue.length === 0) {
                          setRiderRoutes(allRiderRoutes);
                        } else {
                          const selectedIds = newValue.map(rider => rider.id);
                          const existingRoutes = allRiderRoutes.filter(route => selectedIds.includes(route.rider.id));
                          const ridersWithoutRoutes = newValue.filter(rider => 
                            !allRiderRoutes.some(route => route.rider.id === rider.id)
                          );
                          const newRoutes = ridersWithoutRoutes.map(rider => ({
                            rider,
                            orders: []
                          }));
                          setRiderRoutes([...existingRoutes, ...newRoutes]);
                        }
                      }
                    }}
                    filterOptions={(options, params) => {
                      const { inputValue } = params;
                      const filtered = options.filter(option => {
                        const searchTerm = inputValue.toLowerCase();
                        const name = (option.name || '').toLowerCase();
                        const phone = (option.phoneNumber || '').toLowerCase();
                        const status = (option.status || '').toLowerCase();
                        return name.includes(searchTerm) || phone.includes(searchTerm) || status.includes(searchTerm);
                      });
                      return filtered;
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Search and Select Riders (Max 3)"
                        placeholder="Type to search riders..."
                        sx={{
                          width: '100%',
                          minWidth: '500px',
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
                          '& .MuiInputLabel-root': {
                            color: colors.textSecondary,
                          },
                          '& .MuiInputLabel-root.Mui-focused': {
                            color: colors.accentText,
                          },
                        }}
                      />
                    )}
                    renderTags={(value, getTagProps) => 
                      value.map((option, index) => (
                        <Chip
                          label={`${option.name} (${option.phoneNumber})`}
                          {...getTagProps({ index })}
                          onDelete={() => {
                            const updatedSelectedRiders = selectedRiders.filter(rider => rider.id !== option.id);
                            setSelectedRiders(updatedSelectedRiders);
                            if (updatedSelectedRiders.length === 0) {
                              setRiderRoutes(allRiderRoutes);
                            } else {
                              const selectedIds = updatedSelectedRiders.map(rider => rider.id);
                              const existingRoutes = allRiderRoutes.filter(route => selectedIds.includes(route.rider.id));
                              const ridersWithoutRoutes = updatedSelectedRiders.filter(rider => 
                                !allRiderRoutes.some(route => route.rider.id === rider.id)
                              );
                              const newRoutes = ridersWithoutRoutes.map(rider => ({
                                rider,
                                orders: []
                              }));
                              setRiderRoutes([...existingRoutes, ...newRoutes]);
                            }
                          }}
                          sx={{
                            backgroundColor: colors.accentText,
                            color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
                            '& .MuiChip-deleteIcon': {
                              color: isDarkMode ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)',
                              '&:hover': {
                                color: isDarkMode ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)',
                              },
                            },
                          }}
                        />
                      ))
                    }
                    filterSelectedOptions
                    noOptionsText="No riders found"
                    getOptionDisabled={() => selectedRiders.length >= 3}
                  />
                </Box>
              </Box>

              {routeViewMode === 'map' ? (
                // Map View
                <Box sx={{ height: '600px', width: '100%', position: 'relative', mb: 3 }}>
                  {process.env.REACT_APP_GOOGLE_MAPS_API_KEY && isMapLoaded ? (
                    <RouteMapView
                      riderRoutes={riderRoutes}
                      stops={stops}
                      riderLocations={riderLocations}
                      mapCenter={mapCenter}
                      onMapCenterChange={setMapCenter}
                      colors={colors}
                      isDarkMode={isDarkMode}
                      formatDateTime={formatDateTime}
                      getOrderStatusChipProps={getOrderStatusChipProps}
                      getPaymentStatusChipProps={getPaymentStatusChipProps}
                    />
                  ) : process.env.REACT_APP_GOOGLE_MAPS_API_KEY ? (
                    <Paper sx={{ p: 4, textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <CircularProgress sx={{ mb: 2 }} />
                      <Typography variant="h6" color="text.secondary">
                        Loading Map...
                      </Typography>
                    </Paper>
                  ) : (
                    <Paper sx={{ p: 4, textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <Map sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                      <Typography variant="h6" color="text.secondary">
                        Google Maps API Key Required
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Please add REACT_APP_GOOGLE_MAPS_API_KEY to your .env file to enable Map View
                      </Typography>
                    </Paper>
                  )}
                </Box>
              ) : riderRoutes.length === 0 ? (
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                  <LocalShipping sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary">
                    No routes found
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {selectedRiders.length > 0 
                      ? 'No routes match the selected riders'
                      : 'Routes will appear here when riders have assigned orders'}
                  </Typography>
                </Paper>
              ) : (
                <Box
                  sx={{
                    display: 'flex',
                    gap: 3,
                    width: '100%',
                    alignItems: 'stretch'
                  }}
                >
                  {riderRoutes.map((route) => {
                    // Build timeline items (orders and stops combined)
                    const timelineItems = [];
                    const riderStops = stops[route.rider.id] || [];
                    
                    route.orders.forEach((order, orderIndex) => {
                      timelineItems.push({ type: 'order', data: order, orderIndex });
                      
                      const stopsAfterThisOrder = riderStops.filter(stopItem => 
                        stopItem.insertAfterIndex === orderIndex
                      );
                      stopsAfterThisOrder.forEach((stopItem, stopItemIndex) => {
                        const originalIndex = riderStops.findIndex(s => s === stopItem);
                        timelineItems.push({ type: 'stop', data: stopItem.stop, stopIndex: originalIndex });
                      });
                    });
                    
                    const stopsAfterLastOrder = riderStops.filter(stopItem => 
                      stopItem.insertAfterIndex === -1
                    );
                    stopsAfterLastOrder.forEach(stopItem => {
                      const originalIndex = riderStops.findIndex(s => s === stopItem);
                      timelineItems.push({ type: 'stop', data: stopItem.stop, stopIndex: originalIndex });
                    });

                    return (
                      <Box
                        key={route.rider.id}
                        sx={{
                          flex: '1 1 0',
                          minWidth: 0,
                          display: 'flex',
                          transition: 'flex 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                      >
                        <Card 
                          sx={{ 
                            backgroundColor: colors.paper, 
                            width: '100%', 
                            display: 'flex', 
                            flexDirection: 'column',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                          }}
                        >
                          <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'visible' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
                              <LocalShipping sx={{ fontSize: 32, color: colors.accentText }} />
                              <Box sx={{ flex: 1 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                  <Typography variant="h6" sx={{ color: colors.textPrimary, fontWeight: 600 }}>
                                    {route.rider.name}
                                  </Typography>
                                  {route.rider.status && (
                                    <Chip
                                      label={
                                        route.rider.status === 'active' ? 'On Shift' :
                                        route.rider.status === 'offline' ? 'Off Shift' :
                                        route.rider.status === 'on_delivery' ? 'On Delivery' :
                                        route.rider.status === 'inactive' ? 'Inactive' :
                                        route.rider.status
                                      }
                                      size="small"
                                      color={
                                        route.rider.status === 'active' ? 'success' :
                                        route.rider.status === 'offline' ? 'error' :
                                        route.rider.status === 'on_delivery' ? 'warning' :
                                        'default'
                                      }
                                      sx={{
                                        height: 20,
                                        fontSize: '0.7rem',
                                        fontWeight: 600
                                      }}
                                    />
                                  )}
                                </Box>
                                <Typography variant="body2" color="text.secondary">
                                  {route.rider.phoneNumber} • {route.orders.length} order{route.orders.length !== 1 ? 's' : ''}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {riderStops.length} stop{riderStops.length !== 1 ? 's' : ''}
                                </Typography>
                              </Box>
                              <IconButton
                                size="small"
                                onClick={() => {
                                  const updatedSelectedRiders = selectedRiders.filter(rider => rider.id !== route.rider.id);
                                  setSelectedRiders(updatedSelectedRiders);
                                  if (updatedSelectedRiders.length === 0) {
                                    setRiderRoutes(allRiderRoutes);
                                  } else {
                                    const selectedIds = updatedSelectedRiders.map(rider => rider.id);
                                    const existingRoutes = allRiderRoutes.filter(routeItem => selectedIds.includes(routeItem.rider.id));
                                    const ridersWithoutRoutes = updatedSelectedRiders.filter(rider => 
                                      !allRiderRoutes.some(routeItem => routeItem.rider.id === rider.id)
                                    );
                                    const newRoutes = ridersWithoutRoutes.map(rider => ({
                                      rider,
                                      orders: []
                                    }));
                                    setRiderRoutes([...existingRoutes, ...newRoutes]);
                                  }
                                }}
                                sx={{
                                  color: colors.textSecondary,
                                  '&:hover': {
                                    color: colors.error,
                                    backgroundColor: isDarkMode ? 'rgba(255, 51, 102, 0.1)' : 'rgba(255, 51, 102, 0.05)',
                                  },
                                }}
                              >
                                <Close />
                              </IconButton>
                            </Box>
                            <Divider sx={{ mb: 3 }} />
                            
                            <Box sx={{ mb: 2, px: 1 }}>
                              <Typography 
                                variant="caption" 
                                color="text.secondary" 
                                sx={{ 
                                  fontStyle: 'italic',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 0.5,
                                  fontSize: '0.75rem'
                                }}
                              >
                                <LocalShipping sx={{ fontSize: 14 }} />
                                Click and hold an order or stop card to reassign it to another rider
                              </Typography>
                            </Box>
                            
                            <Box 
                              sx={{ 
                                position: 'relative', 
                                flexGrow: 1,
                                transition: 'all 0.3s ease',
                                opacity: dragOverRider === route.rider.id ? 1 : 1,
                                backgroundColor: dragOverRider === route.rider.id 
                                  ? (isDarkMode ? 'rgba(0, 224, 184, 0.1)' : 'rgba(0, 224, 184, 0.05)')
                                  : 'transparent',
                                borderRadius: dragOverRider === route.rider.id ? 2 : 0,
                                border: dragOverRider === route.rider.id 
                                  ? `2px dashed ${colors.accentText}` 
                                  : '2px solid transparent',
                                p: dragOverRider === route.rider.id ? 2 : 0,
                                overflow: 'visible', // Ensure buttons are visible
                                m: dragOverRider === route.rider.id ? -2 : 0
                              }}
                              onDragOver={(e) => {
                                e.preventDefault();
                                if ((draggedOrder || draggedStop) && 
                                    (!draggedOrder || draggedOrder.driverId !== route.rider.id) &&
                                    (!draggedStop || draggedStop.riderId !== route.rider.id)) {
                                  setDragOverRider(route.rider.id);
                                }
                              }}
                              onDragLeave={() => {
                                setDragOverRider(null);
                              }}
                              onDrop={async (e) => {
                                e.preventDefault();
                                if (draggedOrder) {
                                  // Only reassign if the order is being moved to a different rider
                                  if (draggedOrder.driverId !== route.rider.id) {
                                    try {
                                      await api.patch(`/admin/orders/${draggedOrder.id}/driver`, {
                                        driverId: route.rider.id
                                      });
                                      // Fetch fresh data from backend to avoid duplicates
                                      await fetchRiderRoutes();
                                    } catch (error) {
                                      console.error('Error reassigning order:', error);
                                      setError(error.response?.data?.error || 'Failed to reassign order');
                                    }
                                  }
                                  // If same rider, no action needed (order stays in place)
                                } else if (draggedStop) {
                                  // Move stop to this rider (same or different)
                                  const { riderId: oldRiderId, stopIndex } = draggedStop;
                                  const stopToMove = stops[oldRiderId]?.[stopIndex];
                                  
                                  if (stopToMove && stopToMove.stop?.id) {
                                    try {
                                      // Calculate new sequence (count of stops at insertAfterIndex -1 for new rider)
                                      const newRiderStops = stops[route.rider.id] || [];
                                      const stopsAtEnd = newRiderStops.filter(s => s.insertAfterIndex === -1);
                                      const newSequence = stopsAtEnd.length;
                                      
                                      // Update in database
                                      await api.patch(`/admin/stops/${stopToMove.stop.id}`, {
                                        driverId: route.rider.id,
                                        insertAfterIndex: -1,
                                        sequence: newSequence
                                      });
                                      
                                      // Update local state
                                      setStops(prev => {
                                        const newStops = { ...prev };
                                        // Remove from old rider
                                        newStops[oldRiderId] = newStops[oldRiderId].filter((_, idx) => idx !== stopIndex);
                                        if (newStops[oldRiderId].length === 0) {
                                          delete newStops[oldRiderId];
                                        }
                                        // Add to new rider
                                        if (!newStops[route.rider.id]) {
                                          newStops[route.rider.id] = [];
                                        }
                                        newStops[route.rider.id].push({
                                          ...stopToMove,
                                          insertAfterIndex: -1
                                        });
                                        return newStops;
                                      });
                                      
                                      // Refresh to ensure consistency
                                      await fetchRiderRoutes();
                                    } catch (error) {
                                      console.error('Error moving stop:', error);
                                      setError(error.response?.data?.error || 'Failed to move stop');
                                    }
                                  }
                                }
                                setDraggedOrder(null);
                                setDraggedStop(null);
                                setDragOverRider(null);
                              }}
                            >
                              {timelineItems.length === 0 ? (
                                <Box sx={{ py: 3, textAlign: 'center' }}>
                                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', mb: 2 }}>
                                    No active orders assigned
                                  </Typography>
                                  <Button
                                    variant="outlined"
                                    startIcon={<Add />}
                                    onClick={() => {
                                      setSelectedRiderForStop(route.rider.id);
                                      setSelectedOrderIndexForStop(-1);
                                      setStopDialogOpen(true);
                                    }}
                                    sx={{
                                      borderColor: colors.accentText,
                                      color: colors.accentText,
                                      '&:hover': {
                                        borderColor: colors.accentText,
                                        backgroundColor: isDarkMode 
                                          ? 'rgba(0, 224, 184, 0.1)' 
                                          : 'rgba(0, 224, 184, 0.05)'
                                      }
                                    }}
                                  >
                                    Add Stop
                                  </Button>
                                </Box>
                              ) : (
                                <>
                                  {timelineItems.map((item, itemIndex) => {
                                    if (item.type === 'order') {
                                      const order = item.data;
                                      const statusChip = getOrderStatusChipProps(order.status);
                                      const paymentStatusChip = getPaymentStatusChipProps(order.paymentStatus, order.status);
                                      const isDragging = draggedOrder?.id === order.id;
                                      
                                      return (
                                        <React.Fragment key={`order-${order.id}`}>
                                          <Box 
                                            sx={{ 
                                              position: 'relative', 
                                              mb: 4,
                                              ml: 5, // Add left margin for down button
                                              mr: 5, // Add right margin for up button
                                              opacity: isDragging ? 0.5 : 1,
                                              cursor: 'grab',
                                              '&:active': {
                                                cursor: 'grabbing'
                                              },
                                              transition: 'opacity 0.2s ease, transform 0.2s ease',
                                              transform: isDragging ? 'scale(0.98)' : 'scale(1)'
                                            }}
                                            draggable
                                            onDragStart={(e) => {
                                              setDraggedOrder(order);
                                              e.dataTransfer.effectAllowed = 'move';
                                              e.dataTransfer.setData('application/json', JSON.stringify(order));
                                            }}
                                            onDragEnd={() => {
                                              setDraggedOrder(null);
                                              setDragOverRider(null);
                                            }}
                                          >
                                            <Card 
                                              variant="outlined" 
                                              sx={{ 
                                                backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.05)' : 'rgba(0, 224, 184, 0.02)',
                                                borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
                                                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                                                userSelect: 'none',
                                                transition: 'all 0.2s ease',
                                                '&:hover': {
                                                  boxShadow: isDragging ? '0 2px 8px rgba(0, 0, 0, 0.1)' : `0 4px 12px rgba(0, 224, 184, 0.2)`,
                                                  transform: isDragging ? 'none' : 'translateY(-2px)'
                                                }
                                              }}
                                            >
                                              <CardContent>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                                                  <Box sx={{ flex: 1 }}>
                                                    <Typography variant="h6" sx={{ fontWeight: 600, color: colors.textPrimary }}>
                                                      Order #{order.id}
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                      {order.customerName}
                                                    </Typography>
                                                  </Box>
                                                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                                    <Chip
                                                      {...statusChip}
                                                      size="small"
                                                    />
                                                    <Chip
                                                      {...paymentStatusChip}
                                                      size="small"
                                                    />
                                                  </Box>
                                                </Box>
                                                {order.deliveryAddress && (
                                                  <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, mb: 2, gap: 0.5, width: '100%' }}>
                                                    <LocationOn fontSize="small" sx={{ color: colors.textSecondary, flexShrink: 0 }} />
                                                    <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
                                                      {order.deliveryAddress}
                                                    </Typography>
                                                  </Box>
                                                )}
                                                
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <AccessTime fontSize="small" sx={{ color: colors.textSecondary }} />
                                                    <Typography variant="caption" color="text.secondary">
                                                      {formatDateTime(order.createdAt)}
                                                    </Typography>
                                                  </Box>
                                                  <Typography variant="body2" sx={{ fontWeight: 600, color: colors.accentText }}>
                                                    KES {parseFloat(order.totalAmount || 0).toFixed(2)}
                                                  </Typography>
                                                </Box>
                                                
                                                {order.items && order.items.length > 0 && (
                                                  <Box sx={{ mt: 2 }}>
                                                    <Typography variant="caption" color="text.secondary">
                                                      {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                                                    </Typography>
                                                  </Box>
                                                )}
                                              </CardContent>
                                            </Card>
                                            <IconButton
                                              size="small"
                                              onClick={() => handleMoveOrder(route.rider.id, order.id, 'down')}
                                              disabled={item.orderIndex === route.orders.length - 1}
                                              sx={{
                                                position: 'absolute',
                                                left: -45,
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                p: 0.75,
                                                color: colors.textSecondary,
                                                backgroundColor: colors.paper,
                                                border: `1px solid ${colors.border}`,
                                                zIndex: 10,
                                                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                                                '&:hover': {
                                                  color: colors.accentText,
                                                  backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.1)' : 'rgba(0, 224, 184, 0.05)',
                                                  borderColor: colors.accentText
                                                },
                                                '&:disabled': {
                                                  color: colors.border,
                                                  opacity: 0.5
                                                }
                                              }}
                                            >
                                              <KeyboardArrowDown fontSize="small" />
                                            </IconButton>
                                            <IconButton
                                              size="small"
                                              onClick={() => handleMoveOrder(route.rider.id, order.id, 'up')}
                                              disabled={item.orderIndex === 0}
                                              sx={{
                                                position: 'absolute',
                                                right: -45,
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                p: 0.75,
                                                color: colors.textSecondary,
                                                backgroundColor: colors.paper,
                                                border: `1px solid ${colors.border}`,
                                                zIndex: 10,
                                                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                                                '&:hover': {
                                                  color: colors.accentText,
                                                  backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.1)' : 'rgba(0, 224, 184, 0.05)',
                                                  borderColor: colors.accentText
                                                },
                                                '&:disabled': {
                                                  color: colors.border,
                                                  opacity: 0.5
                                                }
                                              }}
                                            >
                                              <KeyboardArrowUp fontSize="small" />
                                            </IconButton>
                                          </Box>
                                          
                                          {item.orderIndex < route.orders.length - 1 && (
                                            <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
                                              <Button
                                                variant="outlined"
                                                startIcon={<Add />}
                                                onClick={() => {
                                                  setSelectedRiderForStop(route.rider.id);
                                                  setSelectedOrderIndexForStop(item.orderIndex);
                                                  setStopDialogOpen(true);
                                                }}
                                                sx={{
                                                  borderColor: colors.accentText,
                                                  color: colors.accentText,
                                                  '&:hover': {
                                                    borderColor: colors.accentText,
                                                    backgroundColor: isDarkMode 
                                                      ? 'rgba(0, 224, 184, 0.1)' 
                                                      : 'rgba(0, 224, 184, 0.05)'
                                                  }
                                                }}
                                              >
                                                Add Stop
                                              </Button>
                                            </Box>
                                          )}
                                        </React.Fragment>
                                      );
                                    } else {
                                      // Stop card
                                      const stop = item.data;
                                      const riderStops = stops[route.rider.id] || [];
                                      // Use the stopIndex from the timeline item if available, otherwise find it
                                      const stopIndex = item.stopIndex !== undefined 
                                        ? item.stopIndex 
                                        : riderStops.findIndex((s, idx) => {
                                            // Find the stop in the stops array
                                            return s.stop.name === stop.name && s.stop.location === stop.location;
                                          });
                                      
                                      // Build timeline to check if stop can move
                                      const timelineItemsForCheck = [];
                                      route.orders.forEach((order, orderIdx) => {
                                        timelineItemsForCheck.push({ type: 'order', data: order, orderIndex: orderIdx });
                                        const stopsAfterOrder = riderStops.filter(s => s.insertAfterIndex === orderIdx);
                                        // Sort stops by sequence
                                        stopsAfterOrder.sort((a, b) => (a.stop.sequence || 0) - (b.stop.sequence || 0));
                                        stopsAfterOrder.forEach((stopItem) => {
                                          const origIdx = riderStops.findIndex(s => s === stopItem);
                                          timelineItemsForCheck.push({ type: 'stop', data: stopItem.stop, stopIndex: origIdx, stopItem });
                                        });
                                      });
                                      const stopsAtEnd = riderStops.filter(s => s.insertAfterIndex === -1);
                                      // Sort stops by sequence
                                      stopsAtEnd.sort((a, b) => (a.stop.sequence || 0) - (b.stop.sequence || 0));
                                      stopsAtEnd.forEach(stopItem => {
                                        const origIdx = riderStops.findIndex(s => s === stopItem);
                                        timelineItemsForCheck.push({ type: 'stop', data: stopItem.stop, stopIndex: origIdx, stopItem });
                                      });
                                      
                                      const currentTimelineIdx = timelineItemsForCheck.findIndex(item => 
                                        item.type === 'stop' && item.stopIndex === stopIndex
                                      );
                                      
                                      // Disabled conditions: check timeline position (can move with orders or stops)
                                      const isFirstInTimeline = currentTimelineIdx === 0;
                                      const isLastInTimeline = currentTimelineIdx === timelineItemsForCheck.length - 1;
                                      
                                      const isDragging = draggedStop?.riderId === route.rider.id && draggedStop?.stopIndex === stopIndex;
                                      
                                      return (
                                        <Box key={`stop-${itemIndex}`} sx={{ mb: 4, ml: 5, mr: 5 }}>
                                          <Box
                                            sx={{
                                              position: 'relative',
                                              opacity: isDragging ? 0.5 : 1,
                                              cursor: 'grab',
                                              '&:active': {
                                                cursor: 'grabbing'
                                              },
                                              transition: 'opacity 0.2s ease, transform 0.2s ease',
                                              transform: isDragging ? 'scale(0.98)' : 'scale(1)'
                                            }}
                                            draggable
                                            onDragStart={(e) => {
                                              setDraggedStop({ riderId: route.rider.id, stopIndex });
                                              e.dataTransfer.effectAllowed = 'move';
                                              e.dataTransfer.setData('application/json', JSON.stringify({ type: 'stop', riderId: route.rider.id, stopIndex }));
                                            }}
                                            onDragEnd={() => {
                                              setDraggedStop(null);
                                              setDragOverRider(null);
                                            }}
                                          >
                                            <Card
                                              variant="outlined"
                                              sx={{
                                                backgroundColor: isDarkMode 
                                                  ? 'rgba(255, 193, 7, 0.1)' 
                                                  : 'rgba(255, 193, 7, 0.05)',
                                                borderColor: '#FFC107',
                                                borderWidth: 2,
                                                borderStyle: 'dashed',
                                                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                                                transition: 'all 0.2s ease',
                                                '&:hover': {
                                                  boxShadow: isDragging ? '0 2px 8px rgba(0, 0, 0, 0.1)' : '0 4px 12px rgba(255, 193, 7, 0.3)',
                                                  transform: isDragging ? 'none' : 'translateY(-2px)'
                                                }
                                              }}
                                            >
                                              <CardContent sx={{ position: 'relative' }}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                                                  <Box sx={{ flex: 1 }}>
                                                    <Typography variant="h6" sx={{ fontWeight: 600, color: '#FFC107' }}>
                                                      {stop.name}
                                                    </Typography>
                                                    {stop.location && (
                                                      <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, mb: 2, gap: 0.5, width: '100%' }}>
                                                        <LocationOn fontSize="small" sx={{ color: colors.textSecondary, flexShrink: 0 }} />
                                                        <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
                                                          {stop.location}
                                                        </Typography>
                                                      </Box>
                                                    )}
                                                    {stop.instruction && (
                                                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                                        {stop.instruction}
                                                      </Typography>
                                                    )}
                                                  </Box>
                                                  {stop.payment && (
                                                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#FFC107' }}>
                                                      KES {parseFloat(stop.payment || 0).toFixed(2)}
                                                    </Typography>
                                                  )}
                                                </Box>
                                                <Box sx={{ position: 'absolute', bottom: 8, right: 8 }}>
                                                  <StopMenu stop={stop} riderId={route.rider.id} onEdit={handleEditStop} onDelete={handleDeleteStop} />
                                                </Box>
                                              </CardContent>
                                            </Card>
                                            <IconButton
                                              size="small"
                                              onClick={() => handleMoveStop(route.rider.id, stopIndex, 'down')}
                                              disabled={stopIndex === -1 || isLastInTimeline}
                                              sx={{
                                                position: 'absolute',
                                                left: -45,
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                p: 0.75,
                                                color: colors.textSecondary,
                                                backgroundColor: colors.paper,
                                                border: `1px solid ${colors.border}`,
                                                zIndex: 10,
                                                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                                                '&:hover': {
                                                  color: '#FFC107',
                                                  backgroundColor: isDarkMode ? 'rgba(255, 193, 7, 0.1)' : 'rgba(255, 193, 7, 0.05)',
                                                  borderColor: '#FFC107'
                                                },
                                                '&:disabled': {
                                                  color: colors.border,
                                                  opacity: 0.5
                                                }
                                              }}
                                            >
                                              <KeyboardArrowDown fontSize="small" />
                                            </IconButton>
                                            <IconButton
                                              size="small"
                                              onClick={() => handleMoveStop(route.rider.id, stopIndex, 'up')}
                                              disabled={stopIndex === -1 || isFirstInTimeline}
                                              sx={{
                                                position: 'absolute',
                                                right: -45,
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                p: 0.75,
                                                color: colors.textSecondary,
                                                backgroundColor: colors.paper,
                                                border: `1px solid ${colors.border}`,
                                                zIndex: 10,
                                                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                                                '&:hover': {
                                                  color: '#FFC107',
                                                  backgroundColor: isDarkMode ? 'rgba(255, 193, 7, 0.1)' : 'rgba(255, 193, 7, 0.05)',
                                                  borderColor: '#FFC107'
                                                },
                                                '&:disabled': {
                                                  color: colors.border,
                                                  opacity: 0.5
                                                }
                                              }}
                                            >
                                              <KeyboardArrowUp fontSize="small" />
                                            </IconButton>
                                          </Box>
                                        </Box>
                                      );
                                    }
                                  })}
                                  
                                  {route.orders.length > 0 && (
                                    <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
                                      <Button
                                        variant="outlined"
                                        startIcon={<Add />}
                                        onClick={() => {
                                          setSelectedRiderForStop(route.rider.id);
                                          setSelectedOrderIndexForStop(-1);
                                          setStopDialogOpen(true);
                                        }}
                                        sx={{
                                          borderColor: colors.accentText,
                                          color: colors.accentText,
                                          '&:hover': {
                                            borderColor: colors.accentText,
                                            backgroundColor: isDarkMode 
                                              ? 'rgba(0, 224, 184, 0.1)' 
                                              : 'rgba(0, 224, 184, 0.05)'
                                          }
                                        }}
                                      >
                                        Add Stop
                                      </Button>
                                    </Box>
                                  )}
                                </>
                              )}
                            </Box>
                          </CardContent>
                        </Card>
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Box>
          )}
        </Box>
      )}

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
          textAlign: 'center',
          pb: 2,
          borderBottom: `1px solid ${colors.border}`
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
            <AutoAwesome sx={{ fontSize: '2rem' }} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Optimizing Routes
            </Typography>
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



          </Container>
  );
};

export default Orders;
