import React, { createContext, useContext, useState, useEffect } from 'react';

const CustomerContext = createContext();

export const useCustomer = () => {
  const context = useContext(CustomerContext);
  if (!context) {
    throw new Error('useCustomer must be used within a CustomerProvider');
  }
  return context;
};

export const CustomerProvider = ({ children }) => {
  const [customer, setCustomer] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Load customer from localStorage on mount
  useEffect(() => {
    const customerData = localStorage.getItem('customerOrder');
    if (customerData) {
      try {
        const parsed = JSON.parse(customerData);
        setCustomer(parsed);
        setIsLoggedIn(true);
      } catch (error) {
        console.error('Error parsing customer data:', error);
      }
    }
  }, []);

  const login = (customerData) => {
    localStorage.setItem('customerOrder', JSON.stringify(customerData));
    setCustomer(customerData);
    setIsLoggedIn(true);
  };

  const logout = () => {
    localStorage.removeItem('customerOrder');
    setCustomer(null);
    setIsLoggedIn(false);
  };

  const updateCustomer = (customerData) => {
    localStorage.setItem('customerOrder', JSON.stringify(customerData));
    setCustomer(customerData);
  };

  return (
    <CustomerContext.Provider value={{
      customer,
      isLoggedIn,
      login,
      logout,
      updateCustomer
    }}>
      {children}
    </CustomerContext.Provider>
  );
};

