import React, { useState, useEffect, useRef } from 'react';
import { Box, Button } from '@mui/material';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { normalizeSlug } from '../utils/slugCanonical';

const CategoriesBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { colors } = useTheme();
  const [categories, setCategories] = useState([]);
  const isDraggingRef = useRef(false);
  const touchStartXRef = useRef(0);

  const isOnMenu = location.pathname === '/menu';
  const isDeliveryLocationPage = location.pathname.startsWith('/delivery-location/');
  const selectedCategoryId = (isOnMenu || isDeliveryLocationPage) ? (() => {
    const cat = searchParams.get('category');
    if (cat == null || cat === '') return null;
    const id = parseInt(cat, 10);
    return Number.isNaN(id) ? null : id;
  })() : null;

  useEffect(() => {
    let mounted = true;
    const fetchCategories = async () => {
      try {
        const response = await api.get('/categories');
        let list = Array.isArray(response.data) ? response.data : (response.data?.data || []);
        if (!Array.isArray(list)) list = [];
        list = list.filter(c => c.name && c.name.toLowerCase() !== 'test' && c.name.toLowerCase() !== 'popular');
        if (mounted) setCategories(list);
      } catch (err) {
        if (mounted) setCategories([]);
      }
    };
    fetchCategories();
    return () => { mounted = false; };
  }, []);

  const handleCategoryClick = (category) => {
    // On mobile, horizontal swipes inside a scroll container can still trigger
    // a click on the touched button. That navigation makes the scroll feel
    // "stuck" (snaps back to the selected category). Ignore clicks after a drag.
    if (isDraggingRef.current) return;
    // Stay on delivery location detail pages; filter via query string (same as menu UX)
    if (isDeliveryLocationPage) {
      navigate({ pathname: location.pathname, search: `?category=${category.id}` });
      return;
    }
    const slug =
      normalizeSlug(category?.slug || category?.name || '') || String(category?.id || '');
    navigate(`/${slug}`);
  };

  const handleAllCategoriesClick = () => {
    if (isDraggingRef.current) return;
    if (isDeliveryLocationPage) {
      navigate({ pathname: location.pathname, search: '' });
    }
  };

  if (categories.length === 0) return null;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 0,
        overflowX: 'auto',
        overflowY: 'hidden',
        flexWrap: 'nowrap',
        width: '100%',
        touchAction: 'pan-x',
        WebkitOverflowScrolling: 'touch',
        px: 1,
        py: 0.75,
        borderTop: '1px solid rgba(0, 0, 0, 0.08)',
        backgroundColor: colors.paper || '#FFFFFF',
        '&::-webkit-scrollbar': { height: 4 },
        '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 2 },
      }}
      onTouchStart={(e) => {
        if (!e.touches || e.touches.length === 0) return;
        isDraggingRef.current = false;
        touchStartXRef.current = e.touches[0].clientX;
      }}
      onTouchMove={(e) => {
        if (!e.touches || e.touches.length === 0) return;
        const startX = touchStartXRef.current;
        const currentX = e.touches[0].clientX;
        const dx = Math.abs(currentX - startX);
        if (dx > 6) isDraggingRef.current = true; // ~6px threshold to avoid false positives
      }}
      onTouchEnd={() => {
        // keep the value for the click handler that fires after touchend
        // (it will reset on the next touchstart)
      }}
      onTouchCancel={() => {
        isDraggingRef.current = false;
        touchStartXRef.current = 0;
      }}
    >
      {isDeliveryLocationPage && (
        <Button
          key="delivery-location-all-categories"
          onClick={handleAllCategoriesClick}
          sx={{
            textTransform: 'uppercase',
            fontSize: '0.8rem',
            fontWeight: 600,
            color: selectedCategoryId == null ? '#000000' : (colors.textPrimary || '#000000'),
            backgroundColor: selectedCategoryId == null ? (colors.accent || '#00E0B8') : 'transparent',
            minWidth: 'unset',
            flex: '0 0 auto',
            flexShrink: 0,
            px: 1.5,
            whiteSpace: 'nowrap',
            '&:hover': {
              backgroundColor: selectedCategoryId == null ? (colors.accent || '#00E0B8') : 'rgba(0, 0, 0, 0.04)',
            },
          }}
        >
          All
        </Button>
      )}
      {categories.map((category) => {
        const isSelected = selectedCategoryId != null && category.id === selectedCategoryId;
        return (
          <Button
            key={category.id}
            onClick={() => handleCategoryClick(category)}
            sx={{
              textTransform: 'uppercase',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: isSelected ? '#000000' : (colors.textPrimary || '#000000'),
              backgroundColor: isSelected ? (colors.accent || '#00E0B8') : 'transparent',
              minWidth: 'unset',
              flex: '0 0 auto',
              flexShrink: 0,
              px: 1.5,
              whiteSpace: 'nowrap',
              '&:hover': {
                backgroundColor: isSelected ? (colors.accent || '#00E0B8') : 'rgba(0, 0, 0, 0.04)',
              },
            }}
          >
            {category.name}
          </Button>
        );
      })}
    </Box>
  );
};

export default CategoriesBar;
