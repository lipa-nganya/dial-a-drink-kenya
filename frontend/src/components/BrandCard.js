import React from 'react';
import {
  Card,
  CardMedia,
  CardContent,
  Typography,
  Box
} from '@mui/material';
import { LocalBar } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { getBackendUrl } from '../utils/backendUrl';

const BrandCard = ({ brand }) => {
  const navigate = useNavigate();
  const { colors } = useTheme();
  const [imageError, setImageError] = React.useState(false);

  // Helper function to get full image URL
  const getImageUrl = (imagePath) => {
    if (!imagePath) return '';
    
    // If it's already a full URL, return as is
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    
    // For relative paths, construct the full URL
    const backendUrl = getBackendUrl();
    const needsEncoding = /[\s%]/.test(imagePath);
    const finalPath = needsEncoding ? encodeURI(imagePath) : imagePath;
    
    return `${backendUrl}${finalPath}`;
  };

  const handleCardClick = () => {
    navigate(`/brand/${brand.id}`);
  };

  return (
    <Card
      onClick={handleCardClick}
      sx={{
        width: '100%',
        height: '100%',
        minHeight: '500px',
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
    >
      {getImageUrl(brand.image) && !imageError ? (
        <CardMedia
          component="img"
          height="240"
          image={getImageUrl(brand.image)}
          alt={brand.name}
          sx={{ objectFit: 'contain', p: 2, backgroundColor: '#fff' }}
          onError={() => {
            setImageError(true);
          }}
        />
      ) : (
        <Box
          sx={{
            height: 240,
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
      <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#fff' }}>
        <Typography variant="subtitle1" component="div" sx={{ fontSize: '0.9rem', fontWeight: 'bold', mb: 1, color: colors.textPrimary }}>
          {brand.name}
        </Typography>
        
        {brand.country && (
          <Typography
            variant="body2"
            sx={{ 
              fontSize: '0.75rem', 
              color: colors.textSecondary,
              fontStyle: 'italic'
            }}
          >
            {brand.country}
          </Typography>
        )}
        
        {brand.description && (
          <Typography
            variant="body2"
            sx={{ 
              mt: 1,
              fontSize: '0.75rem', 
              color: colors.textSecondary,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}
          >
            {brand.description}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

export default BrandCard;
