import React from 'react';
import {
  Box,
  Container,
  Grid,
  Typography,
  Link,
  Divider
} from '@mui/material';
import { LocalBar, Phone } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';

const Footer = () => {
  const navigate = useNavigate();
  const { colors } = useTheme();

  const handleLinkClick = (path) => {
    navigate(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Box
      component="footer"
      sx={{
        backgroundColor: colors.paper,
        borderTop: `1px solid ${colors.border}`,
        mt: 'auto',
        pt: 4,
        pb: 3
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={4} justifyContent="center">
          {/* DIAL A DRINK KENYA Section */}
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
              <LocalBar sx={{ color: colors.accentText, fontSize: 20 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colors.textPrimary, fontSize: '0.9rem' }}>
                DIAL A DRINK KENYA
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center' }}>
              <Link
                component="button"
                onClick={() => handleLinkClick('/brands')}
                sx={{
                  color: colors.textSecondary,
                  textDecoration: 'none',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  '&:hover': {
                    color: colors.accentText,
                    textDecoration: 'underline'
                  },
                  textAlign: 'center'
                }}
              >
                Brands
              </Link>
              <Link
                component="button"
                onClick={() => handleLinkClick('/delivery-locations')}
                sx={{
                  color: colors.textSecondary,
                  textDecoration: 'none',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  '&:hover': {
                    color: colors.accentText,
                    textDecoration: 'underline'
                  },
                  textAlign: 'center'
                }}
              >
                Delivery Locations
              </Link>
              <Link
                component="button"
                onClick={() => handleLinkClick('/pricelist')}
                sx={{
                  color: colors.textSecondary,
                  textDecoration: 'none',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  '&:hover': {
                    color: colors.accentText,
                    textDecoration: 'underline'
                  },
                  textAlign: 'center'
                }}
              >
                Our Pricelist
              </Link>
            </Box>
          </Grid>

          {/* GENERAL LINKS Section */}
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: colors.textPrimary, mb: 2, textAlign: 'center', fontSize: '0.9rem' }}>
              GENERAL LINKS
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center' }}>
              <Link
                component="button"
                onClick={() => handleLinkClick('/terms-of-service')}
                sx={{
                  color: colors.textSecondary,
                  textDecoration: 'none',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  '&:hover': {
                    color: colors.accentText,
                    textDecoration: 'underline'
                  },
                  textAlign: 'center'
                }}
              >
                Terms and Conditions
              </Link>
              <Link
                component="button"
                onClick={() => handleLinkClick('/privacy-policy')}
                sx={{
                  color: colors.textSecondary,
                  textDecoration: 'none',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  '&:hover': {
                    color: colors.accentText,
                    textDecoration: 'underline'
                  },
                  textAlign: 'center'
                }}
              >
                Privacy Policy
              </Link>
              <Link
                component="button"
                onClick={() => handleLinkClick('/sitemap')}
                sx={{
                  color: colors.textSecondary,
                  textDecoration: 'none',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  '&:hover': {
                    color: colors.accentText,
                    textDecoration: 'underline'
                  },
                  textAlign: 'center'
                }}
              >
                Sitemap
              </Link>
            </Box>
          </Grid>

          {/* Contact Information */}
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: colors.textPrimary, mb: 2, textAlign: 'center', fontSize: '0.9rem' }}>
              CONTACT US
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Phone sx={{ fontSize: 16, color: colors.accentText }} />
                <Link
                  href="tel:+254723688108"
                  sx={{
                    color: colors.textSecondary,
                    textDecoration: 'none',
                    fontSize: '0.8rem',
                    '&:hover': {
                      color: colors.accentText,
                      textDecoration: 'underline'
                    }
                  }}
                >
                  +254 723 688 108
                </Link>
              </Box>
            </Box>
          </Grid>

          {/* Payment Methods */}
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: colors.textPrimary, mb: 2, textAlign: 'center', fontSize: '0.9rem' }}>
              PAYMENT METHODS
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'center' }}>
              <Typography variant="body2" sx={{ color: colors.textSecondary, fontSize: '0.75rem' }}>
                • Swipe on Delivery
              </Typography>
              <Typography variant="body2" sx={{ color: colors.textSecondary, fontSize: '0.75rem' }}>
                • Pay Online - VISA or Mastercard
              </Typography>
              <Typography variant="body2" sx={{ color: colors.textSecondary, fontSize: '0.75rem' }}>
                • Pay via Mpesa
              </Typography>
            </Box>
          </Grid>
        </Grid>

        <Divider sx={{ my: 3, borderColor: colors.border }} />

        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body2" sx={{ color: colors.textSecondary, fontSize: '0.75rem' }}>
            © {new Date().getFullYear()} Dial a Drink Kenya - All Rights Reserved
          </Typography>
          <Typography variant="body2" sx={{ color: colors.textSecondary, fontSize: '0.75rem', mt: 1 }}>
            Developed with ❤️ by{' '}
            <Link
              href="https://thewolfgang.tech/"
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                color: colors.textSecondary,
                textDecoration: 'none',
                fontSize: '0.75rem',
                '&:hover': {
                  color: colors.accentText,
                  textDecoration: 'underline'
                }
              }}
            >
              Wolfgang
            </Link>
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default Footer;
