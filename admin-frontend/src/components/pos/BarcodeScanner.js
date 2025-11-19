import React from 'react';
import { Box, Typography, Chip, CircularProgress } from '@mui/material';
import { useBarcodeScanner, SCANNER_STATES } from '../../hooks/useBarcodeScanner';

const BarcodeScanner = ({ onBarcodeScanned, enabled = true }) => {
  const { state, error, scannerRef, isReady, isScanning, isSuspended, hasError } = useBarcodeScanner(
    onBarcodeScanned,
    enabled
  );

  const getStateColor = () => {
    switch (state) {
      case SCANNER_STATES.READY:
        return 'success';
      case SCANNER_STATES.SCANNING:
        return 'info';
      case SCANNER_STATES.SUSPENDED:
        return 'warning';
      case SCANNER_STATES.ERROR:
        return 'error';
      default:
        return 'default';
    }
  };

  const getStateLabel = () => {
    switch (state) {
      case SCANNER_STATES.READY:
        return 'Ready';
      case SCANNER_STATES.SCANNING:
        return 'Scanning...';
      case SCANNER_STATES.SUSPENDED:
        return 'Suspended';
      case SCANNER_STATES.ERROR:
        return 'Error';
      default:
        return 'Unknown';
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Chip
          label={getStateLabel()}
          color={getStateColor()}
          size="small"
          icon={isScanning ? <CircularProgress size={16} color="inherit" /> : null}
        />
        {hasError && error && (
          <Typography variant="caption" color="error" sx={{ ml: 1 }}>
            {error}
          </Typography>
        )}
      </Box>
      
      {enabled && (
        <Box
          id="barcode-scanner"
          ref={scannerRef}
          sx={{
            width: '100%',
            minHeight: '150px',
            backgroundColor: '#000',
            borderRadius: 1,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            mt: 1
          }}
        />
      )}
    </Box>
  );
};

export default BarcodeScanner;

