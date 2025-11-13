import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  TextField,
  Button,
  Divider,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Person,
  Phone,
  Email,
  LocationOn,
  Edit,
  Save,
  Cancel,
  ExitToApp
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useCustomer } from '../contexts/CustomerContext';
import AddressAutocomplete from '../components/AddressAutocomplete';
import { sanitizeCustomerNotes } from '../utils/sanitizeNotes';

const Profile = () => {
  const navigate = useNavigate();
  const { customer, isLoggedIn, logout, updateCustomer } = useCustomer();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    apartmentHouseNumber: '',
    floorNumber: '',
    notes: ''
  });
  
  useEffect(() => {
    // Redirect to login if not logged in
    if (!isLoggedIn && !localStorage.getItem('customerOrder')) {
      navigate('/login');
      return;
    }
    loadCustomerInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, navigate]);

  const loadCustomerInfo = async () => {
    try {
      setLoading(true);
      // Get customer info from localStorage (saved during login)
      const savedOrder = localStorage.getItem('customerOrder');
      if (!savedOrder) {
        setLoading(false);
        return;
      }
      
      const { email, phone } = JSON.parse(savedOrder);
      
      // Try to fetch the most recent order to get delivery information
      let deliveryInfo = {
        name: '',
        phone: phone || '',
        email: email || '',
        address: '',
        apartmentHouseNumber: '',
        floorNumber: '',
        notes: ''
      };
      
      try {
        // Fetch customer's most recent order to get delivery details
        const response = await api.post('/orders/find-all', {
          email: email || null,
          phone: phone || null
        });
        
        if (response.data.success && response.data.orders && response.data.orders.length > 0) {
          // Get the most recent order (first one since they're sorted by createdAt DESC)
          const mostRecentOrder = response.data.orders[0];
          
          // Extract delivery information from the most recent order
          const customerNotes = sanitizeCustomerNotes(mostRecentOrder.notes);
          
          deliveryInfo = {
            name: mostRecentOrder.customerName || '',
            phone: mostRecentOrder.customerPhone || phone || '',
            email: mostRecentOrder.customerEmail || email || '',
            address: mostRecentOrder.deliveryAddress || '',
            apartmentHouseNumber: '',
            floorNumber: '',
            notes: customerNotes // Only customer-entered instructions
          };
          
          // Try to parse apartment/house number and floor from delivery address or notes
          // The delivery address might contain the full address, so we'll try to extract details
          const addressParts = mostRecentOrder.deliveryAddress?.split(',') || [];
          if (addressParts.length > 1) {
            // If address has multiple parts, the last part might be apartment/house number
            const lastPart = addressParts[addressParts.length - 1].trim();
            if (lastPart && !lastPart.includes('Kenya') && !lastPart.includes('Nairobi')) {
              deliveryInfo.apartmentHouseNumber = lastPart;
            }
          }
          
          // Check if there's saved delivery info in localStorage
          const savedDeliveryInfo = localStorage.getItem('customerDeliveryInfo');
          if (savedDeliveryInfo) {
            try {
              const parsed = JSON.parse(savedDeliveryInfo);
              // Merge saved info with order info (saved info takes precedence)
              // But ensure notes don't contain technical details
              const sanitizedSavedNotes = sanitizeCustomerNotes(parsed.notes ?? '');
              
              deliveryInfo = {
                ...deliveryInfo,
                ...parsed,
                notes: sanitizedSavedNotes,
                // Keep email and phone from saved order if not in saved delivery info
                email: parsed.email || deliveryInfo.email,
                phone: parsed.phone || deliveryInfo.phone
              };
            } catch (e) {
              console.error('Error parsing saved delivery info:', e);
            }
          }
        }
      } catch (orderError) {
        console.error('Error fetching orders for delivery info:', orderError);
        // Fallback to localStorage if available
        const savedDeliveryInfo = localStorage.getItem('customerDeliveryInfo');
        if (savedDeliveryInfo) {
          try {
            const parsed = JSON.parse(savedDeliveryInfo);
            deliveryInfo = {
              ...deliveryInfo,
              ...parsed,
              notes: sanitizeCustomerNotes(parsed.notes)
            };
          } catch (e) {
            console.error('Error parsing saved delivery info:', e);
          }
        }
      }
      
      setCustomerInfo(deliveryInfo);
      try {
        localStorage.setItem('customerDeliveryInfo', JSON.stringify({
          name: deliveryInfo.name,
          phone: deliveryInfo.phone,
          email: deliveryInfo.email,
          address: deliveryInfo.address,
          apartmentHouseNumber: deliveryInfo.apartmentHouseNumber,
          floorNumber: deliveryInfo.floorNumber,
          notes: sanitizeCustomerNotes(deliveryInfo.notes)
        }));
      } catch (storageError) {
        console.warn('Unable to persist cleaned delivery info:', storageError);
      }
    } catch (err) {
      console.error('Error loading customer info:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, valueOrEvent) => {
    const value =
      valueOrEvent && typeof valueOrEvent === 'object' && 'target' in valueOrEvent
        ? valueOrEvent.target.value
        : valueOrEvent;

    setCustomerInfo((prev) => {
      if (prev[field] === value) {
        return prev;
      }
      setHasUnsavedChanges(true);
      return {
      ...prev,
      [field]: value
      };
    });
  };

  const handleSave = async () => {
    try {
      setError('');
      setSuccess('');
      
      const sanitizedNotesForSave = sanitizeCustomerNotes(customerInfo.notes);
      
      // Save delivery information to localStorage
      localStorage.setItem('customerDeliveryInfo', JSON.stringify({
        name: customerInfo.name,
        phone: customerInfo.phone,
        email: customerInfo.email,
        address: customerInfo.address,
        apartmentHouseNumber: customerInfo.apartmentHouseNumber,
        floorNumber: customerInfo.floorNumber,
        notes: sanitizedNotesForSave
      }));
      
      // Also update customerOrder in localStorage
      const savedOrder = localStorage.getItem('customerOrder');
      if (savedOrder) {
        const orderData = JSON.parse(savedOrder);
        localStorage.setItem('customerOrder', JSON.stringify({
          ...orderData,
          email: customerInfo.email,
          phone: customerInfo.phone,
          customerName: customerInfo.name
        }));
      }
      
      // Update customer context
      updateCustomer({
        email: customerInfo.email,
        phone: customerInfo.phone,
        customerName: customerInfo.name
      });
      
      setCustomerInfo((prev) => ({
        ...prev,
        notes: sanitizedNotesForSave
      }));
      
      setSuccess('Profile updated successfully! Your delivery information has been saved.');
      setIsEditing(false);
      setHasUnsavedChanges(false);
    } catch (err) {
      setError('Failed to update profile. Please try again.');
    }
  };

  const handleCancel = () => {
    loadCustomerInfo();
    setIsEditing(false);
    setHasUnsavedChanges(false);
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ color: '#000000', fontWeight: 700, mb: 4 }}>
        My Profile
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <Paper sx={{ p: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6">Personal Information</Typography>
            <Button
              startIcon={<Edit />}
            onClick={() => setIsEditing((prev) => !prev)}
              sx={{ color: '#000000' }}
            >
            {isEditing ? 'Stop Editing' : 'Edit'}
            </Button>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <TextField
            label="Full Name"
            value={customerInfo.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            InputProps={{
              startAdornment: <Person sx={{ mr: 1, color: 'text.secondary' }} />
            }}
            fullWidth
          />

          <TextField
            label="Phone Number"
            value={customerInfo.phone}
            onChange={(e) => handleInputChange('phone', e.target.value)}
            disabled={!isEditing}
            InputProps={{
              startAdornment: <Phone sx={{ mr: 1, color: 'text.secondary' }} />
            }}
            fullWidth
          />

          <TextField
            label="Email Address"
            type="email"
            value={customerInfo.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            disabled={!isEditing}
            InputProps={{
              startAdornment: <Email sx={{ mr: 1, color: 'text.secondary' }} />
            }}
            fullWidth
          />

            <AddressAutocomplete
              label="Delivery Address"
            value={typeof customerInfo.address === 'string' ? customerInfo.address : ''}
            onChange={(event) => handleInputChange('address', event)}
              placeholder="Start typing your address..."
            helperText="Update your delivery address to help drivers locate you faster"
              InputProps={{
              startAdornment: (
                <LocationOn sx={{ mr: 1, color: 'text.secondary' }} />
              )
              }}
            />
          
          <TextField
            label="Apartment/House Number"
            value={customerInfo.apartmentHouseNumber}
            onChange={(e) => handleInputChange('apartmentHouseNumber', e.target.value)}
            fullWidth
            placeholder="e.g., Apartment 4B, House 12"
          />
          
          <TextField
            label="Floor Number (Optional)"
            value={customerInfo.floorNumber}
            onChange={(e) => handleInputChange('floorNumber', e.target.value)}
            fullWidth
            placeholder="e.g., 3rd Floor"
          />
          
          <TextField
            label="Special Instructions (Optional)"
            value={customerInfo.notes}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            multiline
            rows={2}
            fullWidth
            placeholder="Any special delivery instructions"
          />
        </Box>

        {(isEditing || hasUnsavedChanges) && (
          <Box sx={{ display: 'flex', gap: 2, mt: 4 }}>
            <Button
              variant="contained"
              startIcon={<Save />}
              onClick={handleSave}
              sx={{
                backgroundColor: '#00E0B8',
                color: '#0D0D0D',
                '&:hover': { backgroundColor: '#00C4A3' }
              }}
              disabled={!hasUnsavedChanges && !isEditing}
            >
              Save Changes
            </Button>
            {isEditing && (
            <Button
              variant="outlined"
              startIcon={<Cancel />}
              onClick={handleCancel}
            >
              Cancel
            </Button>
            )}
          </Box>
        )}
      </Paper>

      <Box sx={{ mt: 4, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Button
          variant="outlined"
          onClick={() => navigate('/orders')}
          sx={{ flex: 1, minWidth: '150px' }}
        >
          View My Orders
        </Button>
        <Button
          variant="outlined"
          onClick={() => navigate('/menu')}
          sx={{ flex: 1, minWidth: '150px' }}
        >
          Continue Shopping
        </Button>
        <Button
          variant="outlined"
          startIcon={<ExitToApp />}
          onClick={() => {
            logout();
            navigate('/');
          }}
          sx={{
            flex: 1,
            minWidth: '150px',
            borderColor: '#FF3366',
            color: '#FF3366',
            '&:hover': {
              borderColor: '#FF3366',
              backgroundColor: 'rgba(255, 51, 102, 0.1)'
            }
          }}
        >
          Log Out
        </Button>
      </Box>
    </Container>
  );
};

export default Profile;

