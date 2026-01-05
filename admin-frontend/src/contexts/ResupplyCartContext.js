import React, { createContext, useContext, useState, useEffect } from 'react';

const ResupplyCartContext = createContext();

export const useResupplyCart = () => {
  const context = useContext(ResupplyCartContext);
  if (!context) {
    throw new Error('useResupplyCart must be used within a ResupplyCartProvider');
  }
  return context;
};

export const ResupplyCartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState(() => {
    // Load from localStorage on init
    const saved = localStorage.getItem('resupplyCart');
    return saved ? JSON.parse(saved) : [];
  });

  // Save to localStorage whenever cart changes
  useEffect(() => {
    localStorage.setItem('resupplyCart', JSON.stringify(cartItems));
  }, [cartItems]);

  const addToCart = (drink) => {
    setCartItems(prev => {
      // Check if item already exists in cart
      const existingIndex = prev.findIndex(item => item.drinkId === drink.id);
      if (existingIndex >= 0) {
        // Item already in cart, don't add duplicate
        return prev;
      }
      // Add new item to cart
      return [...prev, {
        drinkId: drink.id,
        drinkName: drink.name,
        supplierId: drink.supplierId || null,
        supplierName: drink.supplierName || null,
        quantity: 1,
        packSize: null, // Will be set in cart
        capacity: drink.capacity || []
      }];
    });
  };

  const removeFromCart = (drinkId) => {
    setCartItems(prev => prev.filter(item => item.drinkId !== drinkId));
  };

  const updateCartItem = (drinkId, updates) => {
    setCartItems(prev => prev.map(item => 
      item.drinkId === drinkId ? { ...item, ...updates } : item
    ));
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const value = {
    cartItems,
    addToCart,
    removeFromCart,
    updateCartItem,
    clearCart
  };

  return (
    <ResupplyCartContext.Provider value={value}>
      {children}
    </ResupplyCartContext.Provider>
  );
};



