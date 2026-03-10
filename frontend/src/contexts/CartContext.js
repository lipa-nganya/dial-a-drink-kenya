import React, { createContext, useContext, useReducer, useState, useEffect } from 'react';

const CartContext = createContext();

const CART_STORAGE_KEY = 'dialadrink_cart';

function cartItemsToStorage(items) {
  return items.map(({ drinkId, drink, quantity, price, selectedCapacity }) => ({
    drinkId,
    quantity,
    price,
    selectedCapacity: selectedCapacity ?? null,
    drink: drink ? {
      id: drink.id,
      name: drink.name,
      image: drink.image
    } : { id: drinkId, name: '', image: null }
  }));
}

function loadCartFromStorage() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return { items: [] };
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed) ? parsed : (parsed.items && Array.isArray(parsed.items) ? parsed.items : []);
    return { items };
  } catch {
    return { items: [] };
  }
}

const cartReducer = (state, action) => {
  switch (action.type) {
      case 'ADD_TO_CART':
      // Create a unique key that includes capacity to differentiate items with different capacities
      // const itemKey = action.payload.selectedCapacity 
      //   ? `${action.payload.drinkId}-${action.payload.selectedCapacity}`
      //   : action.payload.drinkId; // Unused
      
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
  const [state, dispatch] = useReducer(cartReducer, undefined, () => loadCartFromStorage());
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [isHydrated, setIsHydrated] = useState(false);

  // Persist cart to localStorage whenever items change (do not clear on refresh/navigate)
  useEffect(() => {
    if (!isHydrated) {
      setIsHydrated(true);
      return;
    }
    const toStore = cartItemsToStorage(state.items);
    try {
      if (toStore.length === 0) {
        localStorage.removeItem(CART_STORAGE_KEY);
      } else {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(toStore));
      }
    } catch (e) {
      console.warn('Could not persist cart to localStorage', e);
    }
  }, [state.items]);

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
