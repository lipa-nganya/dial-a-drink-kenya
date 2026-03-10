import React, { useState, useEffect } from 'react';
import { Box, Button } from '@mui/material';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

const CategoriesBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { colors } = useTheme();
  const [categories, setCategories] = useState([]);

  const isOnMenu = location.pathname === '/menu';
  const selectedCategoryId = isOnMenu ? (() => {
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

  const handleCategoryClick = (categoryId) => {
    navigate(`/menu?category=${categoryId}`);
  };

  if (categories.length === 0) return null;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0,
        overflowX: 'auto',
        flexWrap: 'nowrap',
        px: 1,
        py: 0.75,
        borderTop: '1px solid rgba(0, 0, 0, 0.08)',
        backgroundColor: colors.paper || '#FFFFFF',
        '&::-webkit-scrollbar': { height: 4 },
        '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 2 },
      }}
    >
      {categories.map((category) => {
        const isSelected = selectedCategoryId != null && category.id === selectedCategoryId;
        return (
          <Button
            key={category.id}
            onClick={() => handleCategoryClick(category.id)}
            sx={{
              textTransform: 'uppercase',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: isSelected ? '#000000' : (colors.textPrimary || '#000000'),
              backgroundColor: isSelected ? (colors.accent || '#00E0B8') : 'transparent',
              minWidth: 'auto',
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
