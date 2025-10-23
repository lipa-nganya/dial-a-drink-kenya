import React, { createContext, useContext, useReducer } from 'react';

const CartContext = createContext();

const cartReducer = (state, action) => {
  switch (action.type) {
    case 'ADD_TO_CART':
      const existingItem = state.items.find(item => item.drinkId === action.payload.drinkId);
      if (existingItem) {
        return {
          ...state,
          items: state.items.map(item =>
            item.drinkId === action.payload.drinkId
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
        items: state.items.filter(item => item.drinkId !== action.payload)
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

  const addToCart = (drink, quantity = 1) => {
    dispatch({
      type: 'ADD_TO_CART',
      payload: {
        drinkId: drink.id,
        drink: drink,
        quantity: quantity,
        price: drink.price
      }
    });
  };

  const removeFromCart = (drinkId) => {
    dispatch({
      type: 'REMOVE_FROM_CART',
      payload: drinkId
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
    return state.items.reduce((total, item) => total + (item.price * item.quantity), 0);
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
      getTotalItems
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
