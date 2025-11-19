import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

const SCANNER_STATES = {
  READY: 'ready',
  SCANNING: 'scanning',
  SUSPENDED: 'suspended',
  ERROR: 'error'
};

const SUSPEND_DURATION = 2000; // 2 seconds

export const useBarcodeScanner = (onBarcodeScanned, enabled = true) => {
  const [state, setState] = useState(SCANNER_STATES.READY);
  const [error, setError] = useState(null);
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);
  const suspendTimeoutRef = useRef(null);
  const isScanningRef = useRef(false);
  const onBarcodeScannedRef = useRef(onBarcodeScanned);

  // Update callback ref when it changes
  useEffect(() => {
    onBarcodeScannedRef.current = onBarcodeScanned;
  }, [onBarcodeScanned]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (suspendTimeoutRef.current) {
      clearTimeout(suspendTimeoutRef.current);
      suspendTimeoutRef.current = null;
    }
    
    if (html5QrCodeRef.current) {
      html5QrCodeRef.current.stop().catch(() => {
        // Ignore stop errors
      });
      html5QrCodeRef.current.clear();
      html5QrCodeRef.current = null;
    }
    
    isScanningRef.current = false;
  }, []);

  // Handle barcode scan
  const handleScan = useCallback(async (decodedText) => {
    if (!enabled || isScanningRef.current) {
      return;
    }

    isScanningRef.current = true;
    setState(SCANNER_STATES.SCANNING);
    setError(null);

    try {
      // Call the callback to handle the scanned barcode
      await onBarcodeScannedRef.current(decodedText);
      
      // Suspend scanner to prevent repeated scans
      setState(SCANNER_STATES.SUSPENDED);
      
      // Resume after suspend duration
      suspendTimeoutRef.current = setTimeout(() => {
        setState(SCANNER_STATES.READY);
        isScanningRef.current = false;
      }, SUSPEND_DURATION);
    } catch (err) {
      console.error('Error processing barcode:', err);
      setError(err.message || 'Failed to process barcode');
      setState(SCANNER_STATES.ERROR);
      
      // Resume after error
      suspendTimeoutRef.current = setTimeout(() => {
        setState(SCANNER_STATES.READY);
        isScanningRef.current = false;
      }, SUSPEND_DURATION);
    }
  }, [enabled]);

  // Initialize scanner
  useEffect(() => {
    if (!enabled) {
      cleanup();
      setState(SCANNER_STATES.READY);
      return;
    }

    const initScanner = async () => {
      try {
        // Check if camera is available
        const devices = await Html5Qrcode.getCameras();
        if (devices.length === 0) {
          setError('No camera found');
          setState(SCANNER_STATES.ERROR);
          return;
        }

        // Use the first available camera
        const cameraId = devices[0].id;
        
        const scannerId = scannerRef.current?.id || 'barcode-scanner';
        const html5QrCode = new Html5Qrcode(scannerId);
        html5QrCodeRef.current = html5QrCode;

        await html5QrCode.start(
          cameraId,
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
          },
          handleScan,
          (errorMessage) => {
            // Ignore scanning errors (they're frequent during scanning)
          }
        );

        setState(SCANNER_STATES.READY);
        setError(null);
      } catch (err) {
        console.error('Error initializing scanner:', err);
        setError(err.message || 'Failed to initialize scanner');
        setState(SCANNER_STATES.ERROR);
      }
    };

    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      initScanner();
    }, 100);

    return () => {
      clearTimeout(timer);
      cleanup();
    };
  }, [enabled, handleScan, cleanup]);

  return {
    state,
    error,
    scannerRef,
    isReady: state === SCANNER_STATES.READY,
    isScanning: state === SCANNER_STATES.SCANNING,
    isSuspended: state === SCANNER_STATES.SUSPENDED,
    hasError: state === SCANNER_STATES.ERROR
  };
};

export { SCANNER_STATES };

