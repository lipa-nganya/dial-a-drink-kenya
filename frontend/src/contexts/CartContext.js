import React, { createContext, useContext, useReducer, useState } from 'react';

const CartContext = createContext();

const cartReducer = (state, action) => {
  switch (action.type) {
    case 'ADD_TO_CART':
      // Create a unique key that includes capacity to differentiate items with different capacities
      const itemKey = action.payload.selectedCapacity 
        ? `${action.payload.drinkId}-${action.payload.selectedCapacity}`
        : action.payload.drinkId;
      
      const existingItem = state.items.find(item => 
        item.drinkId === action.payload.drinkId && 
        item.selectedCapacity === action.payload.selectedCapacity
      );
      
      if (existingItem) {
        return {
          ...state,
          items: state.items.map(item =>
            item.drinkId === action.payload.drinkId && item.selectedCapacity === action.payload.selectedCapacity
              ? { ...item, quantity: item.quantity + action.payload.quantity }
              : item
          )
        };
      }
      return {
        ...state,
        items: [...state.items, action.payload]
      };
    
    case 'REMOVE_FROM_CART':
      return {
        ...state,
        items: state.items.filter(item => 
          item.drinkId !== action.payload.drinkId || 
          (action.payload.selectedCapacity && item.selectedCapacity !== action.payload.selectedCapacity)
        )
      };
    
    case 'UPDATE_QUANTITY':
      return {
        ...state,
        items: state.items.map(item =>
          item.drinkId === action.payload.drinkId
            ? { ...item, quantity: action.payload.quantity }
            : item
        ).filter(item => item.quantity > 0)
      };
    
    case 'CLEAR_CART':
      return {
        ...state,
        items: []
      };
    
    default:
      return state;
  }
};

export const CartProvider = ({ children }) => {
  const [state, dispatch] = useReducer(cartReducer, { items: [] });
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const addToCart = (drink, quantity = 1) => {
    dispatch({
      type: 'ADD_TO_CART',
      payload: {
        drinkId: drink.id,
        drink: drink,
        quantity: quantity,
        price: drink.selectedPrice || drink.price,
        selectedCapacity: drink.selectedCapacity || null
      }
    });
    
    // Show snackbar notification
    const capacityText = drink.selectedCapacity ? ` (${drink.selectedCapacity})` : '';
    setSnackbarMessage(`${drink.name}${capacityText} added to cart`);
    setSnackbarOpen(true);
  };

  const removeFromCart = (drinkId, selectedCapacity = null) => {
    dispatch({
      type: 'REMOVE_FROM_CART',
      payload: { drinkId, selectedCapacity }
    });
  };

  const updateQuantity = (drinkId, quantity) => {
    dispatch({
      type: 'UPDATE_QUANTITY',
      payload: { drinkId, quantity }
    });
  };

  const clearCart = () => {
    dispatch({ type: 'CLEAR_CART' });
  };

  const getTotalPrice = () => {
    return state.items.reduce((total, item) => total + (Number(item.price) * item.quantity), 0);
  };

  const getTotalItems = () => {
    return state.items.reduce((total, item) => total + item.quantity, 0);
  };

  return (
    <CartContext.Provider value={{
      ...state,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      getTotalPrice,
      getTotalItems,
      snackbarOpen,
      setSnackbarOpen,
      snackbarMessage
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
