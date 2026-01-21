import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Button,
  Select,
  MenuItem,
  FormControl,
  IconButton,
  Alert,
  Chip
} from '@mui/material';
import {
  Delete,
  ShoppingCart,
  Send,
  ArrowBack,
  Add,
  Remove
} from '@mui/icons-material';
import { useTheme } from '../contexts/ThemeContext';
import { useResupplyCart } from '../contexts/ResupplyCartContext';
import { api } from '../services/api';

const ResupplyCart = () => {
  const { isDarkMode, colors } = useTheme();
  const navigate = useNavigate();
  const { cartItems, removeFromCart, updateCartItem, clearCart } = useResupplyCart();
  const [suppliers, setSuppliers] = useState([]);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const response = await api.get('/suppliers');
      setSuppliers(response.data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const getPackSizes = (capacity) => {
    if (!capacity || !Array.isArray(capacity)) return [];
    
    // Filter for pack sizes (6 pack, 12 pack, etc.)
    const packSizes = capacity.filter(cap => {
      const capStr = String(cap).toLowerCase();
      return capStr.includes('pack') || capStr.includes('6') || capStr.includes('12');
    });
    
    return packSizes.length > 0 ? packSizes : ['Individual'];
  };

  const handleQuantityChange = (drinkId, value) => {
    const numValue = parseInt(value) || 1;
    if (numValue > 0) {
      updateCartItem(drinkId, { quantity: numValue });
    }
  };

  const handlePackSizeChange = (drinkId, packSize) => {
    updateCartItem(drinkId, { packSize });
  };

  const handleSupplierChange = (drinkId, supplierId) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    updateCartItem(drinkId, {
      supplierId: supplierId,
      supplierName: supplier?.name || null
    });
  };

  // eslint-disable-next-line no-unused-vars
  const _generateWhatsAppMessage = () => {
    if (cartItems.length === 0) return '';

    // Group items by supplier
    const itemsBySupplier = {};
    cartItems.forEach(item => {
      const supplierId = item.supplierId || 'no-supplier';
      if (!itemsBySupplier[supplierId]) {
        itemsBySupplier[supplierId] = {
          supplierName: item.supplierName || 'Unknown Supplier',
          items: []
        };
      }
      itemsBySupplier[supplierId].items.push(item);
    });

    let message = '🛒 *Resupply Order*\n\n';
    
    Object.entries(itemsBySupplier).forEach(([supplierId, data]) => {
      message += `*Supplier: ${data.supplierName}*\n`;
      data.items.forEach((item, index) => {
        const packInfo = item.packSize ? ` (${item.packSize})` : '';
        message += `${index + 1}. ${item.drinkName} - Qty: ${item.quantity}${packInfo}\n`;
      });
      message += '\n';
    });

    message += `Date: ${new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })}\n`;
    message += '\nPlease confirm availability and delivery timeline.';

    return encodeURIComponent(message);
  };

  const handleSendOrder = () => {
    // Validate all items have supplier selected
    const itemsWithoutSupplier = cartItems.filter(item => !item.supplierId);
    if (itemsWithoutSupplier.length > 0) {
      alert('Please select a supplier for all items before sending the order.');
      return;
    }

    // Group by supplier and open WhatsApp for each
    const itemsBySupplier = {};
    cartItems.forEach(item => {
      const supplierId = item.supplierId;
      if (!itemsBySupplier[supplierId]) {
        itemsBySupplier[supplierId] = {
          supplier: suppliers.find(s => s.id === supplierId),
          items: []
        };
      }
      itemsBySupplier[supplierId].items.push(item);
    });

    // Open WhatsApp for each supplier
    Object.entries(itemsBySupplier).forEach(([supplierId, data]) => {
      const supplier = data.supplier;
      if (supplier) {
        // Get phone number from supplier
        const phoneNumber = supplier.phone;
        
        if (phoneNumber) {
          // Generate message for this supplier's items only
          let message = '🛒 *Resupply Order*\n\n';
          message += `*Supplier: ${supplier.name}*\n\n`;
          data.items.forEach((item, index) => {
            const packInfo = item.packSize ? ` (${item.packSize})` : '';
            message += `${index + 1}. ${item.drinkName} - Qty: ${item.quantity}${packInfo}\n`;
          });
          message += `\nDate: ${new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}\n`;
          message += '\nPlease confirm availability and delivery timeline.';

          // Format phone number for WhatsApp (remove non-digits, ensure starts with country code)
          let phone = phoneNumber.replace(/\D/g, '');
          if (phone.startsWith('0')) {
            phone = '254' + phone.substring(1);
          } else if (!phone.startsWith('254')) {
            phone = '254' + phone;
          }

          const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
          window.open(whatsappUrl, '_blank');
        } else {
          alert(`Supplier ${supplier.name} does not have a phone number configured.`);
        }
      }
    });

    // Clear cart after sending
    clearCart();
    alert('Resupply orders sent via WhatsApp!');
  };

  if (cartItems.length === 0) {
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={() => navigate('/copilot/reports', { state: { tab: 2 } })} sx={{ mr: 2, color: colors.textPrimary }}>
            <ShoppingCart />
          </IconButton>
          <Typography variant="h5" sx={{ fontWeight: 600, color: colors.textPrimary }}>
            Resupply Cart
          </Typography>
        </Box>
        <Paper sx={{ p: 4, textAlign: 'center', backgroundColor: colors.paper }}>
          <Typography variant="body1" sx={{ color: colors.textSecondary, mb: 2 }}>
            Your resupply cart is empty
          </Typography>
          <Button
            variant="contained"
            onClick={() => navigate('/copilot/reports', { state: { tab: 2 } })}
            sx={{
              backgroundColor: colors.accentText,
              color: isDarkMode ? '#000' : '#fff',
              '&:hover': {
                backgroundColor: colors.accent
              }
            }}
          >
            Back to Drinks
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton onClick={() => navigate('/copilot/reports', { state: { tab: 2 } })} sx={{ color: colors.textPrimary }}>
            <ArrowBack />
          </IconButton>
          <ShoppingCart sx={{ color: colors.textPrimary, mr: 1 }} />
          <Typography variant="h5" sx={{ fontWeight: 600, color: colors.textPrimary }}>
            Resupply Cart ({cartItems.length} {cartItems.length === 1 ? 'item' : 'items'})
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Send />}
          onClick={handleSendOrder}
          disabled={cartItems.some(item => !item.supplierId)}
          sx={{
            backgroundColor: colors.accentText,
            color: isDarkMode ? '#000' : '#fff',
            '&:hover': {
              backgroundColor: colors.accent
            },
            '&:disabled': {
              backgroundColor: colors.textSecondary,
              color: colors.paper
            }
          }}
        >
          Place Resupply Order
        </Button>
      </Box>

      {cartItems.some(item => !item.supplierId) && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Please select a supplier for all items before sending the order.
        </Alert>
      )}

      <Paper sx={{ backgroundColor: colors.paper }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Drink Name</TableCell>
                <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Quantity</TableCell>
                <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Pack Size</TableCell>
                <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Supplier</TableCell>
                <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {cartItems.map((item) => {
                const packSizes = getPackSizes(item.capacity);
                return (
                  <TableRow key={item.drinkId}>
                    <TableCell sx={{ color: colors.textPrimary, fontWeight: 600 }}>
                      {item.drinkName}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <IconButton
                          size="small"
                          onClick={() => {
                            const currentQty = item.quantity || 1;
                            if (currentQty > 1) {
                              handleQuantityChange(item.drinkId, currentQty - 1);
                            }
                          }}
                          disabled={(item.quantity || 1) <= 1}
                          sx={{
                            color: colors.accentText,
                            border: `1px solid ${colors.border}`,
                            '&:hover': {
                              backgroundColor: colors.accentText + '20',
                            },
                            '&:disabled': {
                              color: colors.textSecondary,
                              borderColor: colors.border,
                            }
                          }}
                        >
                          <Remove fontSize="small" />
                        </IconButton>
                        <Typography
                          variant="body1"
                          sx={{
                            minWidth: 40,
                            textAlign: 'center',
                            color: colors.textPrimary,
                            fontWeight: 500
                          }}
                        >
                          {item.quantity || 1}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => {
                            const currentQty = item.quantity || 1;
                            handleQuantityChange(item.drinkId, currentQty + 1);
                          }}
                          sx={{
                            color: colors.accentText,
                            border: `1px solid ${colors.border}`,
                            '&:hover': {
                              backgroundColor: colors.accentText + '20',
                            }
                          }}
                        >
                          <Add fontSize="small" />
                        </IconButton>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {packSizes.length > 1 ? (
                        <FormControl size="small" sx={{ minWidth: 150 }}>
                          <Select
                            value={item.packSize || packSizes[0]}
                            onChange={(e) => handlePackSizeChange(item.drinkId, e.target.value)}
                          >
                            {packSizes.map((pack) => (
                              <MenuItem key={pack} value={pack}>
                                {pack}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      ) : (
                        <Chip label={packSizes[0] || 'Individual'} size="small" />
                      )}
                    </TableCell>
                    <TableCell>
                      <FormControl size="small" sx={{ minWidth: 200 }}>
                        <Select
                          value={item.supplierId || ''}
                          onChange={(e) => handleSupplierChange(item.drinkId, e.target.value)}
                          displayEmpty
                        >
                          <MenuItem value="">
                            <em>Select Supplier</em>
                          </MenuItem>
                          {suppliers.map((supplier) => (
                            <MenuItem key={supplier.id} value={supplier.id}>
                              {supplier.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => removeFromCart(item.drinkId)}
                        sx={{
                          color: colors.error,
                          '&:hover': {
                            backgroundColor: 'rgba(255, 51, 102, 0.1)'
                          }
                        }}
                      >
                        <Delete />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default ResupplyCart;

