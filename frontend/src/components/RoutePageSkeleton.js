import React from 'react';
import { Box, Container, Skeleton, Stack } from '@mui/material';

/**
 * Shown during lazy-route code splitting while the backend may still be cold-starting.
 * Keeps layout stable (helps CLS) versus a bare "Loading..." string.
 */
export default function RoutePageSkeleton() {
  return (
    <Box
      component="main"
      sx={{ minHeight: '55vh', py: { xs: 3, md: 4 }, px: 2 }}
      aria-busy="true"
      aria-label="Loading page"
    >
      <Container maxWidth="lg">
        <Stack spacing={2}>
          <Skeleton variant="rounded" height={44} sx={{ maxWidth: 280, borderRadius: 1 }} animation="wave" />
          <Skeleton variant="rounded" height={140} sx={{ borderRadius: 1 }} animation="wave" />
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
              gap: 2,
            }}
          >
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} variant="rounded" height={200} sx={{ borderRadius: 1 }} animation="wave" />
            ))}
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}
