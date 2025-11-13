import React from 'react';
import { Navigate } from 'react-router-dom';
import { useCustomer } from '../contexts/CustomerContext';

const CustomerPrivateRoute = ({ children }) => {
  const { isLoggedIn } = useCustomer();
  
  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

export default CustomerPrivateRoute;

