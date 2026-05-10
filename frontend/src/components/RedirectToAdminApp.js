import React, { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import { getAdminSiteOrigin, mapEmbeddedAdminPathToStandalone } from '../utils/adminSiteUrl';

/**
 * Customer SPA no longer bundles admin UI. Any /admin/* URL sends the browser to the standalone admin app.
 */
const RedirectToAdminApp = () => {
  const location = useLocation();

  useLayoutEffect(() => {
    const origin = getAdminSiteOrigin();
    const pathWithQs = mapEmbeddedAdminPathToStandalone(
      location.pathname,
      location.search,
      location.hash
    );
    window.location.replace(`${origin}${pathWithQs}`);
  }, [location.pathname, location.search, location.hash]);

  return (
    <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <CircularProgress size={28} />
      <Typography variant="body2" color="text.secondary">
        Opening admin…
      </Typography>
    </Box>
  );
};

export default RedirectToAdminApp;
