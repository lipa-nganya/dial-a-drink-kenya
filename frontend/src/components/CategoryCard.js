import React from 'react';
import {
  Card,
  CardMedia,
  CardContent,
  Typography,
  Box
} from '@mui/material';
import { useNavigate } from 'react-router-dom';

const CategoryCard = ({ category }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/menu?category=${category.id}`);
  };

  return (
    <Card
      sx={{
        maxWidth: 300,
        cursor: 'pointer',
        transition: 'transform 0.2s',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 4
        }
      }}
      onClick={handleClick}
    >
      <CardMedia
        component="img"
        height="200"
        image={category.image}
        alt={category.name}
        sx={{ objectFit: 'cover' }}
      />
      <CardContent>
        <Typography variant="h6" component="div" gutterBottom>
          {category.name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {category.description}
        </Typography>
        <Box sx={{ mt: 1 }}>
          <Typography variant="body2" color="primary">
            {category.drinks?.length || 0} items available
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default CategoryCard;
