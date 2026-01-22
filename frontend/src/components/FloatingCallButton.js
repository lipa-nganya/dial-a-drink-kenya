import React from 'react';
import { Fab, Tooltip, useMediaQuery, useTheme as useMUITheme } from '@mui/material';
import { Phone } from '@mui/icons-material';
import { useTheme } from '../contexts/ThemeContext';

const FloatingCallButton = () => {
  const { colors } = useTheme();
  const muiTheme = useMUITheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));
  const phoneNumber = '+254723688108'; // Format: +254723688108 (no spaces for tel: link)

  const handleCall = () => {
    // Open dial pad with phone number prepopulated
    window.location.href = `tel:${phoneNumber}`;
  };

  // Only show on mobile
  if (!isMobile) {
    return null;
  }

  return (
    <Tooltip title="Call Us" placement="left">
      <Fab
        color="primary"
        aria-label="call"
        onClick={handleCall}
        sx={{
          position: 'fixed',
          bottom: 24,
          left: 24, // Position on left side to avoid conflict with help button on right
          backgroundColor: '#00E0B8',
          color: '#0D0D0D',
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          '&:hover': {
            backgroundColor: '#00C4A3',
            boxShadow: '0 6px 16px rgba(0, 0, 0, 0.2)',
          },
        }}
      >
        <Phone />
      </Fab>
    </Tooltip>
  );
};

export default FloatingCallButton;
