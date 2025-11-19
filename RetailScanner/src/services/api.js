import axios from 'axios';
import Constants from 'expo-constants';

// Get API URL from Expo config (set via eas.json build profiles)
const API_BASE_URL = Constants.expoConfig?.extra?.apiBaseUrl 
  || (__DEV__ ? 'http://localhost:5001' : 'https://dialadrink-backend-910510650031.us-central1.run.app');

console.log('🔗 Retail Scanner API Base URL:', API_BASE_URL);

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Inventory APIs
export const attachBarcode = async (drinkId, barcode) => {
  const response = await api.post('/inventory/attach-barcode', { drinkId, barcode });
  return response.data;
};

export const updateStock = async (drinkId, stock) => {
  const response = await api.post('/inventory/update-stock', { drinkId, stock });
  return response.data;
};

export const decreaseStock = async (drinkId, quantity) => {
  const response = await api.post('/inventory/decrease-stock', { drinkId, quantity });
  return response.data;
};

export const getDrinkByBarcode = async (barcode) => {
  const response = await api.get(`/inventory/barcode/${encodeURIComponent(barcode)}`);
  return response.data;
};

export const searchDrinks = async (searchTerm) => {
  const response = await api.get(`/drinks?search=${encodeURIComponent(searchTerm)}`);
  return response.data;
};

// POS APIs
export const scanForPOS = async (barcode) => {
  const response = await api.get(`/pos/drinks/barcode/${encodeURIComponent(barcode)}`);
  return response.data;
};

export const getPOSCart = async () => {
  const response = await api.get('/pos/cart');
  return response.data;
};

export const addToPOSCart = async (drinkId, quantity = 1) => {
  const response = await api.post('/pos/cart/add', { drinkId, quantity });
  return response.data;
};

export const removeFromPOSCart = async (drinkId) => {
  const response = await api.post('/pos/cart/remove', { drinkId });
  return response.data;
};

export const updatePOSCartItem = async (drinkId, quantity) => {
  const response = await api.post('/pos/cart/update', { drinkId, quantity });
  return response.data;
};

export const clearPOSCart = async () => {
  const response = await api.delete('/pos/cart');
  return response.data;
};

export default api;

