import { api } from './api';

/**
 * Fetch product by barcode
 * @param {string} barcode - The barcode to search for
 * @returns {Promise<Object>} Product data
 */
export const fetchProductByBarcode = async (barcode) => {
  try {
    const response = await api.get(`/pos/drinks/barcode/${encodeURIComponent(barcode)}`);
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      throw new Error('Product not found with this barcode');
    }
    throw new Error(error.response?.data?.error || 'Failed to fetch product by barcode');
  }
};

