import React, { useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Container, Typography, CircularProgress, Box } from '@mui/material';

/**
 * Legacy compatibility for URLs like:
 *   /products?brand=grey-goose&sort=price_desc
 *
 * The new UI uses /brands/:identifier for brand listings.
 * This route prevents blank pages by redirecting client-side.
 */
export default function LegacyProducts() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const brand = searchParams.get('brand');

  const redirectTarget = useMemo(() => {
    if (brand) return `/brands/${brand}`;
    return '/menu';
  }, [brand]);

  useEffect(() => {
    // Replace so we don't keep /products in browser history.
    navigate(redirectTarget, { replace: true });
  }, [navigate, redirectTarget]);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress size={24} />
        <Typography variant="body1" color="text.secondary">
          Loading...
        </Typography>
      </Box>
    </Container>
  );
}

