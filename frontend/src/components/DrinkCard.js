/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import {
  Card,
  CardMedia,
  CardContent,
  CardActions,
  Typography,
  Button,
  Box,
  Chip,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Snackbar
} from '@mui/material';
import {
  AddShoppingCart,
  Star,
  Cancel,
  LocalOffer,
  LocalBar,
  Share,
  WhatsApp,
  Twitter,
  Facebook,
  ContentCopy
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useTheme } from '../contexts/ThemeContext';
import { getBackendUrl } from '../utils/backendUrl';

const DrinkCard = ({ drink }) => {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { colors } = useTheme();
  const [selectedCapacity, setSelectedCapacity] = useState('');
  const [imageError, setImageError] = useState(false);
  const [shareMenuAnchor, setShareMenuAnchor] = useState(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Helper function to get full image URL
  const getImageUrl = (imagePath) => {
    if (!imagePath) return '';
    
    // If it's a base64 data URL, return as is
    if (imagePath.startsWith('data:')) {
      return imagePath;
    }
    
    // If it's already a full URL, check if it's localhost and replace
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      // Replace localhost URLs with backend URL
      if (imagePath.includes('localhost:5001')) {
        const backendUrl = getBackendUrl();
        return imagePath.replace('http://localhost:5001', backendUrl);
      }
      return imagePath;
    }
    
    // For relative paths, construct the full URL using backend URL utility
    const backendUrl = getBackendUrl();
    // Use encodeURI which preserves / characters but encodes spaces and special chars
    // Only encode if the path contains spaces or special characters
    const needsEncoding = /[\s%]/.test(imagePath);
    const finalPath = needsEncoding ? encodeURI(imagePath) : imagePath;
    
    return `${backendUrl}${finalPath}`;
  };

  // Get available capacities from capacityPricing or fallback to capacity array
  const availableCapacities = Array.isArray(drink.capacityPricing) && drink.capacityPricing.length > 0 
    ? drink.capacityPricing.map(pricing => pricing.capacity || pricing.size)
    : Array.isArray(drink.capacity) && drink.capacity.length > 0 
    ? drink.capacity 
    : [];

  // Auto-select capacity: if only one option, select it; if multiple, select most expensive
  useEffect(() => {
    if (availableCapacities.length === 1) {
      // Only one capacity - select it
      setSelectedCapacity(availableCapacities[0]);
    } else if (availableCapacities.length > 1 && !selectedCapacity) {
      // Multiple capacities - select the most expensive one
      const capacitiesWithPrices = availableCapacities.map(capacity => {
        let price = 0;
        if (Array.isArray(drink.capacityPricing) && drink.capacityPricing.length > 0) {
          const pricing = drink.capacityPricing.find(p => String(p.capacity || p.size) === String(capacity));
          price = pricing ? parseFloat(pricing.currentPrice || pricing.price) || 0 : parseFloat(drink.price) || 0;
        } else {
          price = parseFloat(drink.price) || 0;
        }
        return { capacity, price };
      });
      
      // Sort descending by price to get most expensive first
      capacitiesWithPrices.sort((a, b) => b.price - a.price);
      
      // Select the most expensive capacity
      const mostExpensive = capacitiesWithPrices[0];
      setSelectedCapacity(mostExpensive.capacity);
      console.log(`[DrinkCard] Auto-selected most expensive capacity for ${drink.name}: ${mostExpensive.capacity} (KES ${Math.round(mostExpensive.price)})`);
    } else if (availableCapacities.length === 0) {
      // No capacities - clear selection
      setSelectedCapacity('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableCapacities]);

  // Get price for selected capacity
  const getPriceForCapacity = (capacity) => {
    if (Array.isArray(drink.capacityPricing) && drink.capacityPricing.length > 0) {
      const pricing = drink.capacityPricing.find(p => String(p.capacity || p.size) === String(capacity));
      return pricing ? parseFloat(pricing.currentPrice || pricing.price) || 0 : parseFloat(drink.price) || 0;
    }
    return parseFloat(drink.price) || 0;
  };

  const handleAddToCart = (e) => {
    e.stopPropagation(); // Prevent card click when clicking add to cart
    if (availableCapacities.length > 0 && !selectedCapacity) {
      alert('Please select a capacity first');
      return;
    }
    
    const drinkToAdd = {
      ...drink,
      selectedCapacity: selectedCapacity,
      selectedPrice: selectedCapacity ? getPriceForCapacity(selectedCapacity) : drink.price
    };
    
    addToCart(drinkToAdd, 1);
  };

  const handleCardClick = () => {
    // Use category-based URL if both category and product slugs are available
    if (drink.category?.slug && drink.slug) {
      navigate(`/${drink.category.slug}/${drink.slug}`);
    } else if (drink.slug) {
      // Fallback to old format if category slug is missing
      navigate(`/product/${drink.slug}`);
    } else {
      // Last resort: use ID
      navigate(`/product/${drink.id}`);
    }
  };

  // Get product URL for sharing
  const getProductUrl = () => {
    if (drink.category?.slug && drink.slug) {
      return `${window.location.origin}/${drink.category.slug}/${drink.slug}`;
    } else if (drink.slug) {
      return `${window.location.origin}/product/${drink.slug}`;
    } else {
      return `${window.location.origin}/product/${drink.id}`;
    }
  };

  // Get share text
  const getShareText = () => {
    const brandName = typeof drink.brand === 'object' && drink.brand !== null 
      ? drink.brand.name 
      : (drink.brand || drink.name);
    const price = selectedCapacity 
      ? getPriceForCapacity(selectedCapacity) 
      : (drink.price || 0);
    return `Check out ${drink.name} at Dial A Drink Kenya! ${brandName ? `(${brandName})` : ''} - KES ${Math.round(price)}`;
  };

  // Handle share menu open
  const handleShareClick = (e) => {
    e.stopPropagation(); // Prevent card click when clicking share
    setShareMenuAnchor(e.currentTarget);
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

  return (
    <Card
      onClick={handleCardClick}
      sx={{
        width: '100%',
        maxWidth: '100%',
        height: '100%',
        minHeight: { xs: '350px', sm: '450px', md: '500px' },
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#fff',
        transition: 'transform 0.2s',
        cursor: 'pointer',
        boxSizing: 'border-box',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 2
        }
      }}
    >
      <Box
        onClick={handleCardClick}
        sx={{
          width: '100%',
          height: { xs: 180, sm: 220, md: 260 },
          minHeight: { xs: 180, sm: 220, md: 260 },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#fff',
          cursor: 'pointer',
          overflow: 'hidden'
        }}
      >
        {getImageUrl(drink.image) && !imageError ? (
          <CardMedia
            component="img"
            image={getImageUrl(drink.image)}
            alt={drink.name}
            sx={{ 
              objectFit: 'contain', 
              width: '100%',
              height: '100%',
              p: { xs: 1, sm: 1.5, md: 2 }
            }}
            onError={() => {
              setImageError(true);
            }}
          />
        ) : (
          <LocalBar sx={{ fontSize: { xs: 40, sm: 50, md: 60 }, color: '#666' }} />
        )}
      </Box>
      <CardContent sx={{ 
        flexGrow: 1, 
        overflow: 'visible', 
        display: 'flex', 
        flexDirection: 'column', 
        backgroundColor: '#fff', 
        pb: availableCapacities.length >= 2 ? 1 : 0,
        px: { xs: 1, sm: 1.5, md: 2 },
        pt: { xs: 1, sm: 1.5, md: 2 }
      }}>
        {/* Status Label Above Name */}
        <Box sx={{ mb: 0.5, display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
          {!drink.isAvailable && (
            <Chip
              icon={<Cancel />}
              label="Out of Stock"
              size="small"
              sx={{ 
                fontSize: '0.65rem', 
                height: '20px',
                backgroundColor: '#666',
                color: '#F5F5F5'
              }}
            />
          )}
          {drink.isAvailable && drink.isPopular && (
            <Chip
              icon={<Star />}
              label="Popular"
              size="small"
              color="secondary"
              sx={{ fontSize: '0.65rem', height: '20px' }}
            />
          )}
          {drink.limitedTimeOffer && (
            <Chip
              icon={<LocalOffer />}
              label="Limited Time"
              size="small"
              sx={{ 
                fontSize: '0.65rem', 
                height: '20px',
                backgroundColor: '#00E0B8',
                color: '#0D0D0D'
              }}
            />
          )}
        </Box>
        
        {/* Drink Name */}
        <Typography variant="subtitle1" component="div" sx={{ fontSize: '0.9rem', fontWeight: 'bold', mb: 0.5, color: colors.textPrimary }}>
          {drink.name}
        </Typography>

        {/* Capacity Selection with Radio Buttons */}
        {availableCapacities.length > 0 ? (
          <Box sx={{ mb: availableCapacities.length >= 3 ? 2 : availableCapacities.length > 1 ? 1.5 : 1 }}>
            <FormControl component="fieldset" sx={{ width: '100%' }}>
              <RadioGroup
                value={selectedCapacity}
                onChange={(e) => {
                  e.stopPropagation();
                  setSelectedCapacity(e.target.value);
                }}
                onClick={(e) => e.stopPropagation()}
                sx={{ gap: 0, width: '100%' }}
              >
                {Array.isArray(drink.capacityPricing) && drink.capacityPricing.length > 0
                  ? (() => {
                      // Deduplicate by capacity, keeping the first occurrence
                      const seen = new Set();
                      const uniquePricing = drink.capacityPricing.filter(pricing => {
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
                            key={`${drink.id}-${capacity}-${index}`}
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
                        });
                    })()
                  : availableCapacities.map((capacity, index) => {
                      // Fallback for drinks with capacity array but no capacityPricing
                      const price = parseFloat(drink.price) || 0;
                      return (
                        <FormControlLabel
                          key={`${drink.id}-${capacity}-${index}`}
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
          </Box>
        ) : (
          /* Fallback to old pricing display */
          <Box sx={{ mb: 1 }}>
            <Typography
              variant="subtitle1"
              sx={{ fontWeight: 'bold', fontSize: '0.9rem', color: colors.accentText }}
            >
              KES {Math.round(Number(drink.price) || 0)}
            </Typography>
          </Box>
        )}

               {/* ABV Display */}
               {drink.abv && (
                 <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', mb: availableCapacities.length >= 2 ? 1 : 0, mt: 0 }}>
                   <Chip
                     label={`${Number(drink.abv)}% ABV`}
                     size="small"
                     sx={{
                       backgroundColor: '#FF3366',
                       color: '#F5F5F5',
                       fontSize: '0.65rem',
                       height: '20px'
                     }}
                   />
                 </Box>
               )}
             </CardContent>

             <CardActions sx={{ p: 0, px: { xs: 0.5, sm: 1 }, pb: { xs: 0.5, sm: 1 }, pt: 0, display: 'flex', gap: 0.5 }}>
        <Tooltip title="Share">
          <IconButton
            size="small"
            onClick={handleShareClick}
            sx={{
              color: colors.accentText || '#FF6B6B',
              '&:hover': {
                backgroundColor: 'rgba(255, 107, 107, 0.1)'
              }
            }}
          >
            <Share fontSize="small" />
          </IconButton>
        </Tooltip>
        <Button
          fullWidth
          variant="contained"
          size="small"
          startIcon={<AddShoppingCart />}
          onClick={handleAddToCart}
          disabled={!drink.isAvailable}
          sx={{
            backgroundColor: '#FF6B6B',
            fontSize: '0.75rem',
            py: 0.5,
            flex: 1,
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
      </CardActions>

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
    </Card>
  );
};

export default DrinkCard;
