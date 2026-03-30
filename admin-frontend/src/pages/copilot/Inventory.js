import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Chip,
  TextField,
  IconButton,
  TablePagination,
  Snackbar,
  Button,
  MenuItem,
  Tabs,
  Tab
} from '@mui/material';
import {
  Warning,
  TrendingDown,
  AttachMoney,
  CheckCircle,
  TrendingUp,
  Edit,
  Save,
  Cancel,
  ArrowUpward,
  ArrowDownward
} from '@mui/icons-material';
import { api } from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';

const Inventory = () => {
  const { isDarkMode, colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [zeroPurchasePriceItems, setZeroPurchasePriceItems] = useState([]);
  const [zeroSellingPriceItems, setZeroSellingPriceItems] = useState([]);
  const [priceListItems, setPriceListItems] = useState([]);
  const [uncategorizedItems, setUncategorizedItems] = useState([]);
  const [unbrandedItems, setUnbrandedItems] = useState([]);
  const [missingImageItems, setMissingImageItems] = useState([]);
  const [loadingZeroPrice, setLoadingZeroPrice] = useState(true);
  const [allDrinks, setAllDrinks] = useState([]);
  const [copilotTab, setCopilotTab] = useState(0);
  
  // Pagination states
  const [outOfStockPage, setOutOfStockPage] = useState(0);
  const [outOfStockRowsPerPage, setOutOfStockRowsPerPage] = useState(10);
  const [slowMovingPage, setSlowMovingPage] = useState(0);
  const [slowMovingRowsPerPage, setSlowMovingRowsPerPage] = useState(10);
  const [zeroPricePage, setZeroPricePage] = useState(0);
  const [zeroPriceRowsPerPage, setZeroPriceRowsPerPage] = useState(10);
  const [zeroSellingPage, setZeroSellingPage] = useState(0);
  const [zeroSellingRowsPerPage, setZeroSellingRowsPerPage] = useState(10);
  const [priceListPage, setPriceListPage] = useState(0);
  const [priceListRowsPerPage, setPriceListRowsPerPage] = useState(10);
  const [uncategorizedPage, setUncategorizedPage] = useState(0);
  const [uncategorizedRowsPerPage, setUncategorizedRowsPerPage] = useState(10);
  const [unbrandedPage, setUnbrandedPage] = useState(0);
  const [unbrandedRowsPerPage, setUnbrandedRowsPerPage] = useState(10);
  const [missingImagePage, setMissingImagePage] = useState(0);
  const [missingImageRowsPerPage, setMissingImageRowsPerPage] = useState(10);
  const [categoriesSummary, setCategoriesSummary] = useState([]);
  const [subcategoriesSummary, setSubcategoriesSummary] = useState([]);
  const [brandsSummary, setBrandsSummary] = useState([]);
  const [categoryTransferMap, setCategoryTransferMap] = useState({});
  const [subCategoryTransferMap, setSubCategoryTransferMap] = useState({});
  const [brandTransferMap, setBrandTransferMap] = useState({});
  const [categoriesPage, setCategoriesPage] = useState(0);
  const [categoriesRowsPerPage, setCategoriesRowsPerPage] = useState(10);
  const [subcategoriesPage, setSubcategoriesPage] = useState(0);
  const [subcategoriesRowsPerPage, setSubcategoriesRowsPerPage] = useState(10);
  const [brandsPage, setBrandsPage] = useState(0);
  const [brandsRowsPerPage, setBrandsRowsPerPage] = useState(10);
  const [outOfStockSearch, setOutOfStockSearch] = useState('');
  const [zeroPurchaseSearch, setZeroPurchaseSearch] = useState('');
  const [zeroSellingSearch, setZeroSellingSearch] = useState('');
  const [priceListSearch, setPriceListSearch] = useState('');
  const [priceListSubcategoryFilter, setPriceListSubcategoryFilter] = useState('');
  const [uncategorizedSearch, setUncategorizedSearch] = useState('');
  const [unbrandedSearch, setUnbrandedSearch] = useState('');
  const [missingImageSearch, setMissingImageSearch] = useState('');
  const [categoriesSearch, setCategoriesSearch] = useState('');
  const [subcategoriesSearch, setSubcategoriesSearch] = useState('');
  const [brandsSearch, setBrandsSearch] = useState('');
  const [slowMovingSearch, setSlowMovingSearch] = useState('');
  const [stockValuationSearch, setStockValuationSearch] = useState('');
  const [stockValuationPage, setStockValuationPage] = useState(0);
  const [stockValuationRowsPerPage, setStockValuationRowsPerPage] = useState(10);
  const [capacitySettingsSearch, setCapacitySettingsSearch] = useState('');
  const [capacitySettingsPage, setCapacitySettingsPage] = useState(0);
  const [capacitySettingsRowsPerPage, setCapacitySettingsRowsPerPage] = useState(10);
  const [newGlobalCapacity, setNewGlobalCapacity] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newBrandName, setNewBrandName] = useState('');
  const [customCapacities, setCustomCapacities] = useState([]);
  const [editingCapacityValue, setEditingCapacityValue] = useState('');
  const [editCapacityValue, setEditCapacityValue] = useState('');
  const [capacityTransferMap, setCapacityTransferMap] = useState({});
  const [priceListSortDirection, setPriceListSortDirection] = useState('asc');
  const [editingPriceListKey, setEditingPriceListKey] = useState(null);
  const [editPriceListSellingPrice, setEditPriceListSellingPrice] = useState('');
  
  // Editing states
  const [editingItem, setEditingItem] = useState(null);
  const [editPurchasePrice, setEditPurchasePrice] = useState('');
  const [editSellingPrice, setEditSellingPrice] = useState('');
  const [editCapacity, setEditCapacity] = useState('');
  const [editCapacities, setEditCapacities] = useState([]);
  const [newCapacityValue, setNewCapacityValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const CUSTOM_CAPACITY_STORAGE_KEY = 'copilot_inventory_custom_capacities';

  useEffect(() => {
    fetchAnalytics();
    fetchZeroPurchasePriceItems();
    fetchInventoryEntitySummaries();
    // Initial load on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CUSTOM_CAPACITY_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setCustomCapacities(
          parsed
            .map((value) => String(value || '').trim())
            .filter((value) => value && !isDefaultCapacityLabel(value))
        );
      }
    } catch (err) {
      console.warn('Failed to read saved custom capacities:', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchInventoryEntitySummaries = async () => {
    try {
      const results = await Promise.allSettled([
        api.get('/admin/inventory/categories-summary'),
        api.get('/admin/inventory/subcategories-summary'),
        api.get('/admin/inventory/brands-summary')
      ]);

      const catRes = results[0];
      const subRes = results[1];
      const brandRes = results[2];

      if (catRes.status === 'fulfilled') {
        setCategoriesSummary(catRes.value.data?.categories || []);
      }
      if (subRes.status === 'fulfilled') {
        setSubcategoriesSummary(subRes.value.data?.subcategories || []);
      }
      if (brandRes.status === 'fulfilled') {
        setBrandsSummary(brandRes.value.data?.brands || []);
      }

      const anyRejected = results.some((r) => r.status === 'rejected');
      if (anyRejected) {
        setSnackbar({
          open: true,
          message: 'Some inventory lists failed to load. Try refresh.',
          severity: 'error'
        });
      }
    } catch (err) {
      console.error('Error fetching inventory entity summaries:', err);
      setSnackbar({
        open: true,
        message: err.response?.data?.error || 'Failed to fetch inventory management lists',
        severity: 'error'
      });
    }
  };

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/admin/inventory-analytics');
      if (response.data.success) {
        setAnalytics(response.data);
      } else {
        setError(response.data.error || 'Failed to fetch inventory analytics');
      }
    } catch (err) {
      console.error('Error fetching inventory analytics:', err);
      setError(err.response?.data?.error || err.message || 'Failed to fetch inventory analytics');
    } finally {
      setLoading(false);
    }
  };

  const fetchZeroPurchasePriceItems = async () => {
    try {
      setLoadingZeroPrice(true);
      const response = await api.get('/admin/drinks');
      const drinks = response.data || [];
      setAllDrinks(drinks);
      
      // Items where purchasePrice is 0, null, or undefined
      const zeroPurchaseItems = drinks.filter((drink) => {
        const purchasePrice = drink.purchasePrice;
        return (
          purchasePrice === null ||
               purchasePrice === undefined || 
               purchasePrice === '' ||
          parseFloat(purchasePrice) === 0
        );
      });

      // Items where selling price is not set at base level and has no valid non-default capacity pricing
      const zeroSellItems = drinks.filter((drink) => {
        const baseSelling = parseFloat(drink.price ?? drink.originalPrice);
        const hasPositiveBaseSelling = !Number.isNaN(baseSelling) && baseSelling > 0;
        const hasPositiveCapacitySelling =
          Array.isArray(drink.capacityPricing) &&
          drink.capacityPricing.some((entry) => {
            if (!entry || isDefaultCapacityLabel(entry.capacity)) return false;
            const cp = parseFloat(entry.currentPrice ?? entry.price);
            const op = parseFloat(entry.originalPrice ?? entry.price);
            return (!Number.isNaN(cp) && cp > 0) || (!Number.isNaN(op) && op > 0);
          });

        return !hasPositiveBaseSelling && !hasPositiveCapacitySelling;
      });

      // Items where selling price is set and greater than 0 (for price list)
      const pricedItems = drinks
        .filter((drink) => {
          const selling = drink.price ?? drink.originalPrice;
          const parsed = parseFloat(selling);
          return !Number.isNaN(parsed) && parsed > 0;
        })
        .sort((a, b) => {
          const categoryA = (a.category?.name || 'Uncategorized').toLowerCase();
          const categoryB = (b.category?.name || 'Uncategorized').toLowerCase();
          if (categoryA !== categoryB) return categoryA.localeCompare(categoryB);
          const brandA = (a.brand?.name || '').toLowerCase();
          const brandB = (b.brand?.name || '').toLowerCase();
          if (brandA !== brandB) return brandA.localeCompare(brandB);
          return (a.name || '').localeCompare(b.name || '');
        });

      const uncategorized = drinks
        .filter((drink) => !drink.category || !drink.category.name)
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

      const unbranded = drinks
        .filter((drink) => !drink.brand || !drink.brand.name)
        .sort((a, b) => {
          const categoryA = (a.category?.name || 'Uncategorized').toLowerCase();
          const categoryB = (b.category?.name || 'Uncategorized').toLowerCase();
          if (categoryA !== categoryB) return categoryA.localeCompare(categoryB);
          return (a.name || '').localeCompare(b.name || '');
        });

      const missingImages = drinks
        .filter((drink) => {
          const img = drink.image;
          if (img === null || img === undefined) return true;
          if (typeof img === 'string' && img.trim() === '') return true;
          return false;
        })
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

      setZeroPurchasePriceItems(zeroPurchaseItems);
      setZeroSellingPriceItems(zeroSellItems);
      setPriceListItems(pricedItems);
      setUncategorizedItems(uncategorized);
      setUnbrandedItems(unbranded);
      setMissingImageItems(missingImages);
    } catch (err) {
      console.error('Error fetching zero purchase price items:', err);
    } finally {
      setLoadingZeroPrice(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const isDefaultCapacityLabel = useCallback(
    (label) => typeof label === 'string' && label.trim().toLowerCase() === 'default',
    []
  );

  const getNormalizedNonDefaultCapacityPricing = (item, fallbackSellingPrice = null) => {
    if (!Array.isArray(item?.capacityPricing) || item.capacityPricing.length === 0) {
      return [];
    }

    return item.capacityPricing
      .filter((entry) => entry && !isDefaultCapacityLabel(entry.capacity))
      .map((entry) => {
        const current = parseFloat(entry.currentPrice ?? entry.price);
        const original = parseFloat(entry.originalPrice ?? entry.price);
        const resolved =
          !Number.isNaN(current) && current > 0
            ? current
            : !Number.isNaN(original) && original > 0
            ? original
            : fallbackSellingPrice && fallbackSellingPrice > 0
            ? fallbackSellingPrice
            : 0;

        return {
          capacity: entry.capacity,
          currentPrice: resolved,
          originalPrice:
            !Number.isNaN(original) && original > 0
              ? original
              : resolved
        };
      })
      .filter((entry) => entry.currentPrice > 0);
  };

  const handleEditClick = (item) => {
    setEditingItem(item.id);
    // Set purchase price - handle 0, null, undefined properly
    const purchasePriceValue = (item.purchasePrice !== null && item.purchasePrice !== undefined && item.purchasePrice !== '')
      ? String(item.purchasePrice)
      : (item.purchasePrice === 0 ? '0' : '');
    setEditPurchasePrice(purchasePriceValue);
    
    // Set selling price - use price or originalPrice, default to empty string
    const sellingPriceValue = (item.price || item.originalPrice)
      ? String(item.price || item.originalPrice)
      : '';
    setEditSellingPrice(sellingPriceValue);
    const capacityLabel = getCapacityLabel(item);
    setEditCapacity(capacityLabel === 'N/A' ? '' : capacityLabel);
    const rowCaps =
      capacityLabel === 'N/A'
        ? []
        : capacityLabel.split(',').map((c) => c.trim()).filter(Boolean);
    setEditCapacities(Array.from(new Set(rowCaps)));
    setNewCapacityValue('');
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
    setEditPurchasePrice('');
    setEditSellingPrice('');
    setEditCapacity('');
    setEditCapacities([]);
    setNewCapacityValue('');
  };

  const addCapacityToEditList = () => {
    const cap = String(newCapacityValue || '').trim();
    if (!cap || isDefaultCapacityLabel(cap)) return;
    setEditCapacities((prev) =>
      prev.some((existing) => String(existing || '').trim().toLowerCase() === cap.toLowerCase())
        ? prev
        : [...prev, cap]
    );
    setNewCapacityValue('');
  };

  const removeCapacityFromEditList = (cap) => {
    setEditCapacities((prev) => prev.filter((c) => c !== cap));
  };

  const handleAddGlobalCapacity = () => {
    const cap = String(newGlobalCapacity || '').trim();
    if (!cap || isDefaultCapacityLabel(cap)) {
      setSnackbar({
        open: true,
        message: 'Enter a valid capacity value',
        severity: 'warning'
      });
      return;
    }

    const exists = availableCapacities.some((value) => String(value || '').trim().toLowerCase() === cap.toLowerCase());
    if (exists) {
      setSnackbar({
        open: true,
        message: 'Capacity already exists',
        severity: 'info'
      });
      return;
    }

    const next = [...customCapacities, cap];
    setCustomCapacities(next);
    setNewGlobalCapacity('');
    window.localStorage.setItem(CUSTOM_CAPACITY_STORAGE_KEY, JSON.stringify(next));
    setSnackbar({
      open: true,
      message: 'Capacity added to inventory settings',
      severity: 'success'
    });
  };

  const handleStartEditCapacity = (capacity) => {
    setEditingCapacityValue(capacity);
    setEditCapacityValue(capacity);
  };

  const handleCancelEditCapacity = () => {
    setEditingCapacityValue('');
    setEditCapacityValue('');
  };

  const handleSaveEditCapacity = async (oldCapacity) => {
    const nextCapacity = String(editCapacityValue || '').trim();
    if (!nextCapacity || isDefaultCapacityLabel(nextCapacity)) {
      setSnackbar({ open: true, message: 'Enter a valid capacity', severity: 'warning' });
      return;
    }

    if (oldCapacity.toLowerCase() === nextCapacity.toLowerCase()) {
      handleCancelEditCapacity();
      return;
    }

    try {
      await api.post('/admin/inventory/capacities/rename', {
        oldCapacity,
        newCapacity: nextCapacity
      });

      const nextCustomCapacities = customCapacities.map((value) =>
        String(value || '').trim().toLowerCase() === oldCapacity.toLowerCase() ? nextCapacity : value
      );
      setCustomCapacities(nextCustomCapacities);
      window.localStorage.setItem(CUSTOM_CAPACITY_STORAGE_KEY, JSON.stringify(nextCustomCapacities));

      setSnackbar({ open: true, message: 'Capacity updated successfully', severity: 'success' });
      await fetchZeroPurchasePriceItems();
      handleCancelEditCapacity();
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.error || 'Failed to update capacity',
        severity: 'error'
      });
    }
  };

  const handleDeleteCapacityWithTransfer = async (sourceCapacity) => {
    const targetCapacity = String(capacityTransferMap[sourceCapacity] || '').trim();
    if (!targetCapacity) {
      setSnackbar({ open: true, message: 'Select target capacity first', severity: 'error' });
      return;
    }

    if (!window.confirm(`Delete capacity "${sourceCapacity}" and transfer to "${targetCapacity}"?`)) {
      return;
    }

    try {
      await api.post('/admin/inventory/capacities/delete-with-transfer', {
        sourceCapacity,
        targetCapacity
      });

      const nextCustomCapacities = customCapacities.filter(
        (value) => String(value || '').trim().toLowerCase() !== sourceCapacity.toLowerCase()
      );
      setCustomCapacities(nextCustomCapacities);
      window.localStorage.setItem(CUSTOM_CAPACITY_STORAGE_KEY, JSON.stringify(nextCustomCapacities));

      setCapacityTransferMap((prev) => {
        const next = { ...prev };
        delete next[sourceCapacity];
        return next;
      });

      if (editingCapacityValue && editingCapacityValue.toLowerCase() === sourceCapacity.toLowerCase()) {
        handleCancelEditCapacity();
      }

      setSnackbar({
        open: true,
        message: `Capacity "${sourceCapacity}" deleted and transferred`,
        severity: 'success'
      });

      await fetchZeroPurchasePriceItems();
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.error || 'Failed to delete capacity with transfer',
        severity: 'error'
      });
    }
  };

  const handleAddCategory = async () => {
    const name = String(newCategoryName || '').trim();
    if (!name) {
      setSnackbar({ open: true, message: 'Enter category name', severity: 'warning' });
      return;
    }
    try {
      await api.post('/categories', { name, isActive: true });
      setNewCategoryName('');
      setSnackbar({ open: true, message: 'Category added successfully', severity: 'success' });
      await Promise.all([fetchInventoryEntitySummaries(), fetchZeroPurchasePriceItems()]);
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.error || 'Failed to add category',
        severity: 'error'
      });
    }
  };

  const handleAddBrand = async () => {
    const name = String(newBrandName || '').trim();
    if (!name) {
      setSnackbar({ open: true, message: 'Enter brand name', severity: 'warning' });
      return;
    }
    try {
      await api.post('/brands', { name, isActive: true });
      setNewBrandName('');
      setSnackbar({ open: true, message: 'Brand added successfully', severity: 'success' });
      await Promise.all([fetchInventoryEntitySummaries(), fetchZeroPurchasePriceItems()]);
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.error || 'Failed to add brand',
        severity: 'error'
      });
    }
  };

  const getPriceListRowKey = (entry) => `${entry.item.id}::${entry.capacity}`;

  const handleEditPriceListRow = (entry) => {
    setEditingPriceListKey(getPriceListRowKey(entry));
    setEditPriceListSellingPrice(String(entry.sellingPrice ?? ''));
  };

  const handleCancelPriceListEdit = () => {
    setEditingPriceListKey(null);
    setEditPriceListSellingPrice('');
  };

  const handleSavePriceListRow = async (entry) => {
    try {
      const item = entry.item;
      const parsedSellingPrice = parseFloat(String(editPriceListSellingPrice || '').trim());
      if (Number.isNaN(parsedSellingPrice) || parsedSellingPrice <= 0) {
        setSnackbar({ open: true, message: 'Selling price must be greater than 0', severity: 'error' });
        return;
      }

      const categoryId = item.categoryId || item.category?.id;
      if (!categoryId) {
        setSnackbar({ open: true, message: 'Cannot update: Category ID is missing', severity: 'error' });
        return;
      }

      setSaving(true);

      const updates = {
        name: item.name || '',
        categoryId,
        subCategoryId: item.subCategoryId || item.subCategory?.id || null,
        brandId: item.brandId || item.brand?.id || null
      };

      const normalizedCapacity = String(entry.capacity || '').trim();
      const hasSpecificCapacity = normalizedCapacity && normalizedCapacity !== 'N/A' && !isDefaultCapacityLabel(normalizedCapacity);

      if (!hasSpecificCapacity) {
        updates.price = parsedSellingPrice;
      } else {
        const existingPricing = getNormalizedNonDefaultCapacityPricing(item, parsedSellingPrice);
        const existingByCapacity = new Map(existingPricing.map((row) => [String(row.capacity || '').trim(), row]));

        const itemCapacities = Array.isArray(item.capacity)
          ? item.capacity
              .map((cap) => String(cap || '').trim())
              .filter((cap) => cap && !isDefaultCapacityLabel(cap))
          : [];
        const mergedCaps = Array.from(new Set([...itemCapacities, ...existingPricing.map((row) => row.capacity), normalizedCapacity]));

        const baseFallbackPriceRaw = item.price ?? item.originalPrice ?? parsedSellingPrice;
        const baseFallbackPrice = Number.isNaN(parseFloat(baseFallbackPriceRaw))
          ? parsedSellingPrice
          : parseFloat(baseFallbackPriceRaw);

        updates.capacity = mergedCaps;
        updates.capacityPricing = mergedCaps.map((cap) => {
          const existing = existingByCapacity.get(cap);
          const nextPrice = cap === normalizedCapacity ? parsedSellingPrice : (existing?.currentPrice ?? existing?.price ?? baseFallbackPrice);
          return {
            capacity: cap,
            currentPrice: nextPrice,
            originalPrice: existing?.originalPrice ?? nextPrice
          };
        });
      }

      await api.put(`/admin/drinks/${item.id}`, updates);
      setSnackbar({ open: true, message: 'Price updated successfully', severity: 'success' });

      await Promise.all([fetchAnalytics(), fetchZeroPurchasePriceItems()]);
      handleCancelPriceListEdit();
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.error || 'Failed to update price',
        severity: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (item) => {
    try {
      setSaving(true);
      
      // Get categoryId - could be from item.categoryId or item.category.id
      const categoryId = item.categoryId || item.category?.id;
      if (!categoryId) {
        setSnackbar({ 
          open: true, 
          message: 'Cannot update: Category ID is missing', 
          severity: 'error' 
        });
        setSaving(false);
        return;
      }
      
      const updates = {
        name: item.name || '', // Required by backend
        categoryId: categoryId, // Required by backend
        subCategoryId: item.subCategoryId || item.subCategory?.id || null,
        brandId: item.brandId || item.brand?.id || null
      };
      
      // Always update purchase price when in edit mode
      // Convert to string, trim, and parse - handle empty string as 0
      const trimmedPurchasePrice = String(editPurchasePrice || '').trim();
      if (trimmedPurchasePrice === '') {
        updates.purchasePrice = 0; // Allow setting to 0
      } else {
        const parsedPurchasePrice = parseFloat(trimmedPurchasePrice);
        if (!isNaN(parsedPurchasePrice) && parsedPurchasePrice >= 0) {
          updates.purchasePrice = parsedPurchasePrice;
        } else {
          setSnackbar({ 
            open: true, 
            message: 'Invalid purchase price', 
            severity: 'error' 
          });
          setSaving(false);
          return;
        }
      }
      
      // Always update selling price when in edit mode
      // Selling price must be greater than 0
      const trimmedSellingPrice = String(editSellingPrice || '').trim();
      if (trimmedSellingPrice === '') {
        setSnackbar({ 
          open: true, 
          message: 'Selling price cannot be empty', 
          severity: 'error' 
        });
        setSaving(false);
        return;
      } else {
        const parsedSellingPrice = parseFloat(trimmedSellingPrice);
        if (!isNaN(parsedSellingPrice) && parsedSellingPrice > 0) {
          updates.price = parsedSellingPrice;
          const selectedCapacities = Array.from(
            new Set(
              editCapacities
                .map((c) => String(c || '').trim())
                .filter((c) => c && !isDefaultCapacityLabel(c))
            )
          );
          const existingPricing = getNormalizedNonDefaultCapacityPricing(item, parsedSellingPrice);
          const existingByCapacity = new Map(existingPricing.map((entry) => [entry.capacity, entry]));
          const mergedPricing = selectedCapacities.map((cap) => {
            const existing = existingByCapacity.get(cap);
            return {
              capacity: cap,
              currentPrice: parsedSellingPrice,
              originalPrice: existing?.originalPrice || parsedSellingPrice
            };
          });

          updates.capacityPricing = mergedPricing;
          updates.capacity = selectedCapacities;
        } else {
          setSnackbar({ 
            open: true, 
            message: 'Selling price must be greater than 0', 
            severity: 'error' 
          });
          setSaving(false);
          return;
        }
      }
      
      console.log('Saving updates:', updates);
      await api.put(`/admin/drinks/${item.id}`, updates);
      
      setSnackbar({ 
        open: true, 
        message: 'Item updated successfully', 
        severity: 'success' 
      });
      
      // Refresh both analytics and zero price items
      await Promise.all([
        fetchAnalytics(),
        fetchZeroPurchasePriceItems()
      ]);
      
      handleCancelEdit();
    } catch (err) {
      console.error('Error saving item:', err);
      setSnackbar({ 
        open: true, 
        message: err.response?.data?.error || 'Failed to update item', 
        severity: 'error' 
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategoryWithTransfer = async (category) => {
    const targetCategoryId = parseInt(categoryTransferMap[category.id], 10);
    if (!targetCategoryId) {
      setSnackbar({ open: true, message: 'Select target category first', severity: 'error' });
      return;
    }
    if (!window.confirm(`Delete category "${category.name}" and transfer drinks?`)) return;
    try {
      await api.post(`/admin/inventory/categories/${category.id}/delete-with-transfer`, { targetCategoryId });
      setSnackbar({ open: true, message: `Deleted category ${category.name}`, severity: 'success' });
      await Promise.all([fetchInventoryEntitySummaries(), fetchAnalytics(), fetchZeroPurchasePriceItems()]);
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.error || 'Failed to delete category',
        severity: 'error'
      });
    }
  };

  const handleDeleteSubcategoryWithTransfer = async (subcategory) => {
    const targetSubCategoryId = parseInt(subCategoryTransferMap[subcategory.id], 10);
    if (!targetSubCategoryId) {
      setSnackbar({ open: true, message: 'Select target subcategory first', severity: 'error' });
      return;
    }
    if (!window.confirm(`Delete subcategory "${subcategory.name}" and transfer drinks?`)) return;
    try {
      await api.post(`/admin/inventory/subcategories/${subcategory.id}/delete-with-transfer`, { targetSubCategoryId });
      setSnackbar({ open: true, message: `Deleted subcategory ${subcategory.name}`, severity: 'success' });
      await Promise.all([fetchInventoryEntitySummaries(), fetchAnalytics(), fetchZeroPurchasePriceItems()]);
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.error || 'Failed to delete subcategory',
        severity: 'error'
      });
    }
  };

  const handleDeleteBrandWithTransfer = async (brand) => {
    const targetBrandId = parseInt(brandTransferMap[brand.id], 10);
    if (!targetBrandId) {
      setSnackbar({ open: true, message: 'Select target brand first', severity: 'error' });
      return;
    }
    if (!window.confirm(`Delete brand "${brand.name}" and transfer drinks?`)) return;
    try {
      await api.post(`/admin/inventory/brands/${brand.id}/delete-with-transfer`, { targetBrandId });
      setSnackbar({ open: true, message: `Deleted brand ${brand.name}`, severity: 'success' });
      await Promise.all([fetchInventoryEntitySummaries(), fetchAnalytics(), fetchZeroPurchasePriceItems()]);
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.error || 'Failed to delete brand',
        severity: 'error'
      });
    }
  };

  const exportToCsv = (filename, rows, columns) => {
    if (!rows || rows.length === 0) return;
    const header = columns.map((c) => c.label).join(',');
    const lines = rows.map((row) =>
      columns
        .map((c) => {
          const raw = typeof c.value === 'function' ? c.value(row) : row[c.value];
          const cell = raw != null ? String(raw) : '';
          const escaped = cell.replace(/"/g, '""');
          return `"${escaped}"`;
        })
        .join(',')
    );
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportOutOfStock = () => {
    if (!analytics?.outOfStock?.items?.length) return;
    exportToCsv('out-of-stock-items.csv', analytics.outOfStock.items, [
      { label: 'ID', value: (item) => item.id },
      { label: 'Name', value: (item) => item.name },
      { label: 'Category', value: (item) => item.category?.name || '' },
      { label: 'Stock', value: (item) => item.stock },
      { label: 'Purchase Price', value: (item) => item.purchasePrice },
      { label: 'Selling Price', value: (item) => item.price ?? item.originalPrice }
    ]);
  };

  const handleExportZeroPurchase = () => {
    if (!zeroPurchasePriceItems.length) return;
    exportToCsv('zero-purchase-price-items.csv', zeroPurchasePriceItems, [
      { label: 'ID', value: (item) => item.id },
      { label: 'Name', value: (item) => item.name },
      { label: 'Category', value: (item) => item.category?.name || '' },
      { label: 'Stock', value: (item) => item.stock || 0 },
      { label: 'Purchase Price', value: (item) => item.purchasePrice },
      { label: 'Selling Price', value: (item) => item.price ?? item.originalPrice }
    ]);
  };

  const handleExportZeroSelling = () => {
    if (!zeroSellingCapacityRows.length) return;
    exportToCsv('zero-selling-price-items.csv', zeroSellingCapacityRows, [
      { label: 'ID', value: (row) => row.item.id },
      { label: 'Name', value: (row) => row.item.name },
      { label: 'Category', value: (row) => row.item.category?.name || '' },
      { label: 'Brand', value: (row) => row.item.brand?.name || '' },
      { label: 'Capacity', value: (row) => row.capacity },
      { label: 'Stock', value: (row) => row.stock || 0 },
      { label: 'Purchase Price', value: (row) => row.item.purchasePrice },
      { label: 'Selling Price', value: (row) => row.sellingPrice }
    ]);
  };

  const handleExportSlowMoving = () => {
    if (!analytics?.slowMoving?.items?.length) return;
    exportToCsv('slow-moving-stock.csv', analytics.slowMoving.items, [
      { label: 'ID', value: (item) => item.id },
      { label: 'Name', value: (item) => item.name },
      { label: 'Category', value: (item) => item.category?.name || '' },
      { label: 'Stock', value: (item) => item.stock },
      { label: 'Purchase Price', value: (item) => item.purchasePrice },
      { label: 'Selling Price', value: (item) => item.price ?? item.originalPrice },
      { label: 'Last Sold Date', value: (item) => item.lastSoldDate || '' }
    ]);
  };

  const handleExportPriceList = () => {
    if (!priceListCapacityRows.length) return;
    exportToCsv('price-list.csv', priceListCapacityRows, [
      { label: 'ID', value: (row) => row.item.id },
      { label: 'Name', value: (row) => row.item.name },
      { label: 'Category', value: (row) => row.item.category?.name || '' },
      { label: 'Brand', value: (row) => row.item.brand?.name || '' },
      { label: 'Capacity', value: (row) => row.capacity },
      { label: 'Stock', value: (row) => row.stock },
      { label: 'Selling Price', value: (row) => row.sellingPrice }
    ]);
  };

  const handleExportStockValuation = () => {
    if (!stockValuationRows.length) return;
    exportToCsv('stock-valuation.csv', stockValuationRows, [
      { label: 'ID', value: (row) => row.item.id },
      { label: 'Name', value: (row) => row.item.name },
      { label: 'Category', value: (row) => row.item.category?.name || '' },
      { label: 'Brand', value: (row) => row.item.brand?.name || '' },
      { label: 'Capacity', value: (row) => row.capacity },
      { label: 'Stock', value: (row) => row.stock },
      { label: 'Selling Price', value: (row) => row.sellingPrice },
      { label: 'Total Valuation', value: (row) => row.totalValuation }
    ]);
  };

  const exportButtonSx = {
    backgroundColor: '#00E0B8',
    color: '#000000',
    borderColor: '#00E0B8',
    '&:hover': {
      backgroundColor: '#00C4A3',
      borderColor: '#00C4A3',
      color: '#000000'
    },
    '&.Mui-disabled': {
      backgroundColor: '#BDBDBD',
      borderColor: '#BDBDBD',
      color: '#000000'
    }
  };

  const priceListCapacityRows = useMemo(() => {
    const rows = [];

    priceListItems.forEach((item) => {
      const capacityRows = Array.isArray(item.capacityPricing)
        ? item.capacityPricing
            .filter((entry) => entry && entry.capacity && !isDefaultCapacityLabel(entry.capacity))
            .map((entry) => {
              const sellingPriceRaw = entry.currentPrice ?? entry.price ?? entry.originalPrice ?? item.price ?? item.originalPrice ?? 0;
              const parsedPrice = parseFloat(sellingPriceRaw);
              const sellingPrice = Number.isNaN(parsedPrice) ? 0 : parsedPrice;
              return {
                item,
                capacity: String(entry.capacity),
                stock: getCapacityStock(item, String(entry.capacity)),
                sellingPrice
              };
            })
            .filter((row) => row.sellingPrice > 0)
        : [];

      if (capacityRows.length > 0) {
        rows.push(...capacityRows);
      } else {
        const basePriceRaw = item.price ?? item.originalPrice ?? 0;
        const parsedBasePrice = parseFloat(basePriceRaw);
        const basePrice = Number.isNaN(parsedBasePrice) ? 0 : parsedBasePrice;
        if (basePrice > 0) {
          const capacities = Array.isArray(item.capacity)
            ? Array.from(
                new Set(
                  item.capacity
                    .map((cap) => String(cap || '').trim())
                    .filter((cap) => cap && !isDefaultCapacityLabel(cap))
                )
              )
            : [];

          if (capacities.length > 0) {
            capacities.forEach((cap) => {
              rows.push({
                item,
                capacity: cap,
                stock: getCapacityStock(item, cap),
                sellingPrice: basePrice
              });
            });
          } else {
            const fallbackCapacityLabel =
              Array.isArray(item?.capacityPricing) && item.capacityPricing.length > 0
                ? Array.from(
                    new Set(
                      item.capacityPricing
                        .map((entry) => entry?.capacity)
                        .filter((cap) => cap && !isDefaultCapacityLabel(cap))
                    )
                  ).join(', ') || 'N/A'
                : Array.isArray(item?.capacity) && item.capacity.length > 0
                ? Array.from(new Set(item.capacity.filter((cap) => cap && !isDefaultCapacityLabel(cap)))).join(', ') || 'N/A'
                : 'N/A';
            rows.push({
              item,
              capacity: fallbackCapacityLabel,
              stock: parseInt(item.stock, 10) || 0,
              sellingPrice: basePrice
            });
          }
        }
      }
    });

    return rows;
  }, [priceListItems, isDefaultCapacityLabel]);

  const zeroSellingCapacityRows = useMemo(() => {
    const rows = [];

    zeroSellingPriceItems.forEach((item) => {
      const capacityRows = Array.isArray(item.capacityPricing)
        ? item.capacityPricing
            .filter((entry) => entry && entry.capacity && !isDefaultCapacityLabel(entry.capacity))
            .map((entry) => {
              const capacity = String(entry.capacity);
              const sellingPriceRaw = entry.currentPrice ?? entry.price ?? item.price ?? item.originalPrice ?? 0;
              const parsedPrice = parseFloat(sellingPriceRaw);
              const sellingPrice = Number.isNaN(parsedPrice) ? 0 : parsedPrice;
              return {
                key: `${item.id}-${capacity}`,
                item,
                capacity,
                stock: getCapacityStock(item, capacity),
                sellingPrice
              };
            })
        : [];

      if (capacityRows.length > 0) {
        rows.push(...capacityRows);
        return;
      }

      const capacities = Array.isArray(item.capacity)
        ? Array.from(
            new Set(
              item.capacity
                .map((cap) => String(cap || '').trim())
                .filter((cap) => cap && !isDefaultCapacityLabel(cap))
            )
          )
        : [];

      if (capacities.length > 0) {
        capacities.forEach((capacity) => {
          const sellingPriceRaw = item.price ?? item.originalPrice ?? 0;
          const parsedPrice = parseFloat(sellingPriceRaw);
          const sellingPrice = Number.isNaN(parsedPrice) ? 0 : parsedPrice;
          rows.push({
            key: `${item.id}-${capacity}`,
            item,
            capacity,
            stock: getCapacityStock(item, capacity),
            sellingPrice
          });
        });
        return;
      }

      const sellingPriceRaw = item.price ?? item.originalPrice ?? 0;
      const parsedPrice = parseFloat(sellingPriceRaw);
      const sellingPrice = Number.isNaN(parsedPrice) ? 0 : parsedPrice;
      rows.push({
        key: `${item.id}-N/A`,
        item,
        capacity: 'N/A',
        stock: parseInt(item.stock, 10) || 0,
        sellingPrice
      });
    });

    return rows;
  }, [zeroSellingPriceItems, isDefaultCapacityLabel]);

  const availableCapacities = useMemo(() => {
    const detected = [];
    allDrinks.forEach((item) => {
      if (Array.isArray(item.capacityPricing)) {
        item.capacityPricing.forEach((entry) => {
          const cap = String(entry?.capacity || '').trim();
          if (cap && !isDefaultCapacityLabel(cap)) detected.push(cap);
        });
      }
      if (Array.isArray(item.capacity)) {
        item.capacity.forEach((capValue) => {
          const cap = String(capValue || '').trim();
          if (cap && !isDefaultCapacityLabel(cap)) detected.push(cap);
        });
      }
    });

    const unique = [];
    const seen = new Set();
    [...detected, ...customCapacities].forEach((cap) => {
      const normalized = String(cap || '').trim();
      const key = normalized.toLowerCase();
      if (!normalized || seen.has(key) || isDefaultCapacityLabel(normalized)) return;
      seen.add(key);
      unique.push(normalized);
    });

    return unique.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }, [allDrinks, customCapacities, isDefaultCapacityLabel]);

  const filteredAvailableCapacities = useMemo(() => {
    const q = String(capacitySettingsSearch || '').trim().toLowerCase();
    if (!q) return availableCapacities;
    return availableCapacities.filter((value) => String(value || '').toLowerCase().includes(q));
  }, [availableCapacities, capacitySettingsSearch]);

  const stockValuationRows = useMemo(() => {
    const rows = [];

    allDrinks.forEach((item) => {
      const pricingRows = Array.isArray(item.capacityPricing)
        ? item.capacityPricing.filter((entry) => entry && entry.capacity && !isDefaultCapacityLabel(entry.capacity))
        : [];

      if (pricingRows.length > 0) {
        pricingRows.forEach((entry) => {
          const capacity = String(entry.capacity);
          const sellingPriceRaw = entry.currentPrice ?? entry.price ?? entry.originalPrice ?? item.price ?? item.originalPrice ?? 0;
          const parsedPrice = parseFloat(sellingPriceRaw);
          const sellingPrice = Number.isNaN(parsedPrice) ? 0 : parsedPrice;
          const stock = getCapacityStock(item, capacity);
          rows.push({
            key: `${item.id}-${capacity}`,
            item,
            capacity,
            stock,
            sellingPrice,
            totalValuation: stock * sellingPrice
          });
        });
        return;
      }

      const capacities = Array.isArray(item.capacity)
        ? Array.from(
            new Set(
              item.capacity
                .map((cap) => String(cap || '').trim())
                .filter((cap) => cap && !isDefaultCapacityLabel(cap))
            )
          )
        : [];

      const basePriceRaw = item.price ?? item.originalPrice ?? 0;
      const parsedBasePrice = parseFloat(basePriceRaw);
      const basePrice = Number.isNaN(parsedBasePrice) ? 0 : parsedBasePrice;

      if (capacities.length > 0) {
        capacities.forEach((capacity) => {
          const stock = getCapacityStock(item, capacity);
          rows.push({
            key: `${item.id}-${capacity}`,
            item,
            capacity,
            stock,
            sellingPrice: basePrice,
            totalValuation: stock * basePrice
          });
        });
      } else {
        const stock = parseInt(item.stock, 10) || 0;
        rows.push({
          key: `${item.id}-no-capacity`,
          item,
          capacity: 'N/A',
          stock,
          sellingPrice: basePrice,
          totalValuation: stock * basePrice
        });
      }
    });

    return rows;
  }, [allDrinks, isDefaultCapacityLabel]);

  const filteredStockValuationRows = useMemo(
    () =>
      filterByQuery(stockValuationRows, stockValuationSearch, (row) =>
        `${row.item.name} ${row.item.category?.name || ''} ${row.item.brand?.name || ''} ${row.capacity}`
      ),
    [stockValuationRows, stockValuationSearch]
  );

  const stockValuationTableTotal = useMemo(
    () => stockValuationRows.reduce((sum, row) => sum + (Number(row.totalValuation) || 0), 0),
    [stockValuationRows]
  );

  function filterByQuery(items, query, pickText) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => String(pickText(item) || '').toLowerCase().includes(q));
  }

  const filteredOutOfStockItems = useMemo(
    () =>
      filterByQuery(analytics?.outOfStock?.items || [], outOfStockSearch, (item) =>
        `${item.name} ${item.category?.name || ''}`
      ),
    [analytics, outOfStockSearch]
  );

  const filteredZeroPurchaseItems = useMemo(
    () =>
      filterByQuery(zeroPurchasePriceItems, zeroPurchaseSearch, (item) =>
        `${item.name} ${item.category?.name || ''}`
      ),
    [zeroPurchasePriceItems, zeroPurchaseSearch]
  );

  const filteredZeroSellingCapacityRows = useMemo(
    () =>
      filterByQuery(zeroSellingCapacityRows, zeroSellingSearch, (row) =>
        `${row.item.name} ${row.item.category?.name || ''} ${row.item.brand?.name || ''} ${row.capacity}`
      ),
    [zeroSellingCapacityRows, zeroSellingSearch]
  );

  const priceListSubcategoryOptions = useMemo(() => {
    const names = [];
    priceListCapacityRows.forEach((entry) => {
      const subcategoryName = String(entry?.item?.subCategory?.name || '').trim();
      if (subcategoryName) names.push(subcategoryName);
    });
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [priceListCapacityRows]);

  const filteredPriceListCapacityRows = useMemo(
    () =>
      filterByQuery(
        priceListCapacityRows.filter((entry) => {
          if (!priceListSubcategoryFilter) return true;
          return (entry?.item?.subCategory?.name || '') === priceListSubcategoryFilter;
        }),
        priceListSearch,
        (entry) =>
          `${entry.item.name} ${entry.item.category?.name || ''} ${entry.item.subCategory?.name || ''} ${entry.item.brand?.name || ''} ${entry.capacity}`
      ),
    [priceListCapacityRows, priceListSearch, priceListSubcategoryFilter]
  );

  const sortedFilteredPriceListCapacityRows = useMemo(() => {
    const sorted = [...filteredPriceListCapacityRows];
    sorted.sort((a, b) => {
      const categoryA = (a.item.category?.name || 'Uncategorized').toLowerCase();
      const categoryB = (b.item.category?.name || 'Uncategorized').toLowerCase();
      if (categoryA !== categoryB) return categoryA.localeCompare(categoryB);
      const stockA = Number(a.stock || 0);
      const stockB = Number(b.stock || 0);
      if (stockA !== stockB) {
        return priceListSortDirection === 'asc' ? stockA - stockB : stockB - stockA;
      }
      return (a.item.name || '').localeCompare(b.item.name || '');
    });
    return sorted;
  }, [filteredPriceListCapacityRows, priceListSortDirection]);

  const groupedFilteredPriceListRows = useMemo(() => {
    const rows = [];
    let currentCategory = null;
    sortedFilteredPriceListCapacityRows.forEach((entry, index) => {
      const categoryName = entry.item.category?.name || 'Uncategorized';
      if (categoryName !== currentCategory) {
        rows.push({ type: 'group', key: `group-filtered-${categoryName}`, category: categoryName });
        currentCategory = categoryName;
      }
      rows.push({ type: 'item', key: `item-filtered-${entry.item.id}-${entry.capacity}-${index}`, entry });
    });
    return rows;
  }, [sortedFilteredPriceListCapacityRows]);

  const filteredUncategorizedItems = useMemo(
    () => filterByQuery(uncategorizedItems, uncategorizedSearch, (item) => `${item.name} ${item.brand?.name || ''}`),
    [uncategorizedItems, uncategorizedSearch]
  );

  const filteredUnbrandedItems = useMemo(
    () => filterByQuery(unbrandedItems, unbrandedSearch, (item) => `${item.name} ${item.category?.name || ''}`),
    [unbrandedItems, unbrandedSearch]
  );

  const filteredMissingImageItems = useMemo(
    () =>
      filterByQuery(missingImageItems, missingImageSearch, (item) => {
        const brandName = item.brand?.name || '';
        const categoryName = item.category?.name || '';
        return `${item.name} ${brandName} ${categoryName}`;
      }),
    [missingImageItems, missingImageSearch]
  );

  const filteredCategoriesSummary = useMemo(
    () => filterByQuery(categoriesSummary, categoriesSearch, (item) => item.name),
    [categoriesSummary, categoriesSearch]
  );

  const filteredSubcategoriesSummary = useMemo(
    () => filterByQuery(subcategoriesSummary, subcategoriesSearch, (item) => `${item.name} ${item.categoryName || ''}`),
    [subcategoriesSummary, subcategoriesSearch]
  );

  const filteredBrandsSummary = useMemo(
    () => filterByQuery(brandsSummary, brandsSearch, (item) => item.name),
    [brandsSummary, brandsSearch]
  );

  const filteredSlowMovingItems = useMemo(
    () =>
      filterByQuery(analytics?.slowMoving?.items || [], slowMovingSearch, (item) =>
        `${item.name} ${item.category?.name || ''}`
      ),
    [analytics, slowMovingSearch]
  );

  function getCapacityStock(item, capacityLabel) {
    const byCap =
      item?.stockByCapacity && typeof item.stockByCapacity === 'object'
        ? item.stockByCapacity
        : null;

    const mainStock = parseInt(item?.stock, 10) || 0;

    if (byCap && byCap[capacityLabel] != null) {
      const parsed = parseInt(byCap[capacityLabel], 10);
      return Number.isNaN(parsed) ? 0 : parsed;
    }

    // If stockByCapacity is not initialized (or missing this specific capacity),
    // fall back to the legacy aggregate stock so capacities remain purchasable.
    // This matches the pre-per-capacity behavior where `drink.stock` was the source of truth.
    if (!byCap) {
      return mainStock;
    }

    // When stockByCapacity exists, a missing capacity key should be treated as zero.
    // Falling back to mainStock for every missing capacity duplicates totals across variants.
    if (byCap && byCap[capacityLabel] == null) return 0;

    // Fallback: if item has exactly one capacity and matches this column, use main stock.
    const itemCaps = Array.isArray(item?.capacityPricing) && item.capacityPricing.length > 0
      ? item.capacityPricing.map((p) => p?.capacity).filter(Boolean)
      : Array.isArray(item?.capacity)
        ? item.capacity.filter(Boolean)
        : [];

    if (itemCaps.length === 1 && itemCaps[0] === capacityLabel) return mainStock;

    return 0;
  }

  function getCapacityLabel(item) {
    if (Array.isArray(item?.capacityPricing) && item.capacityPricing.length > 0) {
      const capacities = item.capacityPricing
        .map((entry) => entry?.capacity)
        .filter((cap) => cap && !isDefaultCapacityLabel(cap));
      if (capacities.length > 0) return Array.from(new Set(capacities)).join(', ');
    }
    if (Array.isArray(item?.capacity) && item.capacity.length > 0) {
      const capacities = item.capacity.filter((cap) => cap && !isDefaultCapacityLabel(cap));
      if (capacities.length > 0) return Array.from(new Set(capacities)).join(', ');
    }
    return 'N/A';
  }

  const getCapacityOptions = (item) => {
    const values = [...availableCapacities];

    if (Array.isArray(item?.capacityPricing) && item.capacityPricing.length > 0) {
      item.capacityPricing.forEach((entry) => {
        if (entry?.capacity && !isDefaultCapacityLabel(entry.capacity)) {
          values.push(String(entry.capacity));
        }
      });
    }

    if (Array.isArray(item?.capacity) && item.capacity.length > 0) {
      item.capacity.forEach((cap) => {
        if (cap && !isDefaultCapacityLabel(cap)) values.push(String(cap));
      });
    }

    // Common capacity presets for quick correction in Copilot table
    values.push(
      '250ml',
      '330ml',
      '500ml',
      '700ml',
      '750ml',
      '1L',
      '1.25L',
      '1.5L',
      '1.5 Litres',
      '5L',
      '5 Litres'
    );

    if (editCapacity && editCapacity.trim()) values.push(editCapacity.trim());
    if (Array.isArray(editCapacities) && editCapacities.length > 0) values.push(...editCapacities);

    return Array.from(new Set(values));
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!analytics) {
    return (
      <Alert severity="info">
        No inventory data available
      </Alert>
    );
  }

  return (
    <Container maxWidth="xl">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1, color: colors.textPrimary }}>
          Inventory Analytics
        </Typography>
        <Typography variant="body1" sx={{ color: colors.textSecondary }}>
          Stock valuation, out of stock items, and slow-moving inventory insights
        </Typography>
      </Box>

      <Box sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={copilotTab}
          onChange={(e, newValue) => setCopilotTab(newValue)}
          sx={{
            '& .MuiTab-root': {
              color: colors.textSecondary,
              '&.Mui-selected': {
                color: colors.accentText
              }
            },
            '& .MuiTabs-indicator': {
              backgroundColor: colors.accentText
            }
          }}
        >
          <Tab label="Analytics" />
          <Tab label="Copilot Inventory" />
          <Tab label="Inventory Settings" />
        </Tabs>
      </Box>

      {/* Stock Valuation Card */}
      {copilotTab === 0 && (
        <Grid container spacing={2} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card
              sx={{
                height: '100%',
                borderRadius: 3,
                border: `2px solid transparent`,
                backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.14)' : 'rgba(0, 224, 184, 0.10)',
                boxShadow: isDarkMode ? '0 4px 14px rgba(0,0,0,0.25)' : '0 2px 12px rgba(0,0,0,0.08)',
                transition: 'all 0.2s ease',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: isDarkMode ? '0 8px 24px rgba(0,0,0,0.35)' : '0 6px 20px rgba(0,0,0,0.12)',
                  borderColor: colors.accentText,
                  backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.20)' : 'rgba(0, 224, 184, 0.14)'
                }
              }}
            >
                  <CardContent
                    sx={{
                      p: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1.5
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.accentText }}>
                      <AttachMoney sx={{ color: colors.accentText, fontSize: 30 }} />
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: 0 }}>
                      <Typography variant="subtitle1" sx={{ color: colors.textPrimary, fontWeight: 700, lineHeight: 1.1 }}>
                        Stock Valuation
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 800, color: colors.accentText, lineHeight: 1.1 }}>
                        {formatCurrency(stockValuationTableTotal)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                        Total value of {stockValuationRows.length} item-capacity rows
                      </Typography>
                    </Box>
                  </CardContent>
          </Card>
        </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card
              sx={{
                height: '100%',
                borderRadius: 3,
                border: `2px solid transparent`,
                backgroundColor: isDarkMode ? 'rgba(158, 158, 158, 0.18)' : 'rgba(158, 158, 158, 0.16)',
                boxShadow: isDarkMode ? '0 4px 14px rgba(0,0,0,0.25)' : '0 2px 12px rgba(0,0,0,0.08)',
                transition: 'all 0.2s ease',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: isDarkMode ? '0 8px 24px rgba(0,0,0,0.35)' : '0 6px 20px rgba(0,0,0,0.12)',
                  borderColor: '#9E9E9E',
                  backgroundColor: isDarkMode ? 'rgba(158, 158, 158, 0.24)' : 'rgba(158, 158, 158, 0.22)'
                }
              }}
            >
                  <CardContent
                    sx={{
                      p: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1.5
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FF3366' }}>
                      <Warning sx={{ color: '#FF3366', fontSize: 30 }} />
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: 0 }}>
                      <Typography variant="subtitle1" sx={{ color: colors.textPrimary, fontWeight: 700, lineHeight: 1.1 }}>
                        Out of Stock
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 800, color: '#FF3366', lineHeight: 1.1 }}>
                        {analytics.outOfStock.count}
                      </Typography>
                      <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                        Items currently out of stock
                      </Typography>
                    </Box>
                  </CardContent>
          </Card>
        </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card
              sx={{
                height: '100%',
                borderRadius: 3,
                border: `2px solid transparent`,
                backgroundColor: isDarkMode ? 'rgba(158, 158, 158, 0.18)' : 'rgba(158, 158, 158, 0.16)',
                boxShadow: isDarkMode ? '0 4px 14px rgba(0,0,0,0.25)' : '0 2px 12px rgba(0,0,0,0.08)',
                transition: 'all 0.2s ease',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: isDarkMode ? '0 8px 24px rgba(0,0,0,0.35)' : '0 6px 20px rgba(0,0,0,0.12)',
                  borderColor: '#9E9E9E',
                  backgroundColor: isDarkMode ? 'rgba(158, 158, 158, 0.24)' : 'rgba(158, 158, 158, 0.22)'
                }
              }}
            >
                  <CardContent
                    sx={{
                      p: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1.5
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFA500' }}>
                      <TrendingDown sx={{ color: '#FFA500', fontSize: 30 }} />
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: 0 }}>
                      <Typography variant="subtitle1" sx={{ color: colors.textPrimary, fontWeight: 700, lineHeight: 1.1 }}>
                        Slow-Moving
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 800, color: '#FFA500', lineHeight: 1.1 }}>
                        {analytics.slowMoving.count}
                      </Typography>
                      <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                        No sales in ≥ {analytics.slowMoving.thresholdMonths} months
                      </Typography>
                    </Box>
                  </CardContent>
          </Card>
        </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card
              sx={{
                height: '100%',
                borderRadius: 3,
                border: `2px solid transparent`,
                backgroundColor: isDarkMode ? 'rgba(158, 158, 158, 0.18)' : 'rgba(158, 158, 158, 0.16)',
                boxShadow: isDarkMode ? '0 4px 14px rgba(0,0,0,0.25)' : '0 2px 12px rgba(0,0,0,0.08)',
                transition: 'all 0.2s ease',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: isDarkMode ? '0 8px 24px rgba(0,0,0,0.35)' : '0 6px 20px rgba(0,0,0,0.12)',
                  borderColor: '#9E9E9E',
                  backgroundColor: isDarkMode ? 'rgba(158, 158, 158, 0.24)' : 'rgba(158, 158, 158, 0.22)'
                }
              }}
            >
                  <CardContent
                    sx={{
                      p: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1.5
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFA500' }}>
                      <Warning sx={{ color: '#FFA500', fontSize: 30 }} />
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: 0 }}>
                      <Typography variant="subtitle1" sx={{ color: colors.textPrimary, fontWeight: 700, lineHeight: 1.1 }}>
                        Zero Purchase
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 800, color: '#FFA500', lineHeight: 1.1 }}>
                        {loadingZeroPrice ? '...' : zeroPurchasePriceItems.length}
                      </Typography>
                      <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                        Items missing purchase price
                      </Typography>
                    </Box>
                  </CardContent>
          </Card>
        </Grid>
      </Grid>
      )}

      {copilotTab === 0 && (
        <Card sx={{ mb: 4, backgroundColor: colors.paper }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AttachMoney sx={{ color: colors.accentText }} />
                <Typography variant="h5" sx={{ fontWeight: 600, color: colors.textPrimary }}>
                  Stock Valuation Details ({filteredStockValuationRows.length})
                </Typography>
              </Box>
              <Button variant="contained" size="small" onClick={handleExportStockValuation} sx={exportButtonSx}>
                Export CSV
              </Button>
            </Box>
            <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 2 }}>
              All items listed per capacity with selling price and total valuation.
            </Typography>
            <TextField
              size="small"
              fullWidth
              placeholder="Search stock valuation rows..."
              value={stockValuationSearch}
              onChange={(e) => {
                setStockValuationSearch(e.target.value);
                setStockValuationPage(0);
              }}
              sx={{ mb: 2 }}
            />
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Item Name</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Category</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Brand</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Capacity</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">
                      Stock
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">
                      Selling Price
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">
                      Total Valuation
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredStockValuationRows
                    .slice(
                      stockValuationPage * stockValuationRowsPerPage,
                      stockValuationPage * stockValuationRowsPerPage + stockValuationRowsPerPage
                    )
                    .map((row) => (
                      <TableRow key={row.key}>
                        <TableCell sx={{ color: colors.textPrimary }}>{row.item.name}</TableCell>
                        <TableCell sx={{ color: colors.textPrimary }}>
                          {row.item.category?.name || 'Uncategorized'}
                        </TableCell>
                        <TableCell sx={{ color: colors.textPrimary }}>
                          {row.item.brand?.name || 'Unbranded'}
                        </TableCell>
                        <TableCell sx={{ color: colors.textPrimary }}>{row.capacity}</TableCell>
                        <TableCell align="right" sx={{ color: colors.textPrimary }}>
                          {row.stock}
                        </TableCell>
                        <TableCell align="right" sx={{ color: colors.textPrimary }}>
                          {formatCurrency(row.sellingPrice)}
                        </TableCell>
                        <TableCell align="right" sx={{ color: colors.textPrimary, fontWeight: 700 }}>
                          {formatCurrency(row.totalValuation)}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={filteredStockValuationRows.length}
              page={stockValuationPage}
              onPageChange={(e, newPage) => setStockValuationPage(newPage)}
              rowsPerPage={stockValuationRowsPerPage}
              onRowsPerPageChange={(e) => {
                setStockValuationRowsPerPage(parseInt(e.target.value, 10));
                setStockValuationPage(0);
              }}
              rowsPerPageOptions={[10, 25, 50, 100]}
            />
          </CardContent>
        </Card>
      )}

      {/* Out of Stock Items Table */}
      {copilotTab === 0 && analytics.outOfStock.items.length > 0 && (
        <Card sx={{ mb: 4, backgroundColor: colors.paper }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Warning sx={{ color: '#FF3366' }} />
              <Typography variant="h5" sx={{ fontWeight: 600, color: colors.textPrimary }}>
                Out of Stock Items ({analytics.outOfStock.count})
              </Typography>
            </Box>
              <Button variant="contained" size="small" onClick={handleExportOutOfStock} sx={exportButtonSx}>
                Export CSV
              </Button>
            </Box>
            <TextField
              size="small"
              fullWidth
              placeholder="Search out of stock items..."
              value={outOfStockSearch}
              onChange={(e) => {
                setOutOfStockSearch(e.target.value);
                setOutOfStockPage(0);
              }}
              sx={{ mb: 2 }}
            />
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Item Name</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Category</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">Stock</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">Purchase Price</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">Selling Price</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredOutOfStockItems
                    .slice(outOfStockPage * outOfStockRowsPerPage, outOfStockPage * outOfStockRowsPerPage + outOfStockRowsPerPage)
                    .map((item) => (
                    <TableRow key={item.id}>
                      <TableCell sx={{ color: colors.textPrimary }}>{item.name}</TableCell>
                      <TableCell>
                        {item.category ? (
                          <Chip
                            label={item.category.name}
                            size="small"
                            sx={{
                              backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.2)' : 'rgba(0, 224, 184, 0.1)',
                              color: colors.accentText
                            }}
                          />
                        ) : (
                          <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                            Uncategorized
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right" sx={{ color: '#FF3366', fontWeight: 600 }}>
                        {item.stock}
                      </TableCell>
                      <TableCell align="right">
                        <Typography sx={{ color: colors.textPrimary, textAlign: 'right' }}>
                          {formatCurrency(item.purchasePrice)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography sx={{ color: colors.textPrimary, textAlign: 'right' }}>
                          {formatCurrency(item.price || item.originalPrice)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={filteredOutOfStockItems.length}
              page={outOfStockPage}
              onPageChange={(e, newPage) => setOutOfStockPage(newPage)}
              rowsPerPage={outOfStockRowsPerPage}
              onRowsPerPageChange={(e) => {
                setOutOfStockRowsPerPage(parseInt(e.target.value, 10));
                setOutOfStockPage(0);
              }}
              rowsPerPageOptions={[5, 10, 25, 50]}
            />
          </CardContent>
        </Card>
      )}

      {/* Items with Zero Purchase Price */}
      {copilotTab === 1 && !loadingZeroPrice && zeroPurchasePriceItems.length > 0 && (
        <Card sx={{ mb: 4, backgroundColor: colors.paper }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Warning sx={{ color: '#FFA500' }} />
                <Typography variant="h5" sx={{ fontWeight: 600, color: colors.textPrimary }}>
                  Items with Zero Purchase Price ({zeroPurchasePriceItems.length})
                </Typography>
              </Box>
              <Button variant="contained" size="small" onClick={handleExportZeroPurchase} sx={exportButtonSx}>
                Export CSV
              </Button>
            </Box>
            <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 2 }}>
              Items that have a purchase price of 0 or no purchase price set. These items need purchase prices to calculate profit accurately.
            </Typography>
            <TextField
              size="small"
              fullWidth
              placeholder="Search zero purchase price items..."
              value={zeroPurchaseSearch}
              onChange={(e) => {
                setZeroPurchaseSearch(e.target.value);
                setZeroPricePage(0);
              }}
              sx={{ mb: 2 }}
            />
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Item Name</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Category</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">Stock</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">Purchase Price</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">Selling Price</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredZeroPurchaseItems
                    .slice(zeroPricePage * zeroPriceRowsPerPage, zeroPricePage * zeroPriceRowsPerPage + zeroPriceRowsPerPage)
                    .map((item) => (
                    <TableRow key={item.id}>
                      <TableCell sx={{ color: colors.textPrimary }}>{item.name}</TableCell>
                      <TableCell>
                        {item.category ? (
                          <Chip
                            label={item.category.name}
                            size="small"
                            sx={{
                              backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.2)' : 'rgba(0, 224, 184, 0.1)',
                              color: colors.accentText
                            }}
                          />
                        ) : (
                          <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                            Uncategorized
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right" sx={{ color: colors.textPrimary }}>
                        {item.stock || 0}
                      </TableCell>
                      <TableCell align="right">
                        {editingItem === item.id ? (
                          <TextField
                            type="number"
                            size="small"
                            value={editPurchasePrice}
                            onChange={(e) => setEditPurchasePrice(e.target.value)}
                            sx={{ width: '100px' }}
                            inputProps={{ min: 0, step: 0.01 }}
                            placeholder="0.00"
                          />
                        ) : (
                          <Typography sx={{ color: '#FFA500', fontWeight: 600, textAlign: 'right' }}>
                            {item.purchasePrice === null || item.purchasePrice === undefined || item.purchasePrice === ''
                              ? 'Not Set'
                              : formatCurrency(0)}
                            </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {editingItem === item.id ? (
                          <TextField
                            type="number"
                            size="small"
                            value={editSellingPrice}
                            onChange={(e) => setEditSellingPrice(e.target.value)}
                            sx={{ width: '100px' }}
                            inputProps={{ min: 0, step: 0.01 }}
                          />
                        ) : (
                          <Typography sx={{ color: colors.textPrimary, textAlign: 'right' }}>
                            {formatCurrency(item.price || item.originalPrice || 0)}
                            </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {editingItem === item.id ? (
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <IconButton 
                              size="small" 
                              color="primary" 
                              onClick={() => handleSave(item)}
                              disabled={saving}
                            >
                              <Save fontSize="small" />
                            </IconButton>
                            <IconButton 
                              size="small" 
                              color="error" 
                              onClick={handleCancelEdit}
                              disabled={saving}
                            >
                              <Cancel fontSize="small" />
                            </IconButton>
                          </Box>
                        ) : (
                          <IconButton size="small" onClick={() => handleEditClick(item)}>
                            <Edit fontSize="small" />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={filteredZeroPurchaseItems.length}
              page={zeroPricePage}
              onPageChange={(e, newPage) => setZeroPricePage(newPage)}
              rowsPerPage={zeroPriceRowsPerPage}
              onRowsPerPageChange={(e) => {
                setZeroPriceRowsPerPage(parseInt(e.target.value, 10));
                setZeroPricePage(0);
              }}
              rowsPerPageOptions={[5, 10, 25, 50]}
            />
          </CardContent>
        </Card>
      )}

      {/* Items with Zero Selling Price */}
      {copilotTab === 1 && !loadingZeroPrice && zeroSellingPriceItems.length > 0 && (
        <Card sx={{ mb: 4, backgroundColor: colors.paper }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Warning sx={{ color: '#FF3366' }} />
              <Typography variant="h5" sx={{ fontWeight: 600, color: colors.textPrimary }}>
                  Items with Zero Selling Price ({filteredZeroSellingCapacityRows.length})
              </Typography>
              </Box>
              <Button variant="contained" size="small" onClick={handleExportZeroSelling} sx={exportButtonSx}>
                Export CSV
              </Button>
            </Box>
            <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 2 }}>
              Items that have a selling price of 0 or no selling price set. These items need valid prices so customers see correct amounts.
            </Typography>
            <TextField
              size="small"
              fullWidth
              placeholder="Search zero selling price items..."
              value={zeroSellingSearch}
              onChange={(e) => {
                setZeroSellingSearch(e.target.value);
                setZeroSellingPage(0);
              }}
              sx={{ mb: 2 }}
            />
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Item Name</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Category</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Brand</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Capacity</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">
                      Stock
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">
                      Purchase Price
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">
                      Selling Price
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredZeroSellingCapacityRows
                    .slice(
                      zeroSellingPage * zeroSellingRowsPerPage,
                      zeroSellingPage * zeroSellingRowsPerPage + zeroSellingRowsPerPage
                    )
                    .map((row) => {
                      const item = row.item;
                      return (
                      <TableRow key={row.key}>
                      <TableCell sx={{ color: colors.textPrimary }}>{item.name}</TableCell>
                      <TableCell>
                        {item.category ? (
                          <Chip
                            label={item.category.name}
                            size="small"
                            sx={{
                                backgroundColor: isDarkMode
                                  ? 'rgba(0, 224, 184, 0.2)'
                                  : 'rgba(0, 224, 184, 0.1)',
                              color: colors.accentText
                            }}
                          />
                        ) : (
                          <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                            Uncategorized
                          </Typography>
                        )}
                      </TableCell>
                        <TableCell sx={{ color: colors.textPrimary }}>
                          {item.brand?.name || 'Unbranded'}
                        </TableCell>
                        <TableCell>
                          {editingItem === item.id ? (
                            <Box sx={{ minWidth: 180 }}>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                                {editCapacities.map((cap) => (
                                  <Chip
                                    key={cap}
                                    label={cap}
                                    size="small"
                                    onDelete={() => removeCapacityFromEditList(cap)}
                                  />
                                ))}
                              </Box>
                              <Box sx={{ display: 'flex', gap: 1 }}>
                                <TextField
                                  select
                                  size="small"
                                  value={newCapacityValue}
                                  onChange={(e) => setNewCapacityValue(e.target.value)}
                                  sx={{ minWidth: 180 }}
                                >
                                  <MenuItem value="">
                                    <em>Select capacity</em>
                                  </MenuItem>
                                  {getCapacityOptions(item).map((option) => (
                                    <MenuItem key={option} value={option}>
                                      {option}
                                    </MenuItem>
                                  ))}
                                </TextField>
                                <Button size="small" variant="outlined" onClick={addCapacityToEditList}>
                                  Add
                                </Button>
                              </Box>
                            </Box>
                          ) : (
                            <Typography sx={{ color: colors.textPrimary }}>
                              {row.capacity}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right" sx={{ color: colors.textPrimary }}>
                          {row.stock}
                        </TableCell>
                        <TableCell align="right" sx={{ color: colors.textPrimary }}>
                          {item.purchasePrice != null && item.purchasePrice !== ''
                            ? formatCurrency(item.purchasePrice)
                            : 'Not Set'}
                      </TableCell>
                      <TableCell align="right">
                        {editingItem === item.id ? (
                          <TextField
                            type="number"
                            size="small"
                              value={editSellingPrice}
                              onChange={(e) => setEditSellingPrice(e.target.value)}
                            sx={{ width: '100px' }}
                            inputProps={{ min: 0, step: 0.01 }}
                            placeholder="0.00"
                          />
                        ) : (
                            <Typography sx={{ color: '#FF3366', fontWeight: 600 }}>
                              {row.sellingPrice == null || row.sellingPrice === ''
                                ? 'Not Set' 
                                : formatCurrency(row.sellingPrice)}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {editingItem === item.id ? (
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleSave(item)}
                                disabled={saving}
                              >
                                <Save fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={handleCancelEdit}
                                disabled={saving}
                              >
                                <Cancel fontSize="small" />
                              </IconButton>
                            </Box>
                          ) : (
                            <IconButton size="small" onClick={() => handleEditClick(item)}>
                              <Edit fontSize="small" />
                            </IconButton>
                          )}
                        </TableCell>
                      </TableRow>
                    )})}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={filteredZeroSellingCapacityRows.length}
              page={zeroSellingPage}
              onPageChange={(e, newPage) => setZeroSellingPage(newPage)}
              rowsPerPage={zeroSellingRowsPerPage}
              onRowsPerPageChange={(e) => {
                setZeroSellingRowsPerPage(parseInt(e.target.value, 10));
                setZeroSellingPage(0);
              }}
              rowsPerPageOptions={[5, 10, 25, 50]}
            />
          </CardContent>
        </Card>
      )}

      {/* Price List */}
      {copilotTab === 1 && !loadingZeroPrice && priceListItems.length > 0 && (
        <Card sx={{ mb: 4, backgroundColor: colors.paper }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AttachMoney sx={{ color: colors.accentText }} />
                <Typography variant="h5" sx={{ fontWeight: 600, color: colors.textPrimary }}>
                  Price List ({priceListItems.length})
                </Typography>
                          </Box>
              <Button variant="contained" size="small" onClick={handleExportPriceList} sx={exportButtonSx}>
                Export CSV
              </Button>
            </Box>
            <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 2 }}>
              Items with a valid selling price (greater than 0).
            </Typography>
            <TextField
              size="small"
              fullWidth
              placeholder="Search price list..."
              value={priceListSearch}
              onChange={(e) => {
                setPriceListSearch(e.target.value);
                setPriceListPage(0);
              }}
              sx={{ mb: 2 }}
            />
            <TextField
              select
              size="small"
              fullWidth
              label="Subcategory"
              value={priceListSubcategoryFilter}
              onChange={(e) => {
                setPriceListSubcategoryFilter(e.target.value);
                setPriceListPage(0);
              }}
              sx={{ mb: 2 }}
            >
              <MenuItem value="">All subcategories</MenuItem>
              {priceListSubcategoryOptions.map((name) => (
                <MenuItem key={name} value={name}>
                  {name}
                </MenuItem>
              ))}
            </TextField>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Item Name</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Category</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Brand</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Capacity</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => setPriceListSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                        sx={{ color: colors.accentText, minWidth: 0, p: 0 }}
                        endIcon={
                          priceListSortDirection === 'asc' ? (
                            <ArrowUpward fontSize="small" />
                          ) : (
                            <ArrowDownward fontSize="small" />
                          )
                        }
                      >
                        Stock
                      </Button>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">
                      Selling Price
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {groupedFilteredPriceListRows
                    .slice(
                      priceListPage * priceListRowsPerPage,
                      priceListPage * priceListRowsPerPage + priceListRowsPerPage
                    )
                    .map((row) => {
                      if (row.type === 'group') {
                        return (
                          <TableRow key={row.key}>
                            <TableCell
                              colSpan={7}
                              sx={{
                                fontWeight: 700,
                                color: colors.accentText,
                                backgroundColor: isDarkMode
                                  ? 'rgba(0, 224, 184, 0.08)'
                                  : 'rgba(0, 224, 184, 0.06)'
                              }}
                            >
                              {row.category}
                            </TableCell>
                          </TableRow>
                        );
                      }
                      const entry = row.entry;
                      const item = entry.item;
                      const isEditingPriceRow = editingPriceListKey === getPriceListRowKey(entry);
                      return (
                        <TableRow key={row.key}>
                          <TableCell sx={{ color: colors.textPrimary }}>{item.name}</TableCell>
                          <TableCell>
                            {item.category ? (
                              <Chip
                                label={item.category.name}
                                size="small"
                                sx={{
                                  backgroundColor: isDarkMode
                                    ? 'rgba(0, 224, 184, 0.2)'
                                    : 'rgba(0, 224, 184, 0.1)',
                                  color: colors.accentText
                                }}
                              />
                            ) : (
                              <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                                Uncategorized
                              </Typography>
                        )}
                      </TableCell>
                          <TableCell sx={{ color: colors.textPrimary }}>
                            {item.brand?.name || 'Unbranded'}
                          </TableCell>
                          <TableCell sx={{ color: colors.textPrimary }}>
                            {entry.capacity}
                          </TableCell>
                          <TableCell align="right" sx={{ color: colors.textPrimary }}>
                            {entry.stock}
                          </TableCell>
                          <TableCell align="right" sx={{ color: colors.textPrimary, fontWeight: 600 }}>
                            {isEditingPriceRow ? (
                          <TextField
                            type="number"
                            size="small"
                                value={editPriceListSellingPrice}
                                onChange={(e) => setEditPriceListSellingPrice(e.target.value)}
                                sx={{ width: '110px' }}
                            inputProps={{ min: 0, step: 0.01 }}
                          />
                        ) : (
                              formatCurrency(entry.sellingPrice)
                        )}
                      </TableCell>
                      <TableCell align="right">
                            {isEditingPriceRow ? (
                              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                            <IconButton 
                              size="small" 
                              color="primary" 
                                  onClick={() => handleSavePriceListRow(entry)}
                              disabled={saving}
                            >
                              <Save fontSize="small" />
                            </IconButton>
                            <IconButton 
                              size="small" 
                              color="error" 
                                  onClick={handleCancelPriceListEdit}
                              disabled={saving}
                            >
                              <Cancel fontSize="small" />
                            </IconButton>
                          </Box>
                        ) : (
                              <IconButton size="small" onClick={() => handleEditPriceListRow(entry)}>
                            <Edit fontSize="small" />
                          </IconButton>
                        )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={groupedFilteredPriceListRows.length}
              page={priceListPage}
              onPageChange={(e, newPage) => setPriceListPage(newPage)}
              rowsPerPage={priceListRowsPerPage}
              onRowsPerPageChange={(e) => {
                setPriceListRowsPerPage(parseInt(e.target.value, 10));
                setPriceListPage(0);
              }}
              rowsPerPageOptions={[5, 10, 25, 50]}
            />
          </CardContent>
        </Card>
      )}

      {/* Items Without Category */}
      {copilotTab === 1 && !loadingZeroPrice && uncategorizedItems.length > 0 && (
        <Card sx={{ mb: 4, backgroundColor: colors.paper }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Warning sx={{ color: '#FF3366' }} />
                <Typography variant="h5" sx={{ fontWeight: 600, color: colors.textPrimary }}>
                  Items Without Category ({uncategorizedItems.length})
                </Typography>
              </Box>
            </Box>
            <TextField
              size="small"
              fullWidth
              placeholder="Search items without category..."
              value={uncategorizedSearch}
              onChange={(e) => {
                setUncategorizedSearch(e.target.value);
                setUncategorizedPage(0);
              }}
              sx={{ mb: 2 }}
            />
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Item Name</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Brand</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">Stock</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">Selling Price</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredUncategorizedItems
                    .slice(
                      uncategorizedPage * uncategorizedRowsPerPage,
                      uncategorizedPage * uncategorizedRowsPerPage + uncategorizedRowsPerPage
                    )
                    .map((item) => (
                      <TableRow key={item.id}>
                        <TableCell sx={{ color: colors.textPrimary }}>{item.name}</TableCell>
                        <TableCell sx={{ color: colors.textPrimary }}>{item.brand?.name || 'Unbranded'}</TableCell>
                        <TableCell align="right" sx={{ color: colors.textPrimary }}>{item.stock || 0}</TableCell>
                        <TableCell align="right" sx={{ color: colors.textPrimary }}>
                          {formatCurrency(item.price ?? item.originalPrice ?? 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={filteredUncategorizedItems.length}
              page={uncategorizedPage}
              onPageChange={(e, newPage) => setUncategorizedPage(newPage)}
              rowsPerPage={uncategorizedRowsPerPage}
              onRowsPerPageChange={(e) => {
                setUncategorizedRowsPerPage(parseInt(e.target.value, 10));
                setUncategorizedPage(0);
              }}
              rowsPerPageOptions={[5, 10, 25, 50]}
            />
          </CardContent>
        </Card>
      )}

      {/* Items Without Brand */}
      {copilotTab === 1 && !loadingZeroPrice && unbrandedItems.length > 0 && (
        <Card sx={{ mb: 4, backgroundColor: colors.paper }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Warning sx={{ color: '#FF3366' }} />
                <Typography variant="h5" sx={{ fontWeight: 600, color: colors.textPrimary }}>
                  Items Without Brand ({unbrandedItems.length})
                </Typography>
              </Box>
            </Box>
            <TextField
              size="small"
              fullWidth
              placeholder="Search items without brand..."
              value={unbrandedSearch}
              onChange={(e) => {
                setUnbrandedSearch(e.target.value);
                setUnbrandedPage(0);
              }}
              sx={{ mb: 2 }}
            />
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Item Name</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Category</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">Stock</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">Selling Price</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredUnbrandedItems
                    .slice(
                      unbrandedPage * unbrandedRowsPerPage,
                      unbrandedPage * unbrandedRowsPerPage + unbrandedRowsPerPage
                    )
                    .map((item) => (
                      <TableRow key={item.id}>
                        <TableCell sx={{ color: colors.textPrimary }}>{item.name}</TableCell>
                        <TableCell sx={{ color: colors.textPrimary }}>
                          {item.category?.name || 'Uncategorized'}
                        </TableCell>
                        <TableCell align="right" sx={{ color: colors.textPrimary }}>{item.stock || 0}</TableCell>
                        <TableCell align="right" sx={{ color: colors.textPrimary }}>
                          {formatCurrency(item.price ?? item.originalPrice ?? 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={filteredUnbrandedItems.length}
              page={unbrandedPage}
              onPageChange={(e, newPage) => setUnbrandedPage(newPage)}
              rowsPerPage={unbrandedRowsPerPage}
              onRowsPerPageChange={(e) => {
                setUnbrandedRowsPerPage(parseInt(e.target.value, 10));
                setUnbrandedPage(0);
              }}
              rowsPerPageOptions={[5, 10, 25, 50]}
            />
          </CardContent>
        </Card>
      )}

      {/* Items Missing an Image */}
      {copilotTab === 1 && !loadingZeroPrice && missingImageItems.length > 0 && (
        <Card sx={{ mb: 4, backgroundColor: colors.paper }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Warning sx={{ color: '#FF3366', fontSize: 28 }} />
                <Typography variant="h5" sx={{ fontWeight: 600, color: colors.textPrimary }}>
                  Items Missing an Image ({missingImageItems.length})
                </Typography>
              </Box>
            </Box>
            <TextField
              size="small"
              fullWidth
              placeholder="Search items missing image..."
              value={missingImageSearch}
              onChange={(e) => {
                setMissingImageSearch(e.target.value);
                setMissingImagePage(0);
              }}
              sx={{ mb: 2 }}
            />
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Item Name</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Brand</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Category</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">Stock</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">Selling Price</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredMissingImageItems
                    .slice(
                      missingImagePage * missingImageRowsPerPage,
                      missingImagePage * missingImageRowsPerPage + missingImageRowsPerPage
                    )
                    .map((item) => (
                      <TableRow key={item.id}>
                        <TableCell sx={{ color: colors.textPrimary }}>{item.name}</TableCell>
                        <TableCell sx={{ color: colors.textPrimary }}>{item.brand?.name || '—'}</TableCell>
                        <TableCell sx={{ color: colors.textPrimary }}>{item.category?.name || '—'}</TableCell>
                        <TableCell align="right" sx={{ color: colors.textPrimary }}>{item.stock || 0}</TableCell>
                        <TableCell align="right" sx={{ color: colors.textPrimary }}>
                          {formatCurrency(item.price ?? item.originalPrice ?? 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={filteredMissingImageItems.length}
              page={missingImagePage}
              onPageChange={(e, newPage) => setMissingImagePage(newPage)}
              rowsPerPage={missingImageRowsPerPage}
              onRowsPerPageChange={(e) => {
                setMissingImageRowsPerPage(parseInt(e.target.value, 10));
                setMissingImagePage(0);
              }}
              rowsPerPageOptions={[5, 10, 25, 50]}
            />
          </CardContent>
        </Card>
      )}

      {/* Category Management */}
      {copilotTab === 2 && <Card sx={{ mb: 4, backgroundColor: colors.paper }}>
        <CardContent>
          <Typography variant="h5" sx={{ fontWeight: 600, color: colors.textPrimary, mb: 2 }}>
            Categories ({categoriesSummary.length})
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            <TextField
              size="small"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Add category"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCategory();
                }
              }}
              sx={{ minWidth: 220 }}
            />
            <Button variant="contained" onClick={handleAddCategory} sx={exportButtonSx}>
              Add Category
            </Button>
          </Box>
          <TextField
            size="small"
            fullWidth
            placeholder="Search categories..."
            value={categoriesSearch}
            onChange={(e) => {
              setCategoriesSearch(e.target.value);
              setCategoriesPage(0);
            }}
            sx={{ mb: 2 }}
          />
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Category</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">Drinks</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Transfer To</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredCategoriesSummary
                  .slice(
                    categoriesPage * categoriesRowsPerPage,
                    categoriesPage * categoriesRowsPerPage + categoriesRowsPerPage
                  )
                  .map((category) => (
                    <TableRow key={category.id}>
                      <TableCell sx={{ color: colors.textPrimary }}>{category.name}</TableCell>
                      <TableCell align="right" sx={{ color: colors.textPrimary }}>{category.drinksCount}</TableCell>
                      <TableCell>
                        <TextField
                          select
                          size="small"
                          value={categoryTransferMap[category.id] || ''}
                          onChange={(e) =>
                            setCategoryTransferMap((prev) => ({ ...prev, [category.id]: e.target.value }))
                          }
                          sx={{ minWidth: 220 }}
                        >
                          {categoriesSummary
                            .filter((c) => c.id !== category.id)
                            .map((target) => (
                              <MenuItem key={target.id} value={target.id}>
                                {target.name}
                              </MenuItem>
                            ))}
                        </TextField>
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          variant="outlined"
                          color="error"
                          size="small"
                          onClick={() => handleDeleteCategoryWithTransfer(category)}
                        >
                          Delete + Transfer
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={filteredCategoriesSummary.length}
            page={categoriesPage}
            onPageChange={(e, newPage) => setCategoriesPage(newPage)}
            rowsPerPage={categoriesRowsPerPage}
            onRowsPerPageChange={(e) => {
              setCategoriesRowsPerPage(parseInt(e.target.value, 10));
              setCategoriesPage(0);
            }}
            rowsPerPageOptions={[5, 10, 25, 50]}
          />
        </CardContent>
      </Card>}

      {/* Subcategory Management */}
      {copilotTab === 2 && <Card sx={{ mb: 4, backgroundColor: colors.paper }}>
        <CardContent>
          <Typography variant="h5" sx={{ fontWeight: 600, color: colors.textPrimary, mb: 2 }}>
            Subcategories ({subcategoriesSummary.length})
          </Typography>
          <TextField
            size="small"
            fullWidth
            placeholder="Search subcategories..."
            value={subcategoriesSearch}
            onChange={(e) => {
              setSubcategoriesSearch(e.target.value);
              setSubcategoriesPage(0);
            }}
            sx={{ mb: 2 }}
          />
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Subcategory</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Category</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">Drinks</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Transfer To</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredSubcategoriesSummary
                  .slice(
                    subcategoriesPage * subcategoriesRowsPerPage,
                    subcategoriesPage * subcategoriesRowsPerPage + subcategoriesRowsPerPage
                  )
                  .map((subcategory) => (
                    <TableRow key={subcategory.id}>
                      <TableCell sx={{ color: colors.textPrimary }}>{subcategory.name}</TableCell>
                      <TableCell sx={{ color: colors.textPrimary }}>{subcategory.categoryName || '—'}</TableCell>
                      <TableCell align="right" sx={{ color: colors.textPrimary }}>{subcategory.drinksCount}</TableCell>
                      <TableCell>
                        <TextField
                          select
                          size="small"
                          value={subCategoryTransferMap[subcategory.id] || ''}
                          onChange={(e) =>
                            setSubCategoryTransferMap((prev) => ({ ...prev, [subcategory.id]: e.target.value }))
                          }
                          sx={{ minWidth: 260 }}
                        >
                          {subcategoriesSummary
                            .filter((s) => s.id !== subcategory.id && s.categoryId === subcategory.categoryId)
                            .map((target) => (
                              <MenuItem key={target.id} value={target.id}>
                                {target.name}
                              </MenuItem>
                            ))}
                        </TextField>
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          variant="outlined"
                          color="error"
                          size="small"
                          onClick={() => handleDeleteSubcategoryWithTransfer(subcategory)}
                        >
                          Delete + Transfer
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={filteredSubcategoriesSummary.length}
            page={subcategoriesPage}
            onPageChange={(e, newPage) => setSubcategoriesPage(newPage)}
            rowsPerPage={subcategoriesRowsPerPage}
            onRowsPerPageChange={(e) => {
              setSubcategoriesRowsPerPage(parseInt(e.target.value, 10));
              setSubcategoriesPage(0);
            }}
            rowsPerPageOptions={[5, 10, 25, 50]}
          />
        </CardContent>
      </Card>}

      {/* Brand Management */}
      {copilotTab === 2 && <Card sx={{ mb: 4, backgroundColor: colors.paper }}>
        <CardContent>
          <Typography variant="h5" sx={{ fontWeight: 600, color: colors.textPrimary, mb: 2 }}>
            Brands ({brandsSummary.length})
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            <TextField
              size="small"
              value={newBrandName}
              onChange={(e) => setNewBrandName(e.target.value)}
              placeholder="Add brand"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddBrand();
                }
              }}
              sx={{ minWidth: 220 }}
            />
            <Button variant="contained" onClick={handleAddBrand} sx={exportButtonSx}>
              Add Brand
            </Button>
          </Box>
          <TextField
            size="small"
            fullWidth
            placeholder="Search brands..."
            value={brandsSearch}
            onChange={(e) => {
              setBrandsSearch(e.target.value);
              setBrandsPage(0);
            }}
            sx={{ mb: 2 }}
          />
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Brand</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">Drinks</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Transfer To</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredBrandsSummary
                  .slice(
                    brandsPage * brandsRowsPerPage,
                    brandsPage * brandsRowsPerPage + brandsRowsPerPage
                  )
                  .map((brand) => (
                    <TableRow key={brand.id}>
                      <TableCell sx={{ color: colors.textPrimary }}>{brand.name}</TableCell>
                      <TableCell align="right" sx={{ color: colors.textPrimary }}>{brand.drinksCount}</TableCell>
                      <TableCell>
                        <TextField
                          select
                          size="small"
                          value={brandTransferMap[brand.id] || ''}
                          onChange={(e) =>
                            setBrandTransferMap((prev) => ({ ...prev, [brand.id]: e.target.value }))
                          }
                          sx={{ minWidth: 220 }}
                        >
                          {brandsSummary
                            .filter((b) => b.id !== brand.id)
                            .map((target) => (
                              <MenuItem key={target.id} value={target.id}>
                                {target.name}
                              </MenuItem>
                            ))}
                        </TextField>
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          variant="outlined"
                          color="error"
                          size="small"
                          onClick={() => handleDeleteBrandWithTransfer(brand)}
                        >
                          Delete + Transfer
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={filteredBrandsSummary.length}
            page={brandsPage}
            onPageChange={(e, newPage) => setBrandsPage(newPage)}
            rowsPerPage={brandsRowsPerPage}
            onRowsPerPageChange={(e) => {
              setBrandsRowsPerPage(parseInt(e.target.value, 10));
              setBrandsPage(0);
            }}
            rowsPerPageOptions={[5, 10, 25, 50]}
          />
        </CardContent>
      </Card>}

      {copilotTab === 2 && (
        <Card sx={{ mb: 4, backgroundColor: colors.paper }}>
          <CardContent>
            <Typography variant="h5" sx={{ fontWeight: 600, color: colors.textPrimary, mb: 2 }}>
              Capacities ({availableCapacities.length})
            </Typography>
            <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 2 }}>
              Add capacity options here to make them available in the Copilot Inventory capacity dropdown.
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
              <TextField
                size="small"
                value={newGlobalCapacity}
                onChange={(e) => setNewGlobalCapacity(e.target.value)}
                placeholder="e.g. 12 PACK"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddGlobalCapacity();
                  }
                }}
                sx={{ minWidth: 220 }}
              />
              <Button variant="contained" onClick={handleAddGlobalCapacity} sx={exportButtonSx}>
                Add Capacity
              </Button>
            </Box>
            <TextField
              size="small"
              fullWidth
              placeholder="Search capacities..."
              value={capacitySettingsSearch}
              onChange={(e) => {
                setCapacitySettingsSearch(e.target.value);
                setCapacitySettingsPage(0);
              }}
              sx={{ mb: 2 }}
            />
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Capacity</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Transfer To</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">
                      Action
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredAvailableCapacities.length > 0 ? (
                    filteredAvailableCapacities
                      .slice(
                        capacitySettingsPage * capacitySettingsRowsPerPage,
                        capacitySettingsPage * capacitySettingsRowsPerPage + capacitySettingsRowsPerPage
                      )
                      .map((cap) => {
                      const isEditing = editingCapacityValue === cap;
                      return (
                        <TableRow key={cap}>
                          <TableCell sx={{ color: colors.textPrimary }}>
                            {isEditing ? (
                              <TextField
                                size="small"
                                value={editCapacityValue}
                                onChange={(e) => setEditCapacityValue(e.target.value)}
                              />
                            ) : (
                              cap
                            )}
                          </TableCell>
                          <TableCell>
                            <TextField
                              select
                              size="small"
                              value={capacityTransferMap[cap] || ''}
                              onChange={(e) =>
                                setCapacityTransferMap((prev) => ({ ...prev, [cap]: e.target.value }))
                              }
                              sx={{ minWidth: 180 }}
                            >
                              {availableCapacities
                                .filter((target) => target !== cap)
                                .map((target) => (
                                  <MenuItem key={target} value={target}>
                                    {target}
                                  </MenuItem>
                                ))}
                            </TextField>
                          </TableCell>
                          <TableCell align="right">
                            {isEditing ? (
                              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() => handleSaveEditCapacity(cap)}
                                >
                                  <Save fontSize="small" />
                                </IconButton>
                                <IconButton size="small" color="error" onClick={handleCancelEditCapacity}>
                                  <Cancel fontSize="small" />
                                </IconButton>
                              </Box>
                            ) : (
                              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                                <IconButton size="small" onClick={() => handleStartEditCapacity(cap)}>
                                  <Edit fontSize="small" />
                                </IconButton>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="error"
                                  onClick={() => handleDeleteCapacityWithTransfer(cap)}
                                >
                                  Transfer + Delete
                                </Button>
                              </Box>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} sx={{ color: colors.textSecondary }}>
                        No capacities found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={filteredAvailableCapacities.length}
              page={capacitySettingsPage}
              onPageChange={(e, newPage) => setCapacitySettingsPage(newPage)}
              rowsPerPage={capacitySettingsRowsPerPage}
              onRowsPerPageChange={(e) => {
                setCapacitySettingsRowsPerPage(parseInt(e.target.value, 10));
                setCapacitySettingsPage(0);
              }}
              rowsPerPageOptions={[5, 10, 25, 50]}
            />
          </CardContent>
        </Card>
      )}

      {/* Slow-Moving Stock Table */}
      {copilotTab === 0 && analytics.slowMoving.items.length > 0 && (
        <Card sx={{ backgroundColor: colors.paper }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingDown sx={{ color: '#FFA500' }} />
              <Typography variant="h5" sx={{ fontWeight: 600, color: colors.textPrimary }}>
                Slow-Moving Stock ({analytics.slowMoving.count})
              </Typography>
              </Box>
              <Button variant="contained" size="small" onClick={handleExportSlowMoving} sx={exportButtonSx}>
                Export CSV
              </Button>
            </Box>
            <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 2 }}>
              Items with no sales in the last {analytics.slowMoving.thresholdMonths} months
            </Typography>
            <TextField
              size="small"
              fullWidth
              placeholder="Search slow moving stock..."
              value={slowMovingSearch}
              onChange={(e) => {
                setSlowMovingSearch(e.target.value);
                setSlowMovingPage(0);
              }}
              sx={{ mb: 2 }}
            />
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Item Name</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Category</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">Stock</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">Purchase Price</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">Selling Price</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Last Sold</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredSlowMovingItems
                    .slice(
                      slowMovingPage * slowMovingRowsPerPage,
                      slowMovingPage * slowMovingRowsPerPage + slowMovingRowsPerPage
                    )
                    .map((item) => (
                    <TableRow key={item.id}>
                      <TableCell sx={{ color: colors.textPrimary }}>{item.name}</TableCell>
                      <TableCell>
                        {item.category ? (
                          <Chip
                            label={item.category.name}
                            size="small"
                            sx={{
                              backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.2)' : 'rgba(0, 224, 184, 0.1)',
                              color: colors.accentText
                            }}
                          />
                        ) : (
                          <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                            Uncategorized
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right" sx={{ color: colors.textPrimary }}>
                        {item.stock}
                      </TableCell>
                      <TableCell align="right" sx={{ color: colors.textPrimary }}>
                        {formatCurrency(item.purchasePrice)}
                      </TableCell>
                      <TableCell align="right" sx={{ color: colors.textPrimary }}>
                        {formatCurrency(item.price || item.originalPrice)}
                      </TableCell>
                      <TableCell sx={{ color: colors.textSecondary }}>
                        {item.lastSoldDate
                          ? new Date(item.lastSoldDate).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })
                          : 'Never'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={filteredSlowMovingItems.length}
              page={slowMovingPage}
              onPageChange={(e, newPage) => setSlowMovingPage(newPage)}
              rowsPerPage={slowMovingRowsPerPage}
              onRowsPerPageChange={(e) => {
                setSlowMovingRowsPerPage(parseInt(e.target.value, 10));
                setSlowMovingPage(0);
              }}
              rowsPerPageOptions={[5, 10, 25, 50]}
            />
          </CardContent>
        </Card>
      )}

      {/* Empty States */}
      {copilotTab === 0 && analytics.outOfStock.items.length === 0 && (
        <Card sx={{ mb: 4, backgroundColor: colors.paper }}>
          <CardContent>
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CheckCircle sx={{ fontSize: 64, color: colors.accentText, mb: 2 }} />
              <Typography variant="h6" sx={{ color: colors.textPrimary, mb: 1 }}>
                All items in stock!
              </Typography>
              <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                No items are currently out of stock.
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      {copilotTab === 0 && analytics.slowMoving.items.length === 0 && (
        <Card sx={{ backgroundColor: colors.paper }}>
          <CardContent>
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <TrendingUp sx={{ fontSize: 64, color: colors.accentText, mb: 2 }} />
              <Typography variant="h6" sx={{ color: colors.textPrimary, mb: 1 }}>
                All items are moving well!
              </Typography>
              <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                No slow-moving items found. All items have had sales in the last {analytics.slowMoving.thresholdMonths} months.
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default Inventory;
