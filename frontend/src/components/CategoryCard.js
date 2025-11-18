import React, { useState } from 'react';
import {
  Card,
  CardMedia,
  CardContent,
  Typography,
  Box
} from '@mui/material';
import { LocalBar } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const CategoryCard = ({ category }) => {
  const navigate = useNavigate();
  const [imageError, setImageError] = useState(false);

  const handleClick = () => {
    navigate(`/menu?category=${category.id}`);
  };

  // Helper function to get full image URL
  const getImageUrl = (imagePath) => {
    if (!imagePath) return null;
    
    // If it's already a full URL, return as is
    if (imagePath.startsWith('http')) {
      return imagePath;
    }
    
    // For relative paths, construct the full URL
    const isHosted =
      window.location.hostname.includes('onrender.com') ||
      window.location.hostname.includes('run.app');
    const baseUrl = isHosted
      ? 'https://dialadrink-backend-910510650031.us-central1.run.app'
      : 'http://localhost:5001';
    
    return `${baseUrl}${imagePath}`;
  };

  const imageUrl = getImageUrl(category.image);

  return (
    <Card
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#fff',
        transition: 'transform 0.2s',
        cursor: 'pointer',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 2
        }
      }}
      onClick={handleClick}
    >
      {imageUrl && !imageError ? (
        <CardMedia
          component="img"
          height="200"
          image={imageUrl}
          alt={category.name}
          sx={{ objectFit: 'contain', p: 1, backgroundColor: '#fff' }}
          onError={() => {
            setImageError(true);
          }}
        />
      ) : (
        <Box
          sx={{
            height: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#fff',
            color: '#666'
          }}
        >
          <LocalBar sx={{ fontSize: 60 }} />
        </Box>
      )}
      <CardContent sx={{ flexGrow: 1, overflow: 'visible', display: 'flex', flexDirection: 'column', backgroundColor: '#fff' }}>
        <Typography variant="subtitle1" component="div" sx={{ fontSize: '0.9rem', fontWeight: 'bold', mb: 0.5, color: '#000' }}>
          {category.name}
        </Typography>
        {/* Hide description for Soft Drinks category */}
        {category.name !== 'Soft Drinks' && category.description && (
          <Typography
            variant="body2"
            sx={{ mb: 1, minHeight: '30px', fontSize: '0.75rem', color: '#000' }}
          >
            {category.description}
          </Typography>
        )}
        <Box sx={{ mt: 'auto' }}>
          <Typography variant="body2" sx={{ color: '#000', fontWeight: 'bold', fontSize: '0.75rem' }}>
            {category.drinksCount || 0} {category.drinksCount === 1 ? 'item' : 'items'}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default CategoryCard;

