import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Snackbar,
  Collapse,
  TablePagination,
  Checkbox,
  InputAdornment
} from '@mui/material';
import {
  Assessment,
  Download,
  AttachMoney,
  LocalShipping,
  LocalBar,
  Store,
  Refresh,
  Info,
  Add,
  ShoppingCart,
  Search,
  Clear
} from '@mui/icons-material';
import { useTheme } from '../../contexts/ThemeContext';
import { api } from '../../services/api';
import { useNavigate, useLocation } from 'react-router-dom';
import { useResupplyCart } from '../../contexts/ResupplyCartContext';

const Reports = () => {
  const { isDarkMode, colors } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { addToCart, cartItems } = useResupplyCart();
  const [dateRange, setDateRange] = useState('last30days');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });
  
  // Pagination state for each tab
  const [salesPage, setSalesPage] = useState(0);
  const [ridersPage, setRidersPage] = useState(0);
  const [drinksPage, setDrinksPage] = useState(0);
  const [suppliersPage, setSuppliersPage] = useState(0);
  const rowsPerPage = 10;
  
  // Sales data
  const [salesData, setSalesData] = useState({
    totalSales: 0,
    totalOrders: 0,
    averageOrder: 0,
    growthRate: 0
  });
  
  // Sales report table data
  const [salesReportData, setSalesReportData] = useState([]);

  // Riders data
  const [riders, setRiders] = useState([]);
  const [allRiders, setAllRiders] = useState([]); // Store all riders for filtering
  const [riderSearchTerm, setRiderSearchTerm] = useState('');
  const [selectedRiderIds, setSelectedRiderIds] = useState([]);
  const [viewSelectedOnly, setViewSelectedOnly] = useState(false); // Toggle between view all and view selected
  const [ridersStats, setRidersStats] = useState({
    totalOrders: 0,
    avgOrdersPerRider: 0,
    growthRate: 0,
    avgRiderEarnings: 0
  });
  
  // Drinks data
  const [drinks, setDrinks] = useState([]);
  const [allDrinks, setAllDrinks] = useState([]); // Store all drinks for filtering
  const [drinkSearchTerm, setDrinkSearchTerm] = useState('');
  
  // Suppliers data
  const [suppliers, setSuppliers] = useState([]);
  
  // Settlement dialog state
  const [settlementDialogOpen, setSettlementDialogOpen] = useState(false);
  const [selectedRider, setSelectedRider] = useState(null);
  const [settlementAmount, setSettlementAmount] = useState('');
  const [riderPin, setRiderPin] = useState('');
  const [settlementLoading, setSettlementLoading] = useState(false);
  const [settlementError, setSettlementError] = useState('');

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, activeTab, customStartDate, customEndDate, fetchData]);

  // Handle location state for tab navigation (e.g., from ResupplyCart)
  useEffect(() => {
    if (location.state?.tab !== undefined) {
      setActiveTab(location.state.tab);
      // Clear location state to prevent re-applying on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 0) {
        // Fetch sales data
        await fetchSalesData();
      } else if (activeTab === 1) {
        // Fetch riders data
        await fetchRidersData();
      } else if (activeTab === 2) {
        // Fetch drinks data
        await fetchDrinksData();
      } else if (activeTab === 3) {
        // Fetch suppliers data
        await fetchSuppliersData();
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDateRange = (range) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let startDate, endDate, previousStartDate, previousEndDate;
    
    // Handle custom date range
    if (range === 'custom' && customStartDate && customEndDate) {
      startDate = new Date(customStartDate);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(customEndDate);
      endDate.setHours(23, 59, 59, 999);
      
      // Calculate previous period (same duration)
      const duration = endDate.getTime() - startDate.getTime();
      previousEndDate = new Date(startDate);
      previousEndDate.setTime(previousEndDate.getTime() - 1);
      previousStartDate = new Date(previousEndDate);
      previousStartDate.setTime(previousStartDate.getTime() - duration);
    } else {
      switch (range) {
        case 'last7days':
          endDate = new Date(today);
          startDate = new Date(today);
          startDate.setDate(startDate.getDate() - 7);
          previousEndDate = new Date(startDate);
          previousStartDate = new Date(startDate);
          previousStartDate.setDate(previousStartDate.getDate() - 7);
          break;
        case 'last30days':
          endDate = new Date(today);
          startDate = new Date(today);
          startDate.setDate(startDate.getDate() - 30);
          previousEndDate = new Date(startDate);
          previousStartDate = new Date(startDate);
          previousStartDate.setDate(previousStartDate.getDate() - 30);
          break;
        case 'last90days':
          endDate = new Date(today);
          startDate = new Date(today);
          startDate.setDate(startDate.getDate() - 90);
          previousEndDate = new Date(startDate);
          previousStartDate = new Date(startDate);
          previousStartDate.setDate(previousStartDate.getDate() - 90);
          break;
        case 'thisMonth':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(today);
          previousStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          previousEndDate = new Date(now.getFullYear(), now.getMonth(), 0);
          break;
        case 'thisYear':
          startDate = new Date(now.getFullYear(), 0, 1);
          endDate = new Date(today);
          previousStartDate = new Date(now.getFullYear() - 1, 0, 1);
          previousEndDate = new Date(now.getFullYear() - 1, 11, 31);
          break;
        default:
          endDate = new Date(today);
          startDate = new Date(today);
          startDate.setDate(startDate.getDate() - 30);
          previousEndDate = new Date(startDate);
          previousStartDate = new Date(startDate);
          previousStartDate.setDate(previousStartDate.getDate() - 30);
      }
    }
    
    return { startDate, endDate, previousStartDate, previousEndDate };
  };

  const fetchSalesData = async () => {
    try {
      const response = await api.get('/admin/stats');
      if (response.data) {
        let totalSales = response.data.totalRevenue || 0;
        let totalOrders = response.data.totalOrders || 0;
        
        // Calculate average order value if not provided or if it's zero
        let averageOrder = response.data.averageOrderValue || 0;
        if (averageOrder === 0 && totalOrders > 0 && totalSales > 0) {
          averageOrder = totalSales / totalOrders;
        }
        
        // Fetch all orders for growth rate calculation and sales report table
        let allOrders = [];
        let growthRate = 0;
        
        try {
          const { startDate, endDate, previousStartDate, previousEndDate } = getDateRange(dateRange);
          
          // Fetch all orders and filter by date on the frontend
          const allOrdersResponse = await api.get('/admin/orders');
          allOrders = allOrdersResponse.data || [];
          
          // Filter current period orders
          const currentPeriodOrders = allOrders.filter(order => {
            const orderDate = new Date(order.createdAt);
            return orderDate >= startDate && orderDate <= endDate;
          });
          
          // Filter previous period orders
          const previousPeriodOrders = allOrders.filter(order => {
            const orderDate = new Date(order.createdAt);
            return orderDate >= previousStartDate && orderDate <= previousEndDate;
          });
          
          // Helper function to check if order is paid
          const isOrderPaid = (order) => {
            return order.paymentStatus === 'paid' || 
                   (order.transactions && Array.isArray(order.transactions) && 
                    order.transactions.some(t => 
                      t.transactionType === 'payment' && 
                      (t.status === 'completed' || t.paymentStatus === 'paid')
                    ));
          };
          
          // Calculate revenue for both periods (excluding tips)
          const currentRevenue = currentPeriodOrders.reduce((sum, order) => {
            if (isOrderPaid(order)) {
              const orderAmount = parseFloat(order.totalAmount) || 0;
              const tipAmount = parseFloat(order.tipAmount) || 0;
              return sum + (orderAmount - tipAmount);
            }
            return sum;
          }, 0);
          
          const previousRevenue = previousPeriodOrders.reduce((sum, order) => {
            if (isOrderPaid(order)) {
              const orderAmount = parseFloat(order.totalAmount) || 0;
              const tipAmount = parseFloat(order.tipAmount) || 0;
              return sum + (orderAmount - tipAmount);
            }
            return sum;
          }, 0);
          
          // Calculate growth rate
          if (previousRevenue > 0) {
            growthRate = ((currentRevenue - previousRevenue) / previousRevenue) * 100;
          } else if (currentRevenue > 0) {
            growthRate = 100; // 100% growth if no previous revenue
          }
          
          // Recalculate average order value using the same revenue calculation logic
          // Count only paid orders for accurate average
          const paidOrdersCount = currentPeriodOrders.filter(order => {
            const isPaid = isOrderPaid(order) || 
                          order.status === 'completed' || 
                          order.status === 'delivered' ||
                          (order.paymentType === 'pay_on_delivery' && parseFloat(order.totalAmount) > 0);
            return isPaid;
          }).length;
          
          if (paidOrdersCount > 0) {
            averageOrder = currentRevenue / paidOrdersCount;
          } else {
            averageOrder = 0;
          }
          
          // Update totalSales and totalOrders to match the calculated values
          totalSales = currentRevenue;
          totalOrders = paidOrdersCount;
        } catch (error) {
          console.error('Error calculating growth rate:', error);
          growthRate = 0;
        }
        
        setSalesData({
          totalSales,
          totalOrders,
          averageOrder: Math.round(averageOrder * 100) / 100, // Round to 2 decimal places
          growthRate: Math.round(growthRate * 100) / 100 // Round to 2 decimal places
        });
        
        // Generate sales report table data (grouped by date)
        if (allOrders.length > 0) {
          const { startDate, endDate } = getDateRange(dateRange);
          const reportOrders = allOrders.filter(order => {
            const orderDate = new Date(order.createdAt);
            return orderDate >= startDate && orderDate <= endDate;
          });
          
          // Group orders by date
          const ordersByDate = {};
          reportOrders.forEach(order => {
            const orderDate = new Date(order.createdAt);
            const dateKey = orderDate.toISOString().split('T')[0]; // YYYY-MM-DD
            
            if (!ordersByDate[dateKey]) {
              ordersByDate[dateKey] = {
                date: dateKey,
                orders: [],
                revenue: 0,
                orderCount: 0
              };
            }
            
            ordersByDate[dateKey].orders.push(order);
            
            // Calculate revenue for this order
            const orderAmount = parseFloat(order.totalAmount) || 0;
            const tipAmount = parseFloat(order.tipAmount) || 0;
            const revenue = orderAmount - tipAmount;
            
            // Check if order is paid - multiple ways to determine this
            const isPaid = order.paymentStatus === 'paid' || 
                          (order.transactions && Array.isArray(order.transactions) && 
                           order.transactions.some(t => 
                             t && t.transactionType === 'payment' && 
                             (t.status === 'completed' || t.paymentStatus === 'paid')
                           ));
            
            // Check if order is completed/delivered (indicates it was fulfilled and likely paid)
            const isCompleted = order.status === 'completed' || order.status === 'delivered';
            
            // Include revenue if:
            // 1. Order is explicitly marked as paid
            // 2. Order is completed/delivered (indicates payment was received)
            // 3. Order is pay_on_delivery and has totalAmount (will be paid on delivery)
            if (isPaid || isCompleted || (order.paymentType === 'pay_on_delivery' && orderAmount > 0)) {
              ordersByDate[dateKey].revenue += revenue;
            }
            
            ordersByDate[dateKey].orderCount += 1;
          });
          
          // Convert to array and sort by date (newest first)
          const reportDataArray = Object.values(ordersByDate)
            .map(item => {
              // Calculate average order value for this day
              const avgOrderValue = item.orderCount > 0 ? item.revenue / item.orderCount : 0;
              return {
                date: item.date,
                revenue: item.revenue,
                orders: item.orderCount,
                avgOrderValue: Math.round(avgOrderValue * 100) / 100 // Round to 2 decimal places
              };
            })
            .sort((a, b) => new Date(b.date) - new Date(a.date));
          
          // Calculate growth rate per day (comparing with previous day)
          const reportData = reportDataArray.map((item, index) => {
            let growthRate = 0;
            
            // Find previous day's data
            if (index < reportDataArray.length - 1) {
              const previousDay = reportDataArray[index + 1];
              const previousRevenue = previousDay.revenue || 0;
              const currentRevenue = item.revenue || 0;
              
              if (previousRevenue > 0) {
                growthRate = ((currentRevenue - previousRevenue) / previousRevenue) * 100;
              } else if (currentRevenue > 0) {
                growthRate = 100; // 100% growth if no previous revenue
              }
            }
            
            return {
              ...item,
              growthRate: Math.round(growthRate * 100) / 100 // Round to 2 decimal places
            };
          });
          
          setSalesReportData(reportData);
        } else {
          setSalesReportData([]);
        }
      }
    } catch (error) {
      console.error('Error fetching sales data:', error);
      setSalesReportData([]);
    }
  };

  // Filter riders based on search and view mode
  const applyRiderFilters = (ridersList, searchTerm, selectedIds, viewSelected) => {
    let filtered = [...ridersList];
    
    // Apply selection filter if viewing selected only
    if (viewSelected && selectedIds.length > 0) {
      filtered = filtered.filter(rider => selectedIds.includes(rider.id));
    }
    
    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(rider => 
        (rider.name && rider.name.toLowerCase().includes(searchLower)) ||
        (rider.phoneNumber && rider.phoneNumber.includes(searchTerm))
      );
    }
    
    setRiders(filtered);
  };

  const fetchRidersData = async () => {
    try {
      const response = await api.get('/drivers');
      if (response.data) {
        const { startDate, endDate, previousStartDate, previousEndDate } = getDateRange(dateRange);
        
        // Fetch all orders to calculate stats
        const allOrdersResponse = await api.get('/admin/orders');
        const allOrders = allOrdersResponse.data || [];
        
        // Filter orders for current and previous periods
        const currentPeriodOrders = allOrders.filter(order => {
          const orderDate = new Date(order.createdAt);
          return orderDate >= startDate && orderDate <= endDate;
        });
        
        const previousPeriodOrders = allOrders.filter(order => {
          const orderDate = new Date(order.createdAt);
          return orderDate >= previousStartDate && orderDate <= previousEndDate;
        });
        
        // For each driver, fetch their order stats and wallet balance
        const ridersWithStats = await Promise.all(
          response.data.map(async (driver) => {
            try {
              // Fetch all orders and filter to only those completed/delivered by this driver
              // Only count orders that were actually completed/delivered by this driver
              const driverCompletedOrders = allOrders.filter(
                o => o.driverId === driver.id && (o.status === 'completed' || o.status === 'delivered')
              );
              
              const completedOrders = driverCompletedOrders.length;
              const cancelledOrders = allOrders.filter(
                o => o.driverId === driver.id && o.status === 'cancelled'
              ).length;
              
              // Calculate current period orders for this driver (only completed/delivered)
              const currentPeriodDriverOrders = currentPeriodOrders.filter(
                o => o.driverId === driver.id && (o.status === 'completed' || o.status === 'delivered')
              ).length;
              
              // Calculate previous period orders for this driver (only completed/delivered)
              const previousPeriodDriverOrders = previousPeriodOrders.filter(
                o => o.driverId === driver.id && (o.status === 'completed' || o.status === 'delivered')
              ).length;
              
              // Calculate growth rate per rider
              let growthRate = 0;
              if (previousPeriodDriverOrders > 0) {
                growthRate = ((currentPeriodDriverOrders - previousPeriodDriverOrders) / previousPeriodDriverOrders) * 100;
              } else if (currentPeriodDriverOrders > 0) {
                growthRate = 100; // 100% growth if no previous period orders
              }
              
              // Fetch driver wallet to get actual balance owed
              let balanceOwed = 0;
              try {
                const walletResponse = await api.get(`/driver-wallet/${driver.id}`);
                if (walletResponse.data && walletResponse.data.success) {
                  // const wallet = walletResponse.data.wallet; // Unused
                  
                  // Get cash settlement transactions to calculate total settled
                  const cashSettlements = walletResponse.data.cashSettlements || [];
                  const totalSettled = cashSettlements.reduce((sum, settlement) => {
                    // Cash settlements are negative (driver pays business), so we take absolute value
                    return sum + Math.abs(parseFloat(settlement.amount) || 0);
                  }, 0);
                  
                  // Balance owed = driverPayAmount - totalSettled
                  // Using driverPayAmount from driver model as the total amount driver should have collected
                  balanceOwed = (driver.driverPayAmount || 0) - totalSettled;
                  
                  // Ensure balance owed is not negative
                  balanceOwed = Math.max(0, balanceOwed);
                } else {
                  // Fallback to driver model calculation if wallet fetch fails
                  balanceOwed = Math.max(0, (driver.driverPayAmount || 0) - (driver.driverPayCredited || 0));
                }
              } catch (walletError) {
                console.error(`Error fetching wallet for driver ${driver.id}:`, walletError);
                // Fallback to driver model calculation if wallet fetch fails
                balanceOwed = Math.max(0, (driver.driverPayAmount || 0) - (driver.driverPayCredited || 0));
              }
              
              return {
                ...driver,
                completedOrders,
                cancelledOrders,
                balanceOwed,
                currentPeriodOrders: currentPeriodDriverOrders,
                growthRate: Math.round(growthRate * 100) / 100 // Round to 2 decimal places
              };
            } catch (error) {
              console.error(`Error fetching stats for driver ${driver.id}:`, error);
              return {
                ...driver,
                completedOrders: 0,
                cancelledOrders: 0,
                balanceOwed: 0,
                currentPeriodOrders: 0,
                growthRate: 0
              };
            }
          })
        );
        
        // Sort riders by completed orders (highest to lowest)
        ridersWithStats.sort((a, b) => (b.completedOrders || 0) - (a.completedOrders || 0));
        
        setAllRiders(ridersWithStats);
        
        // Apply filters
        applyRiderFilters(ridersWithStats, riderSearchTerm, selectedRiderIds, viewSelectedOnly);
        
        // Calculate stats
        const totalOrders = ridersWithStats.reduce((sum, rider) => sum + (rider.currentPeriodOrders || 0), 0);
        const numRiders = ridersWithStats.length;
        const avgOrdersPerRider = numRiders > 0 ? totalOrders / numRiders : 0;
        
        // Calculate previous period avg orders per rider
        const previousPeriodDriverOrders = previousPeriodOrders.filter(
          o => o.driverId && (o.status === 'completed' || o.status === 'delivered')
        );
        const previousPeriodRiderCount = new Set(previousPeriodDriverOrders.map(o => o.driverId)).size;
        const previousPeriodTotalOrders = previousPeriodDriverOrders.length;
        const previousPeriodAvgOrdersPerRider = previousPeriodRiderCount > 0 
          ? previousPeriodTotalOrders / previousPeriodRiderCount 
          : 0;
        
        // Calculate growth rate
        let growthRate = 0;
        if (previousPeriodAvgOrdersPerRider > 0) {
          growthRate = ((avgOrdersPerRider - previousPeriodAvgOrdersPerRider) / previousPeriodAvgOrdersPerRider) * 100;
        } else if (avgOrdersPerRider > 0) {
          growthRate = 100; // 100% growth if no previous period data
        }
        
        // Calculate average rider earnings (driverPayAmount)
        const totalEarnings = ridersWithStats.reduce((sum, rider) => sum + (parseFloat(rider.driverPayAmount) || 0), 0);
        const avgRiderEarnings = numRiders > 0 ? totalEarnings / numRiders : 0;
        
        setRidersStats({
          totalOrders,
          avgOrdersPerRider: Math.round(avgOrdersPerRider * 100) / 100,
          growthRate: Math.round(growthRate * 100) / 100,
          avgRiderEarnings: Math.round(avgRiderEarnings * 100) / 100
        });
      }
    } catch (error) {
      console.error('Error fetching riders data:', error);
    }
  };

  const fetchDrinksData = async () => {
    try {
      // Fetch drinks and orders in parallel
      const [drinksResponse, ordersResponse, suppliersResponse] = await Promise.all([
        api.get('/admin/drinks'),
        api.get('/admin/orders'),
        api.get('/suppliers')
      ]);

      const drinks = drinksResponse.data || [];
      const allOrders = ordersResponse.data || [];
      const suppliers = suppliersResponse.data || [];

      // Create a map of supplier IDs to names for quick lookup
      const supplierMap = {};
      suppliers.forEach(supplier => {
        supplierMap[supplier.id] = supplier.name;
      });

      // Count purchases for all drinks at once
      const purchaseCountMap = {};
      allOrders.forEach(order => {
        const items = order.items || order.orderItems || [];
        items.forEach(item => {
          const drinkId = item.drinkId || (item.drink && item.drink.id);
          if (drinkId) {
            purchaseCountMap[drinkId] = (purchaseCountMap[drinkId] || 0) + (item.quantity || 0);
          }
        });
      });

      // Map drinks with stats
      const drinksWithStats = drinks.map(drink => ({
        ...drink,
        purchaseCount: purchaseCountMap[drink.id] || 0,
        supplierName: drink.supplierId ? (supplierMap[drink.supplierId] || 'N/A') : 'N/A',
        supplier: drink.supplierId ? (supplierMap[drink.supplierId] || 'N/A') : 'N/A'
      }));

      setAllDrinks(drinksWithStats);
      
      // Apply filters
      applyDrinkFilters(drinksWithStats, drinkSearchTerm);
    } catch (error) {
      console.error('Error fetching drinks data:', error);
      setDrinks([]);
    }
  };

  const fetchSuppliersData = async () => {
    try {
      const response = await api.get('/suppliers');
      if (response.data) {
        // For each supplier, calculate stats
        const suppliersWithStats = response.data.map(supplier => ({
          ...supplier,
          balanceOwed: supplier.balanceOwed || 0,
          purchaseCount: supplier.purchaseCount || 0,
          totalStockPurchased: supplier.totalStockPurchased || 0
        }));
        setSuppliers(suppliersWithStats);
      }
    } catch (error) {
      console.error('Error fetching suppliers data:', error);
    }
  };


  const handleAddToResupplyCart = (drink) => {
    addToCart(drink);
    // Show snackbar notification that item was added
    setSnackbar({ open: true, message: `${drink.name} added to Resupply Cart!` });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ open: false, message: '' });
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    // Reset pagination when switching tabs
    setSalesPage(0);
    setRidersPage(0);
    setDrinksPage(0);
    setSuppliersPage(0);
    // Clear rider filters when switching away from riders tab
    if (newValue !== 1) {
      setRiderSearchTerm('');
      setSelectedRiderIds([]);
      setViewSelectedOnly(false);
    }
    // Clear drink filters when switching away from drinks tab
    if (newValue !== 2) {
      setDrinkSearchTerm('');
    }
  };

  const handleRiderSearchChange = (event) => {
    const searchTerm = event.target.value;
    setRiderSearchTerm(searchTerm);
    applyRiderFilters(allRiders, searchTerm, selectedRiderIds, viewSelectedOnly);
    setRidersPage(0); // Reset to first page when searching
  };

  const handleRiderSelect = (riderId) => {
    setSelectedRiderIds(prev => {
      const newSelection = prev.includes(riderId)
        ? prev.filter(id => id !== riderId)
        : [...prev, riderId];
      applyRiderFilters(allRiders, riderSearchTerm, newSelection, viewSelectedOnly);
      setRidersPage(0); // Reset to first page when selecting
      return newSelection;
    });
  };

  const handleSelectAllRiders = () => {
    if (selectedRiderIds.length === riders.length && riders.length > 0) {
      // Deselect all
      setSelectedRiderIds([]);
      applyRiderFilters(allRiders, riderSearchTerm, [], viewSelectedOnly);
    } else {
      // Select all visible riders
      const allVisibleIds = riders.map(r => r.id);
      setSelectedRiderIds(allVisibleIds);
      applyRiderFilters(allRiders, riderSearchTerm, allVisibleIds, viewSelectedOnly);
    }
    setRidersPage(0);
  };

  const handleClearRiderSelection = () => {
    setSelectedRiderIds([]);
    setRiderSearchTerm('');
    setViewSelectedOnly(false);
    applyRiderFilters(allRiders, '', [], false);
    setRidersPage(0);
  };

  const handleToggleViewMode = () => {
    const newViewMode = !viewSelectedOnly;
    setViewSelectedOnly(newViewMode);
    applyRiderFilters(allRiders, riderSearchTerm, selectedRiderIds, newViewMode);
    setRidersPage(0);
  };

  // Filter drinks based on search
  const applyDrinkFilters = (drinksList, searchTerm) => {
    let filtered = [...drinksList];
    
    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(drink => {
        const nameMatch = drink.name && typeof drink.name === 'string' && drink.name.toLowerCase().includes(searchLower);
        const categoryMatch = drink.category && typeof drink.category === 'string' && drink.category.toLowerCase().includes(searchLower);
        const brandMatch = drink.brand && typeof drink.brand === 'string' && drink.brand.toLowerCase().includes(searchLower);
        return nameMatch || categoryMatch || brandMatch;
      });
    }
    
    setDrinks(filtered);
  };

  const handleDrinkSearchChange = (event) => {
    const searchTerm = event.target.value;
    setDrinkSearchTerm(searchTerm);
    applyDrinkFilters(allDrinks, searchTerm);
    setDrinksPage(0); // Reset to first page when searching
  };

  const handleRefresh = () => {
    // Clear custom date pickers when refreshing
    if (dateRange === 'custom') {
      setCustomStartDate('');
      setCustomEndDate('');
      setDateRange('last30days');
    }
    fetchData();
  };

  const formatCurrency = (amount) => {
    return `KES ${Number(amount || 0).toFixed(2)}`;
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600, color: colors.textPrimary }}>
          Reports
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'nowrap', ml: 'auto' }}>
          <FormControl 
            size="small" 
            sx={{ 
              minWidth: 150,
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            <InputLabel>Date Range</InputLabel>
            <Select
              value={dateRange}
              label="Date Range"
              onChange={(e) => setDateRange(e.target.value)}
            >
              <MenuItem value="last7days">Last 7 Days</MenuItem>
              <MenuItem value="last30days">Last 30 Days</MenuItem>
              <MenuItem value="last90days">Last 90 Days</MenuItem>
              <MenuItem value="thisMonth">This Month</MenuItem>
              <MenuItem value="thisYear">This Year</MenuItem>
              <MenuItem value="custom">Custom Range</MenuItem>
            </Select>
          </FormControl>
          <Collapse 
            in={dateRange === 'custom'} 
            orientation="horizontal"
            sx={{
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              '& .MuiCollapse-wrapper': {
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
              }
            }}
          >
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <TextField
                type="date"
                label="From"
                size="small"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 150 }}
              />
              <TextField
                type="date"
                label="To"
                size="small"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 150 }}
              />
            </Box>
          </Collapse>
          <Button
            variant="contained"
            startIcon={<Download />}
            sx={{
              backgroundColor: colors.accentText,
              color: isDarkMode ? '#000' : '#fff',
              '&:hover': {
                backgroundColor: colors.accent
              }
            }}
          >
            Export
          </Button>
            <Tooltip title="Refresh Data">
              <IconButton
                onClick={handleRefresh}
                sx={{ color: colors.textPrimary }}
              >
                <Refresh />
              </IconButton>
            </Tooltip>
        </Box>
      </Box>

      {/* Secondary Tabs */}
      <Paper sx={{ mb: 3, backgroundColor: colors.paper }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          sx={{
            borderBottom: `1px solid ${colors.border}`,
            '& .MuiTab-root': {
              textTransform: 'none',
              fontSize: '0.9rem',
              fontWeight: 500,
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
          <Tab icon={<AttachMoney />} iconPosition="start" label="Sales" />
          <Tab icon={<LocalShipping />} iconPosition="start" label="Riders" />
          <Tab icon={<LocalBar />} iconPosition="start" label="Drinks" />
          <Tab icon={<Store />} iconPosition="start" label="Suppliers" />
        </Tabs>
      </Paper>

      {/* Sales Tab */}
      {activeTab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={3}>
            <Card sx={{ backgroundColor: colors.paper }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <AttachMoney sx={{ color: colors.accentText, mr: 1 }} />
                  <Typography variant="h6" sx={{ color: colors.textPrimary }}>
                    Total Sales
                  </Typography>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 700, color: colors.accentText, mb: 1 }}>
                  {formatCurrency(salesData.totalSales)}
                </Typography>
                <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                  {dateRange} period
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card sx={{ backgroundColor: colors.paper }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Assessment sx={{ color: colors.accentText, mr: 1 }} />
                  <Typography variant="h6" sx={{ color: colors.textPrimary }}>
                    Total Orders
                  </Typography>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 700, color: colors.accentText, mb: 1 }}>
                  {salesData.totalOrders}
                </Typography>
                <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                  {dateRange} period
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card sx={{ backgroundColor: colors.paper }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Assessment sx={{ color: colors.accentText, mr: 1 }} />
                    <Typography variant="h6" sx={{ color: colors.textPrimary }}>
                      Average Order
                    </Typography>
                  </Box>
                  <Tooltip
                    title="Average Order Value is calculated by dividing total sales revenue by the total number of orders. It represents the average amount customers spend per order."
                    arrow
                  >
                    <IconButton size="small" sx={{ color: colors.textSecondary }}>
                      <Info fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 700, color: colors.accentText, mb: 1 }}>
                  {formatCurrency(salesData.averageOrder)}
                </Typography>
                <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                  {dateRange} period
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card sx={{ backgroundColor: colors.paper }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Assessment sx={{ color: colors.accentText, mr: 1 }} />
                    <Typography variant="h6" sx={{ color: colors.textPrimary }}>
                      Growth Rate
                    </Typography>
                  </Box>
                  <Tooltip
                    title="Growth Rate compares current period sales with the previous equivalent period. Positive values indicate growth, negative values indicate decline. Calculated as: ((Current Period - Previous Period) / Previous Period) × 100%"
                    arrow
                  >
                    <IconButton size="small" sx={{ color: colors.textSecondary }}>
                      <Info fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
                <Typography 
                  variant="h4" 
                  sx={{ 
                    fontWeight: 700, 
                    color: salesData.growthRate >= 0 ? colors.accentText : colors.error, 
                    mb: 1 
                  }}
                >
                  {salesData.growthRate >= 0 ? '+' : ''}{salesData.growthRate}%
                </Typography>
                <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                  {dateRange} period
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sx={{ 
            width: '100%', 
            pl: '0 !important', 
            pr: '0 !important', 
            ml: '-24px !important', 
            mr: '-24px !important', 
            maxWidth: 'calc(100% + 48px) !important' 
          }}>
            <Paper sx={{ backgroundColor: colors.paper, p: 3, width: '100%', boxSizing: 'border-box' }}>
              <Typography variant="h6" sx={{ mb: 2, color: colors.textPrimary }}>
                Sales Report Data
              </Typography>
              <TableContainer sx={{ width: '100%', overflowX: 'auto' }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Date</TableCell>
                      <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Revenue</TableCell>
                      <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Orders</TableCell>
                      <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Avg Order Value</TableCell>
                      <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          Growth Rate
                          <Tooltip
                            title="Growth Rate compares each day's revenue with the previous day's revenue. Positive values indicate growth, negative values indicate decline. Calculated as: ((Current Day - Previous Day) / Previous Day) × 100%"
                            arrow
                          >
                            <IconButton size="small" sx={{ color: colors.textSecondary, p: 0.5 }}>
                              <Info fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Details</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} sx={{ textAlign: 'center', py: 4, color: colors.textSecondary }}>
                          Loading sales data...
                        </TableCell>
                      </TableRow>
                    ) : salesReportData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} sx={{ textAlign: 'center', py: 4, color: colors.textSecondary }}>
                          No sales data available for the selected period
                        </TableCell>
                      </TableRow>
                    ) : (
                      salesReportData
                        .slice(salesPage * rowsPerPage, salesPage * rowsPerPage + rowsPerPage)
                        .map((row, index) => (
                        <TableRow key={index} hover>
                          <TableCell sx={{ color: colors.textPrimary }}>
                            {new Date(row.date).toLocaleDateString('en-US', { 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric' 
                            })}
                          </TableCell>
                          <TableCell sx={{ color: colors.textPrimary, fontWeight: 600 }}>
                            {formatCurrency(row.revenue)}
                          </TableCell>
                          <TableCell sx={{ color: colors.textPrimary }}>
                            {row.orders}
                          </TableCell>
                          <TableCell sx={{ color: colors.textPrimary, fontWeight: 600 }}>
                            {formatCurrency(row.avgOrderValue || 0)}
                          </TableCell>
                          <TableCell>
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 600,
                                color: (row.growthRate || 0) >= 0 ? colors.accentText : colors.error
                              }}
                            >
                              {(row.growthRate || 0) >= 0 ? '+' : ''}{row.growthRate || 0}%
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outlined"
                              size="small"
                              onClick={() => navigate(`/copilot/reports/date/${row.date}`)}
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
                              View Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                <TablePagination
                  component="div"
                  count={salesReportData.length}
                  page={salesPage}
                  onPageChange={(event, newPage) => setSalesPage(newPage)}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={() => {}} // Keep rowsPerPage fixed at 10
                  rowsPerPageOptions={[]}
                  labelRowsPerPage=""
                  sx={{
                    borderTop: `1px solid ${colors.border}`,
                    '& .MuiTablePagination-toolbar': {
                      color: colors.textPrimary,
                    },
                    '& .MuiTablePagination-selectLabel': {
                      color: colors.textPrimary,
                    },
                    '& .MuiTablePagination-displayedRows': {
                      color: colors.textPrimary,
                    },
                    '& .MuiTablePagination-select': {
                      color: colors.textPrimary,
                    },
                    '& .MuiTablePagination-selectIcon': {
                      color: colors.textPrimary,
                    },
                    '& .MuiIconButton-root': {
                      color: colors.textPrimary,
                      '&:disabled': {
                        color: colors.textSecondary,
                      },
                    },
                  }}
                />
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Riders Tab */}
      {activeTab === 1 && (
        <Grid container spacing={3}>
          {/* Stats Cards */}
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ backgroundColor: colors.paper }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <LocalShipping sx={{ color: colors.accentText, mr: 1 }} />
                  <Typography variant="h6" sx={{ color: colors.textPrimary }}>
                    Total Orders
                  </Typography>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 700, color: colors.textPrimary, mb: 1 }}>
                  {ridersStats.totalOrders}
                </Typography>
                <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                  {dateRange} period
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ backgroundColor: colors.paper }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Assessment sx={{ color: colors.accentText, mr: 1 }} />
                    <Typography variant="h6" sx={{ color: colors.textPrimary }}>
                      Avg Orders/Rider
                    </Typography>
                  </Box>
                  <Tooltip
                    title="Average number of completed orders per rider in the selected period"
                    arrow
                  >
                    <IconButton size="small" sx={{ color: colors.textSecondary }}>
                      <Info fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 700, color: colors.textPrimary, mb: 1 }}>
                  {(ridersStats.avgOrdersPerRider || 0).toFixed(2)}
                </Typography>
                <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                  {dateRange} period
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ backgroundColor: colors.paper }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Assessment sx={{ color: colors.accentText, mr: 1 }} />
                    <Typography variant="h6" sx={{ color: colors.textPrimary }}>
                      Growth Rate
                    </Typography>
                  </Box>
                  <Tooltip
                    title="Growth Rate compares current period average orders per rider with the previous equivalent period. Positive values indicate growth, negative values indicate decline."
                    arrow
                  >
                    <IconButton size="small" sx={{ color: colors.textSecondary }}>
                      <Info fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
                <Typography 
                  variant="h4" 
                  sx={{ 
                    fontWeight: 700, 
                    color: ridersStats.growthRate >= 0 ? colors.accentText : colors.error, 
                    mb: 1 
                  }}
                >
                  {ridersStats.growthRate >= 0 ? '+' : ''}{ridersStats.growthRate}%
                </Typography>
                <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                  {dateRange} period
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ backgroundColor: colors.paper }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <AttachMoney sx={{ color: colors.accentText, mr: 1 }} />
                    <Typography variant="h6" sx={{ color: colors.textPrimary }}>
                      Avg Rider Earnings
                    </Typography>
                  </Box>
                  <Tooltip
                    title="Average total earnings (driverPayAmount) across all riders"
                    arrow
                  >
                    <IconButton size="small" sx={{ color: colors.textSecondary }}>
                      <Info fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 700, color: colors.textPrimary, mb: 1 }}>
                  {formatCurrency(ridersStats.avgRiderEarnings)}
                </Typography>
                <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                  All time average
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Paper sx={{ backgroundColor: colors.paper, p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
                <Typography variant="h6" sx={{ color: colors.textPrimary }}>
                  Riders Report
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                  <TextField
                    size="small"
                    placeholder="Search riders..."
                    value={riderSearchTerm}
                    onChange={handleRiderSearchChange}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Search sx={{ color: colors.textSecondary }} />
                        </InputAdornment>
                      ),
                      endAdornment: riderSearchTerm && (
                        <InputAdornment position="end">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setRiderSearchTerm('');
                              applyRiderFilters(allRiders, '', selectedRiderIds, viewSelectedOnly);
                            }}
                            sx={{ color: colors.textSecondary }}
                          >
                            <Clear fontSize="small" />
                          </IconButton>
                        </InputAdornment>
                      )
                    }}
                    sx={{
                      minWidth: 250,
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: colors.background,
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
                      '& .MuiInputBase-input': {
                        color: colors.textPrimary,
                      },
                    }}
                  />
                  {selectedRiderIds.length > 0 && (
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Chip
                        label={`${selectedRiderIds.length} selected`}
                        onClick={handleToggleViewMode}
                        onDelete={handleClearRiderSelection}
                        deleteIcon={<Clear />}
                        sx={{
                          backgroundColor: viewSelectedOnly ? colors.accentText : colors.background,
                          color: viewSelectedOnly ? (isDarkMode ? '#000' : '#fff') : colors.textPrimary,
                          border: `1px solid ${colors.accentText}`,
                          cursor: 'pointer',
                          '&:hover': {
                            backgroundColor: viewSelectedOnly ? colors.accentText : colors.accentText + '20',
                          },
                          '& .MuiChip-deleteIcon': {
                            color: viewSelectedOnly ? (isDarkMode ? '#000' : '#fff') : colors.textPrimary,
                            '&:hover': {
                              color: colors.error,
                            },
                          },
                        }}
                      />
                      {viewSelectedOnly && (
                        <Typography variant="body2" sx={{ color: colors.textSecondary, fontStyle: 'italic' }}>
                          Showing selected only
                        </Typography>
                      )}
                    </Box>
                  )}
                </Box>
              </Box>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        indeterminate={selectedRiderIds.length > 0 && selectedRiderIds.length < riders.length}
                        checked={riders.length > 0 && selectedRiderIds.length === riders.length}
                        onChange={handleSelectAllRiders}
                        sx={{
                          color: colors.accentText,
                          '&.Mui-checked': {
                            color: colors.accentText,
                          },
                          '&.MuiCheckbox-indeterminate': {
                            color: colors.accentText,
                          },
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Rider Name</TableCell>
                    <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Phone</TableCell>
                    <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Orders Completed</TableCell>
                    <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Orders Cancelled</TableCell>
                    <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Balance Owed</TableCell>
                    <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        Growth Rate
                        <Tooltip
                          title="Growth Rate compares current period completed orders with the previous equivalent period for each rider. Positive values indicate growth, negative values indicate decline. Calculated as: ((Current Period - Previous Period) / Previous Period) × 100%"
                          arrow
                        >
                          <IconButton size="small" sx={{ color: colors.textSecondary, p: 0.5 }}>
                            <Info fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} sx={{ textAlign: 'center', py: 4 }}>
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : riders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} sx={{ textAlign: 'center', py: 4, color: colors.textSecondary }}>
                        {riderSearchTerm 
                          ? 'No riders match your search criteria' 
                          : viewSelectedOnly && selectedRiderIds.length > 0
                          ? 'No selected riders match your search criteria'
                          : 'No riders data available'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    riders
                      .slice(ridersPage * rowsPerPage, ridersPage * rowsPerPage + rowsPerPage)
                      .map((rider) => (
                      <TableRow key={rider.id}>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedRiderIds.includes(rider.id)}
                            onChange={() => handleRiderSelect(rider.id)}
                            sx={{
                              color: colors.accentText,
                              '&.Mui-checked': {
                                color: colors.accentText,
                              },
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ color: colors.textPrimary }}>{rider.name}</TableCell>
                        <TableCell sx={{ color: colors.textPrimary }}>{rider.phoneNumber}</TableCell>
                        <TableCell sx={{ color: colors.textPrimary }}>{rider.completedOrders || 0}</TableCell>
                        <TableCell sx={{ color: colors.textPrimary }}>{rider.cancelledOrders || 0}</TableCell>
                        <TableCell sx={{ color: colors.textPrimary, fontWeight: 600 }}>
                          {formatCurrency(rider.balanceOwed || 0)}
                        </TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 600,
                              color: (rider.growthRate || 0) >= 0 ? colors.accentText : colors.error
                            }}
                          >
                            {(rider.growthRate || 0) >= 0 ? '+' : ''}{rider.growthRate || 0}%
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                              variant="outlined"
                              size="small"
                              onClick={() => navigate(`/copilot/reports/rider/${rider.id}`)}
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
                              View Details
                            </Button>
                            {(rider.balanceOwed || 0) > 0 && (
                              <Button
                                variant="outlined"
                                size="small"
                                onClick={() => {
                                  setSelectedRider(rider);
                                  setSettlementAmount((rider.balanceOwed || 0).toFixed(2));
                                  setRiderPin('');
                                  setSettlementError('');
                                  setSettlementDialogOpen(true);
                                }}
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
                                Settle
                              </Button>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <TablePagination
                component="div"
                count={riders.length}
                page={ridersPage}
                onPageChange={(event, newPage) => setRidersPage(newPage)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={() => {}} // Keep rowsPerPage fixed at 10
                rowsPerPageOptions={[]}
                labelRowsPerPage=""
                sx={{
                  borderTop: `1px solid ${colors.border}`,
                  '& .MuiTablePagination-toolbar': {
                    color: colors.textPrimary,
                  },
                  '& .MuiTablePagination-selectLabel': {
                    color: colors.textPrimary,
                  },
                  '& .MuiTablePagination-displayedRows': {
                    color: colors.textPrimary,
                  },
                  '& .MuiTablePagination-select': {
                    color: colors.textPrimary,
                  },
                  '& .MuiTablePagination-selectIcon': {
                    color: colors.textPrimary,
                  },
                  '& .MuiIconButton-root': {
                    color: colors.textPrimary,
                    '&:disabled': {
                      color: colors.textSecondary,
                    },
                  },
                }}
              />
            </TableContainer>
          </Paper>
          </Grid>
        </Grid>
      )}

      {/* Drinks Tab */}
      {activeTab === 2 && (
        <Box>
          <Paper sx={{ backgroundColor: colors.paper, p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
              <Typography variant="h6" sx={{ color: colors.textPrimary }}>
                Drinks Report
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                <TextField
                  size="small"
                  placeholder="Search drinks..."
                  value={drinkSearchTerm}
                  onChange={handleDrinkSearchChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search sx={{ color: colors.textSecondary }} />
                      </InputAdornment>
                    ),
                    endAdornment: drinkSearchTerm && (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setDrinkSearchTerm('');
                            applyDrinkFilters(allDrinks, '');
                          }}
                          sx={{ color: colors.textSecondary }}
                        >
                          <Clear fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                  sx={{
                    minWidth: 250,
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: colors.background,
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
                    '& .MuiInputBase-input': {
                      color: colors.textPrimary,
                    },
                  }}
                />
                {cartItems.length > 0 && (
                  <Button
                    variant="outlined"
                    startIcon={<ShoppingCart />}
                    onClick={() => navigate('/resupply-cart', { state: { tab: 2 } })}
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
                    Resupply Cart ({cartItems.length})
                  </Button>
                )}
              </Box>
            </Box>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Drink Name</TableCell>
                    <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}># of Purchases</TableCell>
                    <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Stock Level</TableCell>
                    <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={4} sx={{ textAlign: 'center', py: 4 }}>
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : drinks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} sx={{ textAlign: 'center', py: 4, color: colors.textSecondary }}>
                        {drinkSearchTerm 
                          ? 'No drinks match your search criteria' 
                          : 'No drinks data available'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    drinks
                      .slice(drinksPage * rowsPerPage, drinksPage * rowsPerPage + rowsPerPage)
                      .map((drink) => (
                      <TableRow key={drink.id}>
                        <TableCell sx={{ color: colors.textPrimary }}>{drink.name}</TableCell>
                        <TableCell sx={{ color: colors.textPrimary }}>{drink.purchaseCount || 0}</TableCell>
                        <TableCell>
                          <Chip
                            label={drink.stock || 0}
                            size="small"
                            sx={{
                              backgroundColor: (drink.stock || 0) > 0 
                                ? 'rgba(0, 224, 184, 0.2)' 
                                : 'rgba(255, 51, 102, 0.2)',
                              color: (drink.stock || 0) > 0 
                                ? colors.accentText 
                                : colors.error
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Tooltip title="Add to Resupply Cart">
                            <IconButton
                              size="small"
                              onClick={() => handleAddToResupplyCart(drink)}
                              sx={{
                                color: colors.accentText,
                                '&:hover': {
                                  backgroundColor: 'rgba(0, 224, 184, 0.1)'
                                }
                              }}
                            >
                              <Add />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <TablePagination
                component="div"
                count={drinks.length}
                page={drinksPage}
                onPageChange={(event, newPage) => setDrinksPage(newPage)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={() => {}} // Keep rowsPerPage fixed at 10
                rowsPerPageOptions={[]}
                labelRowsPerPage=""
                sx={{
                  borderTop: `1px solid ${colors.border}`,
                  '& .MuiTablePagination-toolbar': {
                    color: colors.textPrimary,
                  },
                  '& .MuiTablePagination-selectLabel': {
                    color: colors.textPrimary,
                  },
                  '& .MuiTablePagination-displayedRows': {
                    color: colors.textPrimary,
                  },
                  '& .MuiTablePagination-select': {
                    color: colors.textPrimary,
                  },
                  '& .MuiTablePagination-selectIcon': {
                    color: colors.textPrimary,
                  },
                  '& .MuiIconButton-root': {
                    color: colors.textPrimary,
                    '&:disabled': {
                      color: colors.textSecondary,
                    },
                  },
                }}
              />
            </TableContainer>
          </Paper>
        </Box>
      )}

      {/* Suppliers Tab */}
      {activeTab === 3 && (
        <Box>
          <Paper sx={{ backgroundColor: colors.paper, p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2, color: colors.textPrimary }}>
              Suppliers Report
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Supplier Name</TableCell>
                    <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Contact</TableCell>
                    <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Balance Owed</TableCell>
                    <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}># of Purchases</TableCell>
                    <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Total Stock Purchased</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} sx={{ textAlign: 'center', py: 4 }}>
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : suppliers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} sx={{ textAlign: 'center', py: 4, color: colors.textSecondary }}>
                        No suppliers data available
                      </TableCell>
                    </TableRow>
                  ) : (
                    suppliers
                      .slice(suppliersPage * rowsPerPage, suppliersPage * rowsPerPage + rowsPerPage)
                      .map((supplier) => (
                      <TableRow key={supplier.id}>
                        <TableCell sx={{ color: colors.textPrimary }}>{supplier.name}</TableCell>
                        <TableCell sx={{ color: colors.textPrimary }}>{supplier.contact || 'N/A'}</TableCell>
                        <TableCell sx={{ color: colors.textPrimary, fontWeight: 600 }}>
                          {formatCurrency(supplier.balanceOwed || 0)}
                        </TableCell>
                        <TableCell sx={{ color: colors.textPrimary }}>{supplier.purchaseCount || 0}</TableCell>
                        <TableCell sx={{ color: colors.textPrimary }}>{supplier.totalStockPurchased || 0}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <TablePagination
                component="div"
                count={suppliers.length}
                page={suppliersPage}
                onPageChange={(event, newPage) => setSuppliersPage(newPage)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={() => {}} // Keep rowsPerPage fixed at 10
                rowsPerPageOptions={[]}
                labelRowsPerPage=""
                sx={{
                  borderTop: `1px solid ${colors.border}`,
                  '& .MuiTablePagination-toolbar': {
                    color: colors.textPrimary,
                  },
                  '& .MuiTablePagination-selectLabel': {
                    color: colors.textPrimary,
                  },
                  '& .MuiTablePagination-displayedRows': {
                    color: colors.textPrimary,
                  },
                  '& .MuiTablePagination-select': {
                    color: colors.textPrimary,
                  },
                  '& .MuiTablePagination-selectIcon': {
                    color: colors.textPrimary,
                  },
                  '& .MuiIconButton-root': {
                    color: colors.textPrimary,
                    '&:disabled': {
                      color: colors.textSecondary,
                    },
                  },
                }}
              />
            </TableContainer>
          </Paper>
        </Box>
      )}


      {/* Settlement Dialog */}
      <Dialog
        open={settlementDialogOpen}
        onClose={() => {
          if (!settlementLoading) {
            setSettlementDialogOpen(false);
            setSelectedRider(null);
            setSettlementAmount('');
            setRiderPin('');
            setSettlementError('');
          }
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: colors.textPrimary }}>
          Settle Balance - {selectedRider?.name}
        </DialogTitle>
        <DialogContent>
          {settlementError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSettlementError('')}>
              {settlementError}
            </Alert>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Typography variant="body2" sx={{ color: colors.textSecondary }}>
              Balance Owed: <strong sx={{ color: colors.textPrimary }}>{formatCurrency(selectedRider?.balanceOwed || 0)}</strong>
            </Typography>
            <TextField
              label="Settlement Amount (KES)"
              type="number"
              value={settlementAmount}
              onChange={(e) => {
                const value = e.target.value;
                const maxAmount = selectedRider?.balanceOwed || 0;
                const numValue = parseFloat(value);
                
                // Allow empty input
                if (value === '') {
                  setSettlementAmount('');
                  return;
                }
                
                // Don't allow more than balance owed
                if (!isNaN(numValue) && numValue <= maxAmount && numValue >= 0) {
                  setSettlementAmount(value);
                }
              }}
              inputProps={{
                min: 0,
                max: selectedRider?.balanceOwed || 0,
                step: 0.01
              }}
              helperText={`Maximum: ${formatCurrency(selectedRider?.balanceOwed || 0)}`}
              fullWidth
              required
              disabled={settlementLoading}
            />
            <TextField
              label="Rider PIN"
              type="password"
              value={riderPin}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                setRiderPin(value);
              }}
              inputProps={{
                maxLength: 4,
                pattern: '[0-9]*'
              }}
              helperText="Enter 4-digit PIN"
              fullWidth
              required
              disabled={settlementLoading}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setSettlementDialogOpen(false);
              setSelectedRider(null);
              setSettlementAmount('');
              setRiderPin('');
              setSettlementError('');
            }}
            disabled={settlementLoading}
            sx={{ color: colors.textSecondary }}
          >
            Cancel
          </Button>
          <Button
            onClick={async () => {
              if (!selectedRider) return;
              
              const amount = parseFloat(settlementAmount);
              if (isNaN(amount) || amount <= 0) {
                setSettlementError('Please enter a valid amount');
                return;
              }
              
              if (amount > (selectedRider.balanceOwed || 0)) {
                setSettlementError('Amount cannot exceed balance owed');
                return;
              }
              
              if (!riderPin || riderPin.length !== 4) {
                setSettlementError('Please enter a valid 4-digit PIN');
                return;
              }
              
              setSettlementLoading(true);
              setSettlementError('');
              
              try {
                const response = await api.post(`/admin/drivers/${selectedRider.id}/settle-balance`, {
                  amount: amount,
                  pin: riderPin
                });
                
                if (response.data.success) {
                  // Refresh riders data
                  await fetchRidersData();
                  
                  // Close dialog
                  setSettlementDialogOpen(false);
                  setSelectedRider(null);
                  setSettlementAmount('');
                  setRiderPin('');
                  setSettlementError('');
                  
                  // Show success message (you might want to use a snackbar here)
                  alert(`Balance settlement of ${formatCurrency(amount)} processed successfully!`);
                }
              } catch (error) {
                console.error('Error settling balance:', error);
                setSettlementError(error.response?.data?.error || 'Failed to process settlement. Please try again.');
              } finally {
                setSettlementLoading(false);
              }
            }}
            variant="contained"
            disabled={settlementLoading || !settlementAmount || !riderPin || riderPin.length !== 4}
            sx={{
              backgroundColor: colors.accentText,
              color: isDarkMode ? '#000' : '#fff',
              '&:hover': {
                backgroundColor: colors.accent
              }
            }}
          >
            {settlementLoading ? 'Processing...' : 'Settle Balance'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{
          '& .MuiSnackbarContent-root': {
            backgroundColor: colors.accentText,
            color: isDarkMode ? '#000' : '#fff'
          }
        }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity="success" 
          sx={{ 
            width: '100%',
            backgroundColor: colors.accentText,
            color: isDarkMode ? '#000' : '#fff',
            '& .MuiAlert-icon': {
              color: isDarkMode ? '#000' : '#fff'
            }
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Reports;
