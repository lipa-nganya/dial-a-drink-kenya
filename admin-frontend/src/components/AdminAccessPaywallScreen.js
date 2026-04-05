import React, { useCallback, useEffect, useState } from 'react';
import { Box, Typography, Button } from '@mui/material';
import {
  ADMIN_PAYWALL_COOLDOWN_MS,
  clearPaywallSession,
  readPaywallSession,
  writePaywallSession,
} from '../utils/adminPaywallSessionStorage';

/** Site owner contact for admin access paywall (tel: link prefills dialer). */
export const ADMIN_PAYWALL_CONTACT_PHONE = '+254727893741';
export const ADMIN_PAYWALL_CONTACT_TEL = `tel:${ADMIN_PAYWALL_CONTACT_PHONE}`;

/** Shown on paywall UI and returned in API bodies (keep in sync with backend). */
export const ADMIN_PAYWALL_MESSAGE =
  'Account temporarily in limited mode. Please contact site owner to restore full access.';

function formatCountdown(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function readInitialUnlockAt(sessionStorageKey) {
  if (sessionStorageKey && typeof window !== 'undefined') {
    const s = readPaywallSession(sessionStorageKey);
    if (s) return s.unlockAt;
  }
  return Date.now() + ADMIN_PAYWALL_COOLDOWN_MS;
}

/**
 * Full-viewport admin access lockout; non-dismissible overlay.
 * @param {object} props
 * @param {string} [props.sessionStorageKey] If set, cooldown survives full page refresh (sessionStorage).
 * @param {() => void | boolean | Promise<void | boolean>} [props.onRetry] If returning `true`, a new 5-minute cooldown starts (still blocked). Otherwise overlay is dismissed or access restored.
 */
export default function AdminAccessPaywallScreen({ onRetry, sessionStorageKey }) {
  const [unlockAt, setUnlockAt] = useState(() => readInitialUnlockAt(sessionStorageKey));
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const secondsRemaining = Math.max(0, Math.ceil((unlockAt - Date.now()) / 1000));
  const canRetry = secondsRemaining <= 0;

  const handleRetry = useCallback(async () => {
    if (!onRetry || !canRetry) return;
    const result = await Promise.resolve(onRetry());
    if (result === true) {
      const next = Date.now() + ADMIN_PAYWALL_COOLDOWN_MS;
      setUnlockAt(next);
      if (sessionStorageKey) {
        writePaywallSession(sessionStorageKey, next);
      }
    } else {
      if (sessionStorageKey) {
        clearPaywallSession(sessionStorageKey);
      }
    }
  }, [onRetry, canRetry, sessionStorageKey]);

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483647,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
        backgroundColor: '#000000',
      }}
    >
      <Box
        sx={{
          maxWidth: 420,
          width: '100%',
          textAlign: 'center',
        }}
      >
        <Typography
          component="h1"
          sx={{
            color: 'rgba(255,255,255,0.92)',
            fontSize: { xs: '1.05rem', sm: '1.15rem' },
            lineHeight: 1.55,
            mb: 3,
            px: 0.5,
            fontWeight: 500,
          }}
        >
          {ADMIN_PAYWALL_MESSAGE}
        </Typography>
        <Button
          component="a"
          href={ADMIN_PAYWALL_CONTACT_TEL}
          variant="contained"
          size="large"
          fullWidth
          sx={{
            py: 1.25,
            fontWeight: 600,
            letterSpacing: '0.02em',
            backgroundColor: '#F5F5F5',
            color: '#0D0D0D',
            boxShadow: 'none',
            '&:hover': {
              backgroundColor: '#E0E0E0',
              boxShadow: 'none',
            },
          }}
        >
          Contact site owner
        </Button>
        {onRetry && (
          <Button
            type="button"
            variant="outlined"
            size="large"
            fullWidth
            disabled={!canRetry}
            onClick={() => void handleRetry()}
            sx={{
              mt: 2,
              py: 1.25,
              fontWeight: 600,
              letterSpacing: '0.02em',
              color: '#F5F5F5',
              borderColor: 'rgba(255,255,255,0.35)',
              '&:hover': {
                borderColor: 'rgba(255,255,255,0.55)',
                backgroundColor: 'rgba(255,255,255,0.06)',
              },
              '&.Mui-disabled': {
                color: 'rgba(255,255,255,0.35)',
                borderColor: 'rgba(255,255,255,0.2)',
              },
            }}
          >
            {canRetry ? 'Retry login' : `Retry login (${formatCountdown(secondsRemaining)})`}
          </Button>
        )}
      </Box>
    </Box>
  );
}
