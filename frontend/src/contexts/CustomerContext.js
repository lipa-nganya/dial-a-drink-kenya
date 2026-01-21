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

  // Load customer from localStorage on mount and on storage changes
  useEffect(() => {
    const loadCustomer = () => {
      const customerData = localStorage.getItem('customerOrder');
      if (customerData) {
        try {
          const parsed = JSON.parse(customerData);
          // Only set as logged in if we have essential customer data (id, phone, or email)
          if (parsed.id || parsed.phone || parsed.email) {
            setCustomer(parsed);
            setIsLoggedIn(true);
            console.log('✅ Customer loaded from localStorage:', { id: parsed.id, phone: parsed.phone, email: parsed.email });
          } else {
            console.warn('⚠️  Customer data in localStorage missing essential fields');
          }
        } catch (error) {
          console.error('Error parsing customer data:', error);
        }
      }
    };

    // Load on mount
    loadCustomer();

    // Listen for storage changes (e.g., when order is placed and localStorage is updated)
    const handleStorageChange = (e) => {
      if (e.key === 'customerOrder') {
        loadCustomer();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for custom event for same-tab updates
    window.addEventListener('customerDataUpdated', loadCustomer);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('customerDataUpdated', loadCustomer);
    };
  }, []);

  const login = (customerData) => {
    localStorage.setItem('customerOrder', JSON.stringify(customerData));
    localStorage.setItem('customerLoggedIn', 'true');
    setCustomer(customerData);
    setIsLoggedIn(true);
    // Dispatch custom event to notify other components
    window.dispatchEvent(new Event('customerDataUpdated'));
    console.log('✅ Customer logged in:', { id: customerData.id, phone: customerData.phone, email: customerData.email });
  };

  const logout = () => {
    localStorage.removeItem('customerOrder');
    setCustomer(null);
    setIsLoggedIn(false);
  };

  const updateCustomer = (customerData) => {
    localStorage.setItem('customerOrder', JSON.stringify(customerData));
    setCustomer(customerData);
    // Dispatch custom event to notify other components
    window.dispatchEvent(new Event('customerDataUpdated'));
    console.log('✅ Customer data updated:', { id: customerData.id, phone: customerData.phone, email: customerData.email });
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

