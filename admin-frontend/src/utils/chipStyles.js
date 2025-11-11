import React from 'react';
import {
  AccessTime,
  CheckCircle,
  Cancel,
  LocalShipping,
  DoneAll,
  ShoppingCart
} from '@mui/icons-material';

export const getOrderStatusChipProps = (status) => {
  const normalized = (status || '').toLowerCase();
  switch (normalized) {
    case 'pending':
      return { label: 'Pending', color: 'warning', icon: <AccessTime fontSize="small" /> };
    case 'confirmed':
      return { label: 'Confirmed', color: 'info', icon: <CheckCircle fontSize="small" /> };
    case 'preparing':
      return { label: 'Preparing', color: 'primary', icon: <ShoppingCart fontSize="small" /> };
    case 'out_for_delivery':
      return { label: 'On the Way', color: 'secondary', icon: <LocalShipping fontSize="small" /> };
    case 'delivered':
    case 'completed':
      return { label: normalized === 'completed' ? 'Completed' : 'Delivered', color: 'success', icon: <DoneAll fontSize="small" /> };
    case 'cancelled':
      return { label: 'Cancelled', color: 'error', icon: <Cancel fontSize="small" /> };
    default:
      return { label: status || '—', color: 'default', icon: <ShoppingCart fontSize="small" /> };
  }
};

export const getPaymentStatusChipProps = (paymentStatus, orderStatus) => {
  if (!paymentStatus) {
    return null;
  }

  const normalized = paymentStatus.toLowerCase();
  if (orderStatus === 'delivered' && normalized === 'unpaid') {
    return {
      label: 'Unpaid (Delivered)',
      color: 'error',
      icon: <Cancel fontSize="small" />
    };
  }

  switch (normalized) {
    case 'paid':
      return { label: 'Paid', color: 'success', icon: <CheckCircle fontSize="small" /> };
    case 'unpaid':
      return { label: 'Unpaid', color: 'warning', icon: <AccessTime fontSize="small" /> };
    case 'pending':
      return { label: 'Pending', color: 'default', icon: <AccessTime fontSize="small" /> };
    default:
      return { label: paymentStatus, color: 'default' };
  }
};

export const getPaymentMethodChipProps = (method) => {
  if (!method) {
    return null;
  }

  const normalized = method.toLowerCase();
  if (normalized === 'mobile_money') {
    return {
      label: 'Mobile Money',
      sx: {
        backgroundColor: '#00E0B8',
        color: '#003B2F',
        fontWeight: 700
      }
    };
  }

  if (normalized === 'card') {
    return {
      label: 'Card',
      sx: {
        backgroundColor: '#2196F3',
        color: '#002A54',
        fontWeight: 700
      }
    };
  }

  return {
    label: method,
    sx: {
      backgroundColor: '#424242',
      color: '#FFFFFF',
      fontWeight: 600
    }
  };
};

export const getTransactionTypeChipProps = (type) => {
  if (!type) {
    return null;
  }

  const normalized = type.toLowerCase();
  if (normalized === 'tip') {
    return {
      label: 'Tip',
      sx: {
        backgroundColor: '#FFC107',
        color: '#000',
        fontWeight: 700
      }
    };
  }

  if (normalized === 'driver_pay') {
    return {
      label: 'Driver Payout',
      sx: {
        backgroundColor: '#FFC107',
        color: '#000',
        fontWeight: 700
      }
    };
  }

  if (normalized === 'delivery_fee_debit') {
    return {
      label: 'Delivery Fee (Cash)',
      sx: {
        backgroundColor: '#FF6B6B',
        color: '#FFFFFF',
        fontWeight: 700
      }
    };
  }

  if (normalized === 'payment' || normalized === 'order_payment') {
    return {
      label: 'Order Payment',
      sx: {
        backgroundColor: '#00E0B8',
        color: '#003B2F',
        fontWeight: 700
      }
    };
  }

  if (normalized === 'delivery' || normalized === 'delivery_pay') {
    return {
      label: 'Delivery Fee Payment',
      sx: {
        backgroundColor: '#2196F3',
        color: '#002A54',
        fontWeight: 700
      }
    };
  }

  return {
    label: type,
    sx: {
      backgroundColor: '#616161',
      color: '#FFFFFF',
      fontWeight: 600
    }
  };
};

export const getTransactionStatusChipProps = (status) => {
  if (!status) {
    return null;
  }

  const normalized = status.toLowerCase();
  switch (normalized) {
    case 'completed':
      return { label: 'Completed', color: 'success', icon: <CheckCircle fontSize="small" /> };
    case 'paid':
      return { label: 'Paid', color: 'success', icon: <CheckCircle fontSize="small" /> };
    case 'pending':
      return { label: 'Pending', color: 'warning', icon: <AccessTime fontSize="small" /> };
    case 'unpaid':
      return { label: 'Unpaid', color: 'warning', icon: <AccessTime fontSize="small" /> };
    case 'failed':
    case 'cancelled':
      return { label: normalized.charAt(0).toUpperCase() + normalized.slice(1), color: 'error', icon: <Cancel fontSize="small" /> };
    default:
      return { label: status, color: 'default' };
  }
};



