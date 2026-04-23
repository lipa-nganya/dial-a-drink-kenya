/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Grid,
  Button,
  Card,
  CardMedia,
  Chip,
  Divider,
  CircularProgress,
  Alert,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Snackbar,
  Breadcrumbs,
  Link
} from '@mui/material';
import {
  AddShoppingCart,
  LocalBar,
  Star,
  LocalOffer,
  Share,
  WhatsApp,
  Twitter,
  Facebook,
  ContentCopy
} from '@mui/icons-material';
import { useParams, useNavigate, Link as RouterLink, useLocation } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../services/api';
import { getBackendUrl } from '../utils/backendUrl';
import { stripHtml } from '../utils/stripHtml';
import {
  ensureCanonicalLink,
  buildProductCanonicalUrl,
  getCanonicalSiteOrigin
} from '../utils/seoCanonical';
import { normalizeSlug } from '../utils/slugCanonical';
import { buildBrandPath } from '../utils/brandSlug';
import DrinkCard from '../components/DrinkCard';

const ProductPage = () => {
  // Support both URL formats:
  // New: /:categorySlug/:productSlug (e.g., /wine/1659-sauvignon-blanc-750ml)
  // Legacy index: /products/:productSlug (wrong path segment; resolved via GET /drinks/:slug then redirect)
  // Old: /product/:id (e.g., /product/306)
  const params = useParams();
  const { categorySlug, productSlug, id } = params;
  const location = useLocation();
  const isLegacyIndexedProductsUrl = /^\/products\/[^/]+$/i.test(location.pathname);
  const isCategoryBasedUrl =
    Boolean(categorySlug && productSlug) && !isLegacyIndexedProductsUrl;
  const initialProduct = location.state?.drink || null;
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { colors } = useTheme();
  const [product, setProduct] = useState(initialProduct);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const initialHasCanonicalSlugs = Boolean(
    initialProduct?.slug && initialProduct?.category?.slug
  );
  const isLegacyProductRoute = Boolean(id && !isCategoryBasedUrl);
  const [loading, setLoading] = useState(
    !initialProduct || (isLegacyProductRoute && !initialHasCanonicalSlugs)
  );
  const [error, setError] = useState(null);
  const [selectedCapacity, setSelectedCapacity] = useState('');
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [pendingScrollToTop, setPendingScrollToTop] = useState(false);

  // "For More About" expandable section: animate vertical expansion while keeping
  // the collapsed card height ending below the Read More link.
  const aboutTextRef = useRef(null);
  const [aboutTextMaxHeight, setAboutTextMaxHeight] = useState(180);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [detailedDescription, setDetailedDescription] = useState(null);
  const [descriptionLoading, setDescriptionLoading] = useState(!!initialProduct);
  const [testingNotes, setTestingNotes] = useState(null);
  const [testingNotesLoading, setTestingNotesLoading] = useState(!!initialProduct);
  const [shareMenuAnchor, setShareMenuAnchor] = useState(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Skip refetch only when state has everything needed for canonical URL + redirect.
    // (List API used to omit category.slug — then we must fetch /drinks/:id to redirect off /product/:id.)
    const canSkipFetch =
      initialProduct &&
      ((isCategoryBasedUrl &&
        initialProduct.slug === productSlug &&
        initialProduct.category?.slug === categorySlug) ||
        (isLegacyIndexedProductsUrl &&
          productSlug &&
          initialProduct.slug === productSlug &&
          initialHasCanonicalSlugs) ||
        (isLegacyProductRoute &&
          String(initialProduct.id) === String(id) &&
          initialHasCanonicalSlugs));

    // We want to scroll back to the top, but doing it immediately can cause
    // layout shifts while the product image/layout is still re-rendering.
    // We defer scrolling until the image is loaded (or has errored).
    setPendingScrollToTop(true);
    setImageLoaded(false);
    setImageError(false);

    if (canSkipFetch) {
      // `product` state is initialized only once via `useState(initialProduct)`.
      // When navigating to another product while staying on the same component instance,
      // we must sync it from the new `location.state` payload.
      if (initialProduct) {
        setProduct(initialProduct);
      }
      setDescriptionExpanded(false);
      setLoading(false);
      return;
    }
    fetchProduct();
  }, [categorySlug, productSlug, id, location.pathname]);

  // Measure full text height for the expandable "For More About" card so the
  // maxHeight transitions animate smoothly.
  useLayoutEffect(() => {
    if (descriptionLoading) return;
    if (!aboutTextRef.current) return;
    setAboutTextMaxHeight(aboutTextRef.current.scrollHeight);
  }, [descriptionLoading, descriptionExpanded, product?.id]);

  // Always collapse the section when switching products.
  useEffect(() => {
    setDescriptionExpanded(false);
  }, [product?.id]);

  // Scroll only after the product image is stable (loaded) or we know it will render as fallback.
  useEffect(() => {
    if (!pendingScrollToTop) return;
    if (!product) return;

    // If there's no image (or imageUrl resolves empty), jump immediately.
    if (!product.image) {
      window.scrollTo({ top: 0, behavior: 'auto' });
      setPendingScrollToTop(false);
      return;
    }

    if (imageLoaded || imageError) {
      window.scrollTo({ top: 0, behavior: 'auto' });
      setPendingScrollToTop(false);
    }
  }, [pendingScrollToTop, product?.id, imageLoaded, imageError]);

  useEffect(() => {
    if (product) {
      fetchRelatedProducts();
      fetchDetailedDescription();
      fetchTestingNotes();

      // If this page was loaded via the old /product/:id or /product/:slug route
      // and we now have proper category + product slugs, redirect to the
      // new category-based URL so dev matches local (e.g. /wine/slug).
      if (!isCategoryBasedUrl && product.category?.slug && product.slug) {
        navigate(`/${normalizeSlug(product.category.slug)}/${normalizeSlug(product.slug)}`, { replace: true });
        return;
      }
      
      // Prefer slug-based canonical when product data is canonical (overrides pathname-based from CanonicalHead)
      ensureCanonicalLink(buildProductCanonicalUrl(product));
      
      // Auto-select capacity: one option → select it; multiple → select the more expensive option
      const availableCapacities = Array.isArray(product.capacityPricing) && product.capacityPricing.length > 0
        ? (() => {
            const seen = new Set();
            return product.capacityPricing
              .map(p => p.capacity != null ? p.capacity : p.size)
              .filter(c => {
                const key = String(c);
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
              });
          })()
        : Array.isArray(product.capacity) && product.capacity.length > 0
          ? product.capacity
          : [];

      if (availableCapacities.length === 1) {
        setSelectedCapacity(availableCapacities[0]);
      } else if (availableCapacities.length > 1) {
        const capacitiesWithPrices = availableCapacities.map(capacity => {
          let price = 0;
          if (Array.isArray(product.capacityPricing) && product.capacityPricing.length > 0) {
            const pricing = product.capacityPricing.find(p => String(p.capacity || p.size) === String(capacity));
            price = pricing ? parseFloat(pricing.currentPrice || pricing.price || 0) || 0 : parseFloat(product.price) || 0;
          } else {
            price = parseFloat(product.price) || 0;
          }
          return { capacity, price };
        });
        capacitiesWithPrices.sort((a, b) => b.price - a.price);
        setSelectedCapacity(capacitiesWithPrices[0].capacity);
      } else {
        setSelectedCapacity('');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product]);

  const getImageUrl = (imagePath) => {
    if (!imagePath) return '';
    
    if (imagePath.startsWith('data:')) {
      return imagePath;
    }
    
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      if (imagePath.includes('localhost:5001')) {
        const backendUrl = getBackendUrl();
        return imagePath.replace('http://localhost:5001', backendUrl);
      }
      return imagePath;
    }
    
    const backendUrl = getBackendUrl();
    const needsEncoding = /[\s%]/.test(imagePath);
    const finalPath = needsEncoding ? encodeURI(imagePath) : imagePath;
    
    return `${backendUrl}${finalPath}`;
  };

  const fetchProduct = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let response;
      if (isCategoryBasedUrl) {
        // New format: /:categorySlug/:productSlug
        // Fetch via API: /api/products/:categorySlug/:productSlug
        response = await api.get(`/products/${categorySlug}/${productSlug}`);
      } else if (
        isLegacyIndexedProductsUrl &&
        productSlug &&
        /^\/products\/[^/]+$/i.test(location.pathname)
      ) {
        // Indexed /products/:slug — lookup by slug only (same as /product/:slug API)
        response = await api.get(`/drinks/${encodeURIComponent(productSlug)}`);
      } else {
        // Old format: /product/:id
        response = await api.get(`/drinks/${id}`);
      }
      
      const productData = response.data;
      setProduct(productData);
      setDescriptionLoading(true);
      setTestingNotesLoading(true);
    } catch (err) {
      console.error('Error fetching product:', err);
      setError('Product not found');
    } finally {
      setLoading(false);
    }
  };

  const ProductPageSkeleton = () => (
    <Container
      maxWidth="lg"
      sx={{
        py: 4,
        overflowX: 'hidden',
        maxWidth: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 3
      }}
    >
      {/* Breadcrumbs placeholder */}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', opacity: 0.6 }}>
        <Box sx={{ width: 70, height: 14, borderRadius: 1, bgcolor: 'rgba(0,0,0,0.08)' }} />
        <Box sx={{ width: 35, height: 14, borderRadius: 1, bgcolor: 'rgba(0,0,0,0.08)' }} />
        <Box sx={{ width: 100, height: 14, borderRadius: 1, bgcolor: 'rgba(0,0,0,0.08)' }} />
      </Box>

      {/* Title placeholder */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ width: '70%', height: 40, maxWidth: 520, borderRadius: 1, bgcolor: 'rgba(0,0,0,0.08)', mx: 'auto' }} />
      </Box>

      <Grid container spacing={3} sx={{ alignItems: 'flex-start', justifyContent: 'center', minWidth: 0 }}>
        {/* Image placeholder */}
        <Grid item xs={12} md={5} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Card sx={{ width: '100%', overflow: 'hidden' }}>
            <Box
              sx={{
                width: '100%',
                height: { xs: 300, md: 350 },
                minHeight: { xs: 300, md: 350 },
                maxHeight: { xs: 300, md: 350 },
                backgroundColor: 'rgba(0,0,0,0.08)'
              }}
            />
          </Card>
        </Grid>

        {/* Options/description placeholders */}
        <Grid item xs={12} md={7} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Box sx={{ width: '100%', maxWidth: 520 }}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center', mb: 2 }}>
              <Box sx={{ width: 110, height: 34, borderRadius: 999, bgcolor: 'rgba(0,0,0,0.08)' }} />
              <Box sx={{ width: 130, height: 34, borderRadius: 999, bgcolor: 'rgba(0,0,0,0.08)' }} />
              <Box sx={{ width: 110, height: 34, borderRadius: 999, bgcolor: 'rgba(0,0,0,0.08)' }} />
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box sx={{ width: '55%', height: 14, borderRadius: 1, bgcolor: 'rgba(0,0,0,0.08)' }} />
              <Box sx={{ width: '65%', height: 14, borderRadius: 1, bgcolor: 'rgba(0,0,0,0.08)' }} />
              <Box sx={{ width: '90%', height: 14, borderRadius: 1, bgcolor: 'rgba(0,0,0,0.08)' }} />
              <Box sx={{ width: '100%', height: 42, borderRadius: 1, bgcolor: 'rgba(0,0,0,0.08)', mt: 1 }} />
            </Box>
          </Box>
        </Grid>
      </Grid>

      {/* Description placeholder */}
      <Box sx={{ mt: 1 }}>
        <Box sx={{ width: 220, height: 16, borderRadius: 1, bgcolor: 'rgba(0,0,0,0.08)', mb: 1 }} />
        <Box sx={{ width: '100%', height: 14, borderRadius: 1, bgcolor: 'rgba(0,0,0,0.08)', mb: 1 }} />
        <Box sx={{ width: '100%', height: 14, borderRadius: 1, bgcolor: 'rgba(0,0,0,0.08)', mb: 1 }} />
        <Box sx={{ width: '80%', height: 14, borderRadius: 1, bgcolor: 'rgba(0,0,0,0.08)' }} />
      </Box>
    </Container>
  );

  const fetchRelatedProducts = async () => {
    try {
      if (!product) return;
      
      // Fetch products from the same category
      const response = await api.get('/drinks');
      const allProducts = Array.isArray(response.data) ? response.data : [];
      
      // Filter related products (same category, exclude current product, limit to 4)
      const related = allProducts
        .filter(drink => 
          drink.id !== product.id && 
          drink.categoryId === product.categoryId &&
          drink.isAvailable
        )
        .slice(0, 4);
      
      setRelatedProducts(related);
    } catch (err) {
      console.error('Error fetching related products:', err);
    }
  };

  const fetchDetailedDescription = async () => {
    try {
      if (!product) return;
      
      setDescriptionLoading(true);
      console.log(`Fetching detailed description for product: ${product.name} (ID: ${product.id})`);
      
      // Use slug if available, otherwise fall back to ID
      const identifier = product.slug || product.id;
      const response = await api.get(`/drinks/${identifier}/detailed-description`);
      
      console.log('Detailed description response:', response.data);
      
      if (response.data && response.data.description) {
        console.log(`Received description, length: ${response.data.description.length}`);
        setDetailedDescription(response.data.description);
      } else {
        console.log('No description in response');
        setDetailedDescription(null);
      }
    } catch (err) {
      console.error('Error fetching detailed description:', err);
      console.error('Error details:', err.response?.data || err.message);
      // If detailed description fails, we'll use the cleaned product description
      setDetailedDescription(null);
    } finally {
      setDescriptionLoading(false);
    }
  };

  const fetchTestingNotes = async () => {
    try {
      if (!product) return;
      
      setTestingNotesLoading(true);
      console.log(`Fetching testing notes for product: ${product.name} (ID: ${product.id})`);
      
      // Use slug if available, otherwise fall back to ID
      const identifier = product.slug || product.id;
      const response = await api.get(`/drinks/${identifier}/testing-notes`);
      
      console.log('Testing notes response:', response.data);
      
      if (response.data && response.data.testingNotes) {
        console.log(`Received testing notes, length: ${response.data.testingNotes.length}`);
        setTestingNotes(response.data.testingNotes);
      } else {
        console.log('No testing notes in response');
        setTestingNotes('N/A');
      }
    } catch (err) {
      console.error('Error fetching testing notes:', err);
      console.error('Error details:', err.response?.data || err.message);
      setTestingNotes('N/A');
    } finally {
      setTestingNotesLoading(false);
    }
  };

  const getAvailableCapacities = () => {
    if (!product) return [];
    return Array.isArray(product.capacityPricing) && product.capacityPricing.length > 0 
      ? product.capacityPricing.map(pricing => pricing.capacity || pricing.size)
      : Array.isArray(product.capacity) && product.capacity.length > 0 
      ? product.capacity 
      : [];
  };

  const getPriceForCapacity = (capacity) => {
    if (!product) return 0;
    if (Array.isArray(product.capacityPricing) && product.capacityPricing.length > 0) {
      const pricing = product.capacityPricing.find(p => String(p.capacity || p.size) === String(capacity));
      return pricing ? parseFloat(pricing.currentPrice || pricing.price) || 0 : parseFloat(product.price) || 0;
    }
    return parseFloat(product.price) || 0;
  };


  const handleAddToCart = () => {
    if (!product) return;
    
    const availableCapacities = getAvailableCapacities();
    if (availableCapacities.length > 0 && !selectedCapacity) {
      alert('Please select a capacity first');
      return;
    }
    
    const productToAdd = {
      ...product,
      selectedCapacity: selectedCapacity,
      selectedPrice: selectedCapacity ? getPriceForCapacity(selectedCapacity) : product.price
    };
    
    addToCart(productToAdd, 1);
  };

  // Get product URL for sharing
  const getProductUrl = () => {
    if (!product) return '';
    if (product.category?.slug && product.slug) {
      return `${window.location.origin}/${normalizeSlug(product.category.slug)}/${normalizeSlug(product.slug)}`;
    } else if (product.slug) {
      return `${window.location.origin}/product/${normalizeSlug(product.slug)}`;
    } else {
      return `${window.location.origin}/product/${product.id}`;
    }
  };

  // Get share text
  const getShareText = () => {
    if (!product) return '';
    const brandName = typeof product.brand === 'object' && product.brand !== null 
      ? product.brand.name 
      : (product.brand || product.name);
    const price = selectedCapacity 
      ? getPriceForCapacity(selectedCapacity) 
      : (product.price || 0);
    return `Check out ${product.name} at Dial A Drink Kenya! ${brandName ? `(${brandName})` : ''} - KES ${Math.round(price)}`;
  };

  // Handle share menu open
  const handleShareClick = (event) => {
    event.stopPropagation();
    setShareMenuAnchor(event.currentTarget);
  };

  // Handle share menu close
  const handleShareMenuClose = () => {
    setShareMenuAnchor(null);
  };

  // Share on WhatsApp
  const handleShareWhatsApp = () => {
    const url = getProductUrl();
    const text = getShareText();
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`;
    window.open(whatsappUrl, '_blank');
    handleShareMenuClose();
  };

  // Share on Twitter/X
  const handleShareTwitter = () => {
    const url = getProductUrl();
    const text = getShareText();
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(twitterUrl, '_blank');
    handleShareMenuClose();
  };

  // Share on Facebook
  const handleShareFacebook = () => {
    const url = getProductUrl();
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    window.open(facebookUrl, '_blank');
    handleShareMenuClose();
  };

  // Copy link to clipboard
  const handleCopyLink = async () => {
    try {
      const url = getProductUrl();
      await navigator.clipboard.writeText(url);
      setSnackbarMessage('Link copied to clipboard!');
      setSnackbarOpen(true);
      handleShareMenuClose();
    } catch (error) {
      console.error('Error copying link:', error);
      setSnackbarMessage('Failed to copy link');
      setSnackbarOpen(true);
    }
  };

  const generateProductTitle = () => {
    if (!product) return '';
    const capacities = getAvailableCapacities();
    if (capacities.length > 0) {
      const capacityList = capacities.join(' & ');
      return `${product.name} (${capacityList})`;
    }
    return product.name;
  };

  // eslint-disable-next-line no-unused-vars
  const generateIntro = () => {
    if (!product) return '';
    
    const type = product.type || 'drink';
    const origin = product.origin || product.country || '';
    // const abv = product.abv ? `${product.abv}%` : ''; // Unused
    
    let intro = `${product.name} is a`;
    if (type) intro += ` ${type.toLowerCase()}`;
    if (origin) intro += ` from ${origin}`;
    intro += ', known for';
    
    if (product.description) {
      const desc = product.description.split('.')[0];
      intro += ` ${desc.toLowerCase()}`;
    } else {
      intro += ' its quality and flavor';
    }
    
    const capacities = getAvailableCapacities();
    if (capacities.length > 0) {
      intro += `. Available in ${capacities.join(', ')} bottles, ${product.name} is`;
    } else {
      intro += `. ${product.name} is`;
    }
    
    intro += ' one of the most popular choices in Kenya.';
    
    return intro;
  };

  const getProductType = () => {
    if (!product) return '';
    // Try to infer from category or name
    const name = product.name.toLowerCase();
    if (name.includes('whiskey') || name.includes('whisky')) return 'Whiskey';
    if (name.includes('vodka')) return 'Vodka';
    if (name.includes('gin')) return 'Gin';
    if (name.includes('tequila')) return 'Tequila';
    if (name.includes('wine')) return 'Wine';
    if (name.includes('beer')) return 'Beer';
    if (name.includes('rum')) return 'Rum';
    if (name.includes('brandy')) return 'Brandy';
    if (name.includes('cognac')) return 'Cognac';
    return product.type || 'Spirit';
  };

  // eslint-disable-next-line no-unused-vars
  const getProducer = () => {
    if (!product) return '';
    // Common producers based on brand
    const brandName = typeof product.brand === 'object' && product.brand !== null 
      ? product.brand.name 
      : (product.brand || product.name || '');
    const brand = brandName.toLowerCase();
    if (brand.includes('jameson')) return 'Pernod Ricard';
    if (brand.includes('jack daniel')) return 'Brown-Forman';
    if (brand.includes('johnnie walker')) return 'Diageo';
    if (brand.includes('absolut')) return 'Pernod Ricard';
    if (brand.includes('hennessy')) return 'Moët Hennessy';
    if (brand.includes('martell')) return 'Martell & Co.';
    return 'Various';
  };



  const getProductDescription = () => {
    if (!product) return { sentences: [], fullText: '' };
    
    let description = '';
    
    // Use the full description from database (with HTML stripped) for "For More Information" section
    // Show the complete content, not the cleaned/promotional-removed version
    if (product.description && product.description.length > 0) {
      console.log(`[ProductPage] Using full product description from database, length: ${product.description.length}`);
      // Strip HTML but keep all the content (don't remove promotional text)
      description = stripHtml(product.description);
    } else if (detailedDescription && detailedDescription.length > 0) {
      console.log(`[ProductPage] Using detailed description, length: ${detailedDescription.length}`);
      description = detailedDescription;
    }
    
    // If no description, generate a basic one
    if (!description || description.length < 30) {
      const productType = getProductType();
      const origin = product.origin || product.country || '';
      const brand = typeof product.brand === 'object' && product.brand !== null 
        ? product.brand.name 
        : (product.brand || product.name);
      
      description = `${brand} is a distinguished ${productType.toLowerCase()}`;
      if (origin) {
        description += ` hailing from ${origin}`;
      }
      description += `. It represents a fine example of craftsmanship in the spirits industry.`;
      
      if (product.abv) {
        description += ` With an alcohol content of ${product.abv}%, it offers a balanced character.`;
      }
      
      description += ` The product has earned recognition among connoisseurs for its refined qualities.`;
    }
    
    // Split into sentences
    const sentences = description
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 10)
      .map(s => {
        // Ensure sentence ends with proper punctuation
        if (!/[.!?]$/.test(s)) {
          s += '.';
        }
        return s;
      });
    
    return {
      sentences,
      fullText: description
    };
  };

  if (loading && !product) {
    // Keep the overall product layout visible while data loads (prevents blank page + lone spinner).
    return <ProductPageSkeleton />;
  }

  if (error || !product) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">{error || 'Product not found'}</Alert>
        <Button onClick={() => navigate('/menu')} sx={{ mt: 2 }}>
          Back to Menu
        </Button>
      </Container>
    );
  }

  // IMPORTANT:
  // Do not block the whole page while description/testing notes load.
  // The JSX below already renders "Loading..." placeholders in those sections.

  const availableCapacities = getAvailableCapacities();
  const imageUrl = getImageUrl(product.image);
  const { fullText: productDescription } = getProductDescription();
  const resolvedPrice = selectedCapacity
    ? getPriceForCapacity(selectedCapacity)
    : parseFloat(product.price) || 0;
  const inStock = Boolean(product.isAvailable);
  const brandName = typeof product.brand === 'object' && product.brand !== null
    ? product.brand.name
    : product.brand;
  const normalizedBarcode = product.barcode != null ? String(product.barcode).trim() : '';
  const isGtinCandidate = /^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(normalizedBarcode);
  /** Google merchant listing: incomplete OfferShippingDetails (missing deliveryTime, etc.) marks items invalid. Prefer org-level shipping/returns; keep Offer minimal. */
  const canonicalOrigin = getCanonicalSiteOrigin();
  let absoluteImageUrl = '';
  if (imageUrl && /^https?:\/\//i.test(imageUrl)) {
    absoluteImageUrl = imageUrl;
  } else if (imageUrl) {
    absoluteImageUrl = `${canonicalOrigin}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
  }
  const schemaImages = absoluteImageUrl
    ? [absoluteImageUrl]
    : [`${canonicalOrigin}/assets/images/drinks/placeholder.svg`];
  const rawOfferPrice = parseFloat(resolvedPrice);
  const schemaPrice = Number.isFinite(rawOfferPrice)
    ? Math.round(rawOfferPrice * 100) / 100
    : 0;
  const validUntil = new Date();
  validUntil.setFullYear(validUntil.getFullYear() + 1);
  const priceValidUntil = validUntil.toISOString().slice(0, 10);

  let gtinFields = {};
  if (isGtinCandidate) {
    const len = normalizedBarcode.length;
    if (len === 8) gtinFields = { gtin8: normalizedBarcode };
    else if (len === 12) gtinFields = { gtin12: normalizedBarcode };
    else if (len === 13) gtinFields = { gtin13: normalizedBarcode };
    else if (len === 14) gtinFields = { gtin14: normalizedBarcode };
  }

  const productStructuredData = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: product.name,
    image: schemaImages,
    description: productDescription || `${product.name} from Dial a Drink Kenya.`,
    brand: brandName ? { '@type': 'Brand', name: brandName } : undefined,
    sku: product.id != null ? String(product.id) : undefined,
    ...gtinFields,
    offers: {
      '@type': 'Offer',
      url: buildProductCanonicalUrl(product),
      priceCurrency: 'KES',
      price: schemaPrice,
      priceValidUntil,
      availability: inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition'
    }
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productStructuredData) }}
      />
      <Container maxWidth="lg" sx={{ py: 4, overflowX: 'hidden', maxWidth: '100%' }}>
      {/* Breadcrumbs: Home › Menu › Category › Product name */}
        <Breadcrumbs
          separator=" › "
          aria-label="breadcrumb"
          sx={{ mb: 2, minWidth: 0, flexWrap: 'wrap' }}
        >
          <Link component={RouterLink} to="/" underline="hover" color="inherit">
            Home
          </Link>
          <Link component={RouterLink} to="/menu" underline="hover" color="inherit">
            Menu
          </Link>
        {product.category && (
          <Link
            component={RouterLink}
            to={
              product.category?.slug
                ? `/${normalizeSlug(product.category.slug)}`
                : `/${String(product.categoryId)}`
            }
            underline="hover"
            color="inherit"
          >
            {product.category.name}
          </Link>
        )}
        <Typography color="text.primary">{product.name}</Typography>
      </Breadcrumbs>

      {/* Product Title at Top */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'center', width: '100%', minWidth: 0 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, textAlign: 'center', wordBreak: 'break-word', maxWidth: '100%' }}>
          {generateProductTitle()}
        </Typography>
      </Box>

      <Grid container spacing={3} sx={{ alignItems: 'flex-start', justifyContent: 'center', minWidth: 0 }}>
        {/* Product Image - Left Column */}
        <Grid item xs={12} md={5} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', minWidth: 0 }}>
          <Card sx={{ width: '100%', minWidth: 0, overflow: 'hidden' }}>
            <Box
              sx={{
                width: '100%',
                height: { xs: 300, md: 350 },
                minHeight: { xs: 300, md: 350 },
                maxHeight: { xs: 300, md: 350 },
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#fff',
                overflow: 'hidden'
              }}
            >
              {imageUrl && !imageError ? (
                <CardMedia
                  component="img"
                  image={imageUrl}
                  alt={product.name}
                  sx={{ 
                    objectFit: 'contain', 
                    width: '100%',
                    height: '100%',
                    maxWidth: '100%',
                    maxHeight: '100%',
                    p: 2
                  }}
                  onLoad={() => setImageLoaded(true)}
                  onError={() => setImageError(true)}
                />
              ) : (
                <LocalBar sx={{ fontSize: 80, color: '#666' }} />
              )}
            </Box>
          </Card>
          {(() => {
            const brandId = product.brandId || (product.brand && typeof product.brand === 'object' && product.brand.id) || null;
            const brandName = product.brand && typeof product.brand === 'object' ? product.brand.name : (typeof product.brand === 'string' ? product.brand : null);
            if (!brandId || !brandName) return null;
            const brandPath = buildBrandPath({ id: brandId, name: brandName });
            return (
              <Box sx={{ mt: 2, textAlign: 'center' }}>
                <Link
                  component={RouterLink}
                  to={brandPath}
                  sx={{
                    fontSize: '0.95rem',
                    fontWeight: 500,
                    color: colors.accentText || '#00E0B8',
                    '&:hover': { textDecoration: 'underline' }
                  }}
                >
                  More {brandName} products
                </Link>
              </Box>
            );
          })()}
          {/* Capacities and Pricing - Mobile Only (above Buy Now button) */}
          <Box sx={{ display: { xs: 'block', md: 'none' }, mt: 2 }}>
            {availableCapacities.length > 0 ? (
              <FormControl component="fieldset" sx={{ width: '100%', mb: 3 }}>
                <RadioGroup
                  value={selectedCapacity}
                  onChange={(e) => setSelectedCapacity(e.target.value)}
                  sx={{ gap: 0, width: '100%' }}
                >
                  {Array.isArray(product.capacityPricing) && product.capacityPricing.length > 0
                    ? (() => {
                        // Deduplicate by capacity, keeping the first occurrence
                        const seen = new Set();
                        const uniquePricing = product.capacityPricing.filter(pricing => {
                          const capacity = pricing.capacity || pricing.size;
                          if (seen.has(capacity)) {
                            return false;
                          }
                          seen.add(capacity);
                          return true;
                        });
                        
                        return uniquePricing.map((pricing, index) => {
                          const capacity = pricing.capacity || pricing.size;
                          const price = parseFloat(pricing.currentPrice || pricing.price) || 0;
                          
                          return (
                            <FormControlLabel
                              key={`${product.id}-${capacity}-${index}-mobile`}
                              value={capacity}
                              control={
                                  <Radio
                                  sx={{
                                    color: colors.textPrimary,
                                    padding: '4px',
                                    marginRight: '4px',
                                    fontSize: '1.5rem',
                                    '&.Mui-checked': { color: colors.accentText },
                                    '& .MuiSvgIcon-root': {
                                      fontSize: '1.5rem'
                                    }
                                  }}
                                />
                              }
                              label={
                                <Box sx={{ width: '100%', minWidth: 0, flex: 1 }}>
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', gap: 0.5, flexWrap: 'wrap' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0, flex: 1, flexWrap: 'wrap' }}>
                                      <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.9rem', color: colors.accentText, wordBreak: 'break-word' }}>
                                        {capacity}
                                      </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0, flexWrap: 'wrap' }}>
                                      <Typography variant="body2" sx={{ color: colors.accentText, fontWeight: 'bold', fontSize: '0.9rem' }}>
                                        KES {Math.round(price)}
                                      </Typography>
                                    </Box>
                                  </Box>
                                </Box>
                              }
                              sx={{
                                border: 'none',
                                borderRadius: 1,
                                backgroundColor: selectedCapacity === capacity ? '#f5f5f5' : 'transparent',
                                p: 0.1,
                                m: 0,
                                width: '100%',
                                marginLeft: 0,
                                marginRight: 0,
                                alignItems: 'center',
                                '& .MuiFormControlLabel-label': {
                                  marginLeft: '4px',
                                  width: '100%'
                                },
                                '&:hover': {
                                  backgroundColor: '#f0f0f0'
                                }
                              }}
                            />
                          );
                        });
                      })()
                    : availableCapacities.map((capacity, index) => {
                        // Fallback for drinks with capacity array but no capacityPricing
                        const price = getPriceForCapacity(capacity);
                        return (
                          <FormControlLabel
                            key={`${product.id}-${capacity}-${index}-mobile`}
                            value={capacity}
                            control={
                              <Radio
                                sx={{
                                  color: colors.textPrimary,
                                  padding: '4px',
                                  marginRight: '4px',
                                  '&.Mui-checked': { color: colors.accentText }
                                }}
                              />
                            }
                            label={
                              <Box sx={{ width: '100%', minWidth: 0, flex: 1 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', gap: 0.5, flexWrap: 'wrap' }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0, flex: 1, flexWrap: 'wrap' }}>
                                    <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.7rem', color: colors.accentText, wordBreak: 'break-word' }}>
                                      {capacity}
                                    </Typography>
                                  </Box>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0, flexWrap: 'wrap' }}>
                                    <Typography variant="body2" sx={{ color: colors.accentText, fontWeight: 'bold', fontSize: '0.7rem' }}>
                                      KES {Math.round(price)}
                                    </Typography>
                                  </Box>
                                </Box>
                              </Box>
                            }
                            sx={{
                              border: 'none',
                              borderRadius: 1,
                              backgroundColor: selectedCapacity === capacity ? '#f5f5f5' : 'transparent',
                              p: 0.1,
                              m: 0,
                              width: '100%',
                              marginLeft: 0,
                              marginRight: 0,
                              alignItems: 'center',
                              '& .MuiFormControlLabel-label': {
                                marginLeft: '4px',
                                width: '100%'
                              },
                              '&:hover': {
                                backgroundColor: '#f0f0f0'
                              }
                            }}
                          />
                        );
                      })}
                </RadioGroup>
              </FormControl>
            ) : (
              <Typography variant="h5" sx={{ fontWeight: 'bold', color: colors.accentText, mb: 3 }}>
                KES {Math.round(Number(product.price) || 0)}
              </Typography>
            )}
          </Box>
          
          {/* Share and Buy Now Buttons - Mobile Only (below capacities) */}
          <Box sx={{ display: { xs: 'flex', md: 'none' }, mt: 2, gap: 1, alignItems: 'center' }}>
            <IconButton
              onClick={handleShareClick}
              sx={{
                backgroundColor: colors.paper,
                border: `1px solid ${colors.border || '#ddd'}`,
                '&:hover': {
                  backgroundColor: '#f5f5f5'
                }
              }}
            >
              <Share />
            </IconButton>
            <Button
              variant="contained"
              size="medium"
              startIcon={<AddShoppingCart />}
              onClick={handleAddToCart}
              sx={{
                backgroundColor: '#FF6B6B',
                py: 1,
                px: 2,
                fontSize: '0.9rem',
                flex: 1,
                maxWidth: '350px',
                '&:hover': {
                  backgroundColor: '#FF5252'
                },
                '&.Mui-disabled': {
                  backgroundColor: '#ccc',
                  color: '#666'
                }
              }}
            >
              Buy Now
            </Button>
          </Box>
        </Grid>

        {/* Product Details - Right Column */}
        <Grid item xs={12} md={7} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0 }}>
          {/* Status Chips */}
          <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center', width: '100%' }}>
            {product.isAvailable && product.isPopular && (
              <Chip icon={<Star />} label="Popular" color="secondary" size="small" />
            )}
            {product.limitedTimeOffer && (
              <Chip icon={<LocalOffer />} label="Limited Time" size="small" sx={{ backgroundColor: '#00E0B8', color: '#0D0D0D' }} />
            )}
          </Box>

          {/* Product Details */}
          <Box sx={{ mb: 2, width: '100%', minWidth: 0, display: 'flex', justifyContent: 'center' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, width: '100%', alignItems: 'flex-start' }}>
              {/* Product name */}
              <Box sx={{ display: 'flex', flexDirection: 'row', width: '100%', alignItems: 'flex-start' }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', minWidth: '120px', fontSize: '0.85rem', textAlign: 'left' }}>
                  Product name:
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.85rem', textAlign: 'left', flex: 1 }}>
                  {product.name}
                </Typography>
              </Box>

              {/* Prices by capacity */}
              {availableCapacities.length > 0 ? (
                availableCapacities.map((capacity) => {
                  const price = getPriceForCapacity(capacity);
                  return (
                    <Box key={capacity} sx={{ display: 'flex', flexDirection: 'row', width: '100%', alignItems: 'flex-start' }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', minWidth: '120px', fontSize: '0.85rem', textAlign: 'left' }}>
                        {capacity} price:
                      </Typography>
                      <Typography variant="body2" sx={{ fontSize: '0.85rem', textAlign: 'left', flex: 1 }}>
                        KES {Math.round(price).toLocaleString('en-KE')}
                      </Typography>
                    </Box>
                  );
                })
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'row', width: '100%', alignItems: 'flex-start' }}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', minWidth: '120px', fontSize: '0.85rem', textAlign: 'left' }}>
                    Price:
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: '0.85rem', textAlign: 'left', flex: 1 }}>
                    KES {Math.round(Number(product.price) || 0).toLocaleString('en-KE')}
                  </Typography>
                </Box>
              )}

              {/* Product category */}
              <Box sx={{ display: 'flex', flexDirection: 'row', width: '100%', alignItems: 'flex-start' }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', minWidth: '120px', fontSize: '0.85rem', textAlign: 'left' }}>
                  Product category:
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.85rem', textAlign: 'left', flex: 1 }}>
                  {getProductType()}
                </Typography>
              </Box>

              {/* Alcohol content (ABV) */}
              <Box sx={{ display: 'flex', flexDirection: 'row', width: '100%', alignItems: 'flex-start' }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', minWidth: '120px', fontSize: '0.85rem', textAlign: 'left' }}>
                  Alcohol content (ABV):
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.85rem', textAlign: 'left', flex: 1 }}>
                  {product.abv ? `${product.abv}%` : 'N/A'}
                </Typography>
              </Box>

              {/* Nicotine (NBV) - when > 0 and not null, for Vapes (%) and Pouches / Nicotine pouches (mg) */}
              {product.nbv != null && product.nbv !== '' && Number(product.nbv) > 0 && (() => {
                const catName = (product.category?.name || '').toLowerCase();
                const subName = (product.subCategory?.name || '').toLowerCase();
                const isVape = catName.includes('vape') || subName.includes('vape');
                const isPouch = catName.includes('pouch') || catName.includes('nicotine') || subName.includes('pouch') || subName.includes('nicotine');
                if (!isVape && !isPouch) return null;
                const label = isVape ? `${Number(product.nbv)}% NBV` : `${Number(product.nbv)} mg NBV`;
                return (
                  <Box sx={{ display: 'flex', flexDirection: 'row', width: '100%', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', minWidth: '120px', fontSize: '0.85rem', textAlign: 'left' }}>
                      Nicotine (NBV):
                    </Typography>
                    <Chip
                      label={label}
                      size="small"
                      sx={{
                        backgroundColor: isVape ? '#9C27B0' : '#607D8B',
                        color: '#F5F5F5',
                        fontSize: '0.75rem',
                        height: '22px'
                      }}
                    />
                  </Box>
                );
              })()}

              {/* Country */}
              <Box sx={{ display: 'flex', flexDirection: 'row', width: '100%', alignItems: 'flex-start' }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', minWidth: '120px', fontSize: '0.85rem', textAlign: 'left' }}>
                  Country:
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.85rem', textAlign: 'left', flex: 1 }}>
                  {product.origin || product.country || 'N/A'}
                </Typography>
              </Box>

              {/* Brand */}
              <Box sx={{ display: 'flex', flexDirection: 'row', width: '100%', alignItems: 'flex-start' }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', minWidth: '120px', fontSize: '0.85rem', textAlign: 'left' }}>
                  Brand:
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.85rem', textAlign: 'left', flex: 1 }}>
                  {typeof product.brand === 'object' && product.brand !== null ? product.brand.name : (product.brand || product.name)}
                </Typography>
              </Box>

              {/* Tasting notes */}
              <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', width: '100%', maxWidth: '400px' }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', minWidth: '120px', flexShrink: 0, fontSize: '0.85rem', textAlign: 'left' }}>
                  Tasting notes:
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    flex: 1,
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word',
                    fontSize: '0.85rem',
                    textAlign: 'left',
                    // Reserve space so loading tasting notes doesn't cause layout jumps.
                    minHeight: '120px'
                  }}
                >
                  {testingNotesLoading ? 'Loading...' : (testingNotes || 'N/A')}
                </Typography>
              </Box>
            </Box>
          </Box>

          <Divider sx={{ my: 2, width: '100%' }} />

          {/* Capacities and Pricing - Desktop Only */}
          <Box sx={{ mb: 2, display: { xs: 'none', md: 'flex' }, justifyContent: 'center', maxWidth: '400px', width: '100%' }}>
            {availableCapacities.length > 0 ? (
              <FormControl component="fieldset" sx={{ width: '100%', mb: 3 }}>
                <RadioGroup
                  value={selectedCapacity}
                  onChange={(e) => setSelectedCapacity(e.target.value)}
                  sx={{ gap: 0, width: '100%' }}
                >
                  {Array.isArray(product.capacityPricing) && product.capacityPricing.length > 0
                    ? (() => {
                        // Deduplicate by capacity, keeping the first occurrence
                        const seen = new Set();
                        const uniquePricing = product.capacityPricing.filter(pricing => {
                          const capacity = pricing.capacity || pricing.size;
                          if (seen.has(capacity)) {
                            return false;
                          }
                          seen.add(capacity);
                          return true;
                        });
                        
                        return uniquePricing.map((pricing, index) => {
                          const capacity = pricing.capacity || pricing.size;
                          const price = parseFloat(pricing.currentPrice || pricing.price) || 0;
                          
                          return (
                            <FormControlLabel
                              key={`${product.id}-${capacity}-${index}`}
                              value={capacity}
                              control={
                                  <Radio
                                  sx={{
                                    color: colors.textPrimary,
                                    padding: '4px',
                                    marginRight: '4px',
                                    fontSize: '1.5rem',
                                    '&.Mui-checked': { color: colors.accentText },
                                    '& .MuiSvgIcon-root': {
                                      fontSize: '1.5rem'
                                    }
                                  }}
                                />
                              }
                              label={
                                <Box sx={{ width: '100%', minWidth: 0, flex: 1 }}>
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', gap: 0.5, flexWrap: 'wrap' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0, flex: 1, flexWrap: 'wrap' }}>
                                      <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.9rem', color: colors.accentText, wordBreak: 'break-word' }}>
                                        {capacity}
                                      </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0, flexWrap: 'wrap' }}>
                                      <Typography variant="body2" sx={{ color: colors.accentText, fontWeight: 'bold', fontSize: '0.9rem' }}>
                                        KES {Math.round(price)}
                                      </Typography>
                                    </Box>
                                  </Box>
                                </Box>
                              }
                              sx={{
                                border: 'none',
                                borderRadius: 1,
                                backgroundColor: selectedCapacity === capacity ? '#f5f5f5' : 'transparent',
                                p: 0.1,
                                m: 0,
                                width: '100%',
                                marginLeft: 0,
                                marginRight: 0,
                                alignItems: 'center',
                                '& .MuiFormControlLabel-label': {
                                  marginLeft: '4px',
                                  width: '100%'
                                },
                                '&:hover': {
                                  backgroundColor: '#f0f0f0'
                                }
                              }}
                            />
                          );
                        });
                      })()
                    : availableCapacities.map((capacity, index) => {
                        // Fallback for drinks with capacity array but no capacityPricing
                        const price = getPriceForCapacity(capacity);
                        return (
                          <FormControlLabel
                            key={`${product.id}-${capacity}-${index}`}
                            value={capacity}
                            control={
                              <Radio
                                sx={{
                                  color: colors.textPrimary,
                                  padding: '4px',
                                  marginRight: '4px',
                                  '&.Mui-checked': { color: colors.accentText }
                                }}
                              />
                            }
                            label={
                              <Box sx={{ width: '100%', minWidth: 0, flex: 1 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', gap: 0.5, flexWrap: 'wrap' }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0, flex: 1, flexWrap: 'wrap' }}>
                                    <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.7rem', color: colors.accentText, wordBreak: 'break-word' }}>
                                      {capacity}
                                    </Typography>
                                  </Box>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0, flexWrap: 'wrap' }}>
                                    <Typography variant="body2" sx={{ color: colors.accentText, fontWeight: 'bold', fontSize: '0.7rem' }}>
                                      KES {Math.round(price)}
                                    </Typography>
                                  </Box>
                                </Box>
                              </Box>
                            }
                            sx={{
                              border: 'none',
                              borderRadius: 1,
                              backgroundColor: selectedCapacity === capacity ? '#f5f5f5' : 'transparent',
                              p: 0.1,
                              m: 0,
                              width: '100%',
                              marginLeft: 0,
                              marginRight: 0,
                              alignItems: 'center',
                              '& .MuiFormControlLabel-label': {
                                marginLeft: '4px',
                                width: '100%'
                              },
                              '&:hover': {
                                backgroundColor: '#f0f0f0'
                              }
                            }}
                          />
                        );
                      })}
                </RadioGroup>
              </FormControl>
            ) : (
              <Typography variant="h5" sx={{ fontWeight: 'bold', color: colors.accentText, mb: 3 }}>
                KES {Math.round(Number(product.price) || 0)}
              </Typography>
            )}
          </Box>

          {/* Share and Buy Now Buttons - Desktop Only */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1, alignItems: 'center', mb: 2, maxWidth: '400px', width: '100%', justifyContent: 'center' }}>
              <IconButton
                onClick={handleShareClick}
                size="small"
                sx={{
                  backgroundColor: colors.paper,
                  border: `1px solid ${colors.border || '#ddd'}`,
                  '&:hover': {
                    backgroundColor: '#f5f5f5'
                  }
                }}
              >
                <Share fontSize="small" />
              </IconButton>
              <Button
                variant="contained"
                size="medium"
                startIcon={<AddShoppingCart />}
                onClick={handleAddToCart}
                sx={{
                  backgroundColor: '#FF6B6B',
                  py: 1,
                  px: 2,
                  fontSize: '0.9rem',
                  flex: 1,
                  maxWidth: '350px',
                  '&:hover': {
                    backgroundColor: '#FF5252'
                  },
                  '&.Mui-disabled': {
                    backgroundColor: '#ccc',
                    color: '#666'
                  }
                }}
              >
                Buy Now
              </Button>
            </Box>
        </Grid>
      </Grid>

      {/* Why Buy and How to Order Sections - Side by Side */}
      <Box sx={{ mt: 6, mb: 4 }}>
        <Divider sx={{ mb: 4 }} />
        <Box sx={{ width: '100%', maxWidth: '1200px', mx: 'auto', display: 'flex', justifyContent: 'center' }}>
          <Grid container spacing={3} sx={{ justifyContent: 'center' }}>
          {/* For More About Product Section */}
          <Grid item xs={12} sm={6} md={3} sx={{ display: 'flex' }}>
            <Card 
              sx={{ 
                width: '100%',
                height: '100%',
                p: 3,
                backgroundColor: '#f8f9fa',
                border: `1px solid #e0e0e0`,
                borderRadius: 2,
                boxShadow: 2
              }}
            >
              <Typography 
                variant="h5" 
                component="h2" 
                gutterBottom 
                sx={{ 
                  fontWeight: 600, 
                  mb: 2,
                  textAlign: 'center'
                }}
              >
                For More About {product.name}
              </Typography>
              {descriptionLoading ? (
                <Box sx={{ py: 2 }}>
                  <Box
                    ref={aboutTextRef}
                    sx={{
                      overflow: 'hidden',
                      transition: 'max-height 450ms ease',
                      maxHeight: aboutTextMaxHeight
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                      <CircularProgress size={24} />
                    </Box>
                    <Typography
                      variant="body1"
                      sx={{
                        fontSize: '1rem',
                        lineHeight: 1.8,
                        textAlign: 'left',
                        fontFamily: '"Lato", "Georgia", serif',
                        color: 'text.secondary'
                      }}
                    >
                      Loading... Loading... Loading...
                    </Typography>
                  </Box>

                  {/* Reserve the Read More link space so the card doesn't jump */}
                  <Box
                    sx={{
                      mt: 1,
                      width: '130px',
                      height: '34px',
                      borderRadius: 1,
                      backgroundColor: 'rgba(0,0,0,0.08)'
                    }}
                  />
                </Box>
              ) : (() => {
                const { sentences } = getProductDescription();
                const firstThree = sentences.slice(0, 3);
                const remaining = sentences.slice(3);
                const hasMore = remaining.length > 0;
                
                if (sentences.length === 0) {
                  return (
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontSize: '0.9rem', 
                        textAlign: 'center',
                        color: 'text.secondary',
                        fontStyle: 'italic'
                      }}
                    >
                      Description loading...
                    </Typography>
                  );
                }
                
                return (
                  <Box>
                    <Box
                      ref={aboutTextRef}
                      sx={{
                        overflow: 'hidden',
                        transition: 'max-height 450ms ease',
                        maxHeight: aboutTextMaxHeight
                      }}
                    >
                      <Typography 
                        variant="body1" 
                        sx={{ 
                          fontSize: '1rem', 
                          lineHeight: 1.8, 
                          textAlign: 'left',
                          mb: 0,
                          fontFamily: '"Lato", "Georgia", serif'
                        }}
                      >
                        {firstThree.map((sentence, index) => (
                          <React.Fragment key={index}>
                            {sentence}
                            {index < firstThree.length - 1 && ' '}
                          </React.Fragment>
                        ))}
                        {descriptionExpanded && remaining.length > 0 && (
                          <>
                            {' '}
                            {remaining.map((sentence, index) => (
                              <React.Fragment key={`remaining-${index}`}>
                                {sentence}
                                {index < remaining.length - 1 && ' '}
                              </React.Fragment>
                            ))}
                          </>
                        )}
                      </Typography>
                    </Box>

                    {/* Keep the link area reserved; animate only the text height */}
                    <Button
                      onClick={() => {
                        if (!hasMore) return;
                        setDescriptionExpanded(!descriptionExpanded);
                      }}
                      sx={{
                        mt: 1,
                        textTransform: 'none',
                        fontSize: '0.9rem',
                        color: colors.accentText,
                        visibility: hasMore ? 'visible' : 'hidden',
                        '&:hover': {
                          backgroundColor: 'transparent',
                          textDecoration: 'underline'
                        }
                      }}
                    >
                      {descriptionExpanded ? 'Read Less' : 'Read More'}
                    </Button>
                  </Box>
                );
              })()}
            </Card>
          </Grid>

          {/* Why Buy Section */}
          <Grid item xs={12} sm={6} md={3} sx={{ display: 'flex' }}>
            <Card 
              sx={{ 
                width: '100%',
                height: '100%',
                p: 3,
                backgroundColor: '#f8f9fa',
                border: `1px solid #e0e0e0`,
                borderRadius: 2,
                boxShadow: 2
              }}
            >
              <Typography 
                variant="h5" 
                component="h2" 
                gutterBottom 
                sx={{ 
                  fontWeight: 600, 
                  mb: 2, 
                  textAlign: 'center',
                  lineHeight: 1.3,
                  wordBreak: 'break-word',
                  whiteSpace: 'normal',
                  hyphens: 'auto'
                }}
              >
                Why Buy {product.name}<br />from Dial A Drink Kenya
              </Typography>
              <Box 
                component="ul" 
                sx={{ 
                  pl: 0, 
                  margin: 0,
                  textAlign: 'center',
                  listStyle: 'none',
                  '& li': { 
                    mb: 1.5,
                    textAlign: 'center',
                    fontSize: '1rem',
                    lineHeight: 1.6,
                    '&::before': {
                      content: '"• "',
                      marginRight: '0.5rem'
                    }
                  } 
                }}
              >
                <li>Delivery all across Nairobi and its environs</li>
                <li>Fast delivery (20–30 minutes)</li>
                <li>Competitive prices</li>
                <li>Genuine products</li>
              </Box>
            </Card>
          </Grid>

          {/* How to Order Section */}
          <Grid item xs={12} sm={6} md={3} sx={{ display: 'flex' }}>
            <Card 
              sx={{ 
                width: '100%',
                height: '100%',
                p: 3,
                backgroundColor: '#f8f9fa',
                border: `1px solid #e0e0e0`,
                borderRadius: 2,
                boxShadow: 2
              }}
            >
              <Typography 
                variant="h5" 
                component="h2" 
                gutterBottom 
                sx={{ 
                  fontWeight: 600, 
                  mb: 2,
                  textAlign: 'center'
                }}
              >
                How to Order
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={() => navigate('/menu')}
                  sx={{
                    backgroundColor: colors.accentText,
                    color: '#fff',
                    fontWeight: 600,
                    py: 1.5,
                    '&:hover': {
                      backgroundColor: colors.accentText,
                      opacity: 0.9
                    }
                  }}
                >
                  Order Online
                </Button>
                <Button
                  variant="outlined"
                  fullWidth
                  component="a"
                  href="tel:0723688108"
                  sx={{
                    borderColor: colors.accentText,
                    color: colors.accentText,
                    fontWeight: 600,
                    py: 1.5,
                    '&:hover': {
                      borderColor: colors.accentText,
                      backgroundColor: 'rgba(0, 0, 0, 0.05)'
                    }
                  }}
                >
                  Call to Order
                </Button>
              </Box>
              <Typography variant="body1" sx={{ fontSize: '1rem', lineHeight: 1.7, textAlign: 'center' }}>
                We are available 24/7
              </Typography>
            </Card>
          </Grid>

          {/* Delivery Outside Nairobi Section */}
          <Grid item xs={12} sm={6} md={3} sx={{ display: 'flex' }}>
            <Card 
              sx={{ 
                width: '100%',
                height: '100%',
                p: 3,
                backgroundColor: '#f8f9fa',
                border: `1px solid #e0e0e0`,
                borderRadius: 2,
                boxShadow: 2
              }}
            >
              <Typography 
                variant="h5" 
                component="h2" 
                gutterBottom 
                sx={{ 
                  fontWeight: 600, 
                  mb: 2,
                  textAlign: 'center'
                }}
              >
                Delivery Outside Nairobi?
              </Typography>
              <Typography variant="body1" sx={{ fontSize: '1rem', lineHeight: 1.7, textAlign: 'center' }}>
                We deliver all over Kenya. Contact us today.
              </Typography>
            </Card>
          </Grid>
        </Grid>
        </Box>
      </Box>

      {/* Related Products – reserve space from first paint to avoid layout shift */}
      <Box sx={{ mt: 6, minHeight: 420 }}>
        <Divider sx={{ mb: 4 }} />
        <Typography variant="h4" component="h2" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
          Similar to {product.name}
        </Typography>
        <Box sx={{ 
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, 1fr)',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)',
            lg: 'repeat(4, 1fr)'
          },
          gap: { xs: 1, sm: 2 },
          width: '100%'
        }}>
          {relatedProducts.length > 0
            ? relatedProducts.map((relatedProduct) => (
                <DrinkCard key={relatedProduct.id} drink={relatedProduct} />
              ))
            : [...Array(4)].map((_, i) => (
                <Box
                  key={`placeholder-${i}`}
                  sx={{
                    minHeight: { xs: 350, sm: 450, md: 500 },
                    backgroundColor: 'rgba(0,0,0,0.04)',
                    borderRadius: 1
                  }}
                />
              ))}
        </Box>
      </Box>

      {/* Share Menu */}
      <Menu
        anchorEl={shareMenuAnchor}
        open={Boolean(shareMenuAnchor)}
        onClose={handleShareMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
      >
        <MenuItem onClick={handleShareWhatsApp}>
          <ListItemIcon>
            <WhatsApp fontSize="small" sx={{ color: '#25D366' }} />
          </ListItemIcon>
          <ListItemText>Share on WhatsApp</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleShareTwitter}>
          <ListItemIcon>
            <Twitter fontSize="small" sx={{ color: '#1DA1F2' }} />
          </ListItemIcon>
          <ListItemText>Share on Twitter (X)</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleShareFacebook}>
          <ListItemIcon>
            <Facebook fontSize="small" sx={{ color: '#1877F2' }} />
          </ListItemIcon>
          <ListItemText>Share on Facebook</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleCopyLink}>
          <ListItemIcon>
            <ContentCopy fontSize="small" />
          </ListItemIcon>
          <ListItemText>Copy Link</ListItemText>
        </MenuItem>
      </Menu>

      {/* Snackbar for copy link feedback */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
      </Container>
    </>
  );
};

export default ProductPage;

