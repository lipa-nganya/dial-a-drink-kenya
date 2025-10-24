import React from 'react';
import { Container, Typography, Box } from '@mui/material';

const TestOffers = () => {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box textAlign="center">
        <Typography variant="h3" component="h1" gutterBottom>
          🎉 Offers Page is Working!
        </Typography>
        <Typography variant="h6" color="text.secondary">
          This is a test to verify the routing is working correctly.
        </Typography>
        <Typography variant="body1" sx={{ mt: 2 }}>
          If you can see this page, the React Router is working properly.
        </Typography>
      </Box>
    </Container>
  );
};

export default TestOffers;
