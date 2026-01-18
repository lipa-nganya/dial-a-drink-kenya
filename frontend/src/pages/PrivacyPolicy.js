import React from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Button
} from '@mui/material';
import { PrivacyTip, ArrowBack } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';

const PrivacyPolicy = () => {
  const navigate = useNavigate();
  const { colors } = useTheme();

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate(-1)}
          sx={{ color: colors.textPrimary }}
        >
          Back
        </Button>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, color: colors.textPrimary }}>
          Privacy Policy
        </Typography>
      </Box>

      <Paper sx={{ p: 4, backgroundColor: colors.paper }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
          <PrivacyTip sx={{ fontSize: 40, color: colors.accent }} />
          <Typography variant="h5" sx={{ color: colors.textPrimary, fontWeight: 600 }}>
            Your Privacy Matters
          </Typography>
        </Box>

        <Typography variant="body1" sx={{ color: colors.textPrimary, mb: 3, lineHeight: 1.8 }}>
          <strong>Last Updated:</strong> {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </Typography>

        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ color: colors.textPrimary, fontWeight: 600, mb: 2 }}>
            1. Information We Collect
          </Typography>
          <Typography variant="body1" sx={{ color: colors.textPrimary, mb: 2, lineHeight: 1.8 }}>
            We collect information that you provide directly to us, including:
          </Typography>
          <Typography variant="body2" component="ul" sx={{ color: colors.textSecondary, pl: 3, mb: 2 }}>
            <li>Name, phone number, and email address</li>
            <li>Delivery address and location information</li>
            <li>Order history and preferences (including alcoholic beverage preferences)</li>
            <li>Payment information (processed securely through third-party providers)</li>
            <li>Age verification information (for compliance with alcohol sales regulations)</li>
            <li>ID verification data (when required for age verification at delivery)</li>
          </Typography>
        </Box>

        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ color: colors.textPrimary, fontWeight: 600, mb: 2 }}>
            2. How We Use Your Information
          </Typography>
          <Typography variant="body2" component="ul" sx={{ color: colors.textSecondary, pl: 3, mb: 2 }}>
            <li>Process and fulfill your orders for alcoholic beverages</li>
            <li>Verify age and identity for compliance with alcohol sales regulations</li>
            <li>Communicate with you about your orders and our services</li>
            <li>Improve our services and customer experience</li>
            <li>Send you promotional offers (with your consent, and only to customers of legal drinking age)</li>
            <li>Comply with legal obligations, including alcohol sales regulations and age verification requirements</li>
            <li>Prevent fraud and ensure responsible alcohol sales</li>
          </Typography>
        </Box>

        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ color: colors.textPrimary, fontWeight: 600, mb: 2 }}>
            3. Information Sharing
          </Typography>
          <Typography variant="body1" sx={{ color: colors.textPrimary, mb: 2, lineHeight: 1.8 }}>
            We do not sell your personal information. We may share your information with:
          </Typography>
          <Typography variant="body2" component="ul" sx={{ color: colors.textSecondary, pl: 3, mb: 2 }}>
            <li>Delivery drivers to fulfill your orders (including age verification requirements)</li>
            <li>Payment processors to handle transactions</li>
            <li>Service providers who assist in our operations</li>
            <li>Legal authorities when required by law, including alcohol regulatory bodies</li>
            <li>Age verification services to ensure compliance with alcohol sales regulations</li>
          </Typography>
        </Box>

        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ color: colors.textPrimary, fontWeight: 600, mb: 2 }}>
            4. Data Security
          </Typography>
          <Typography variant="body1" sx={{ color: colors.textPrimary, mb: 2, lineHeight: 1.8 }}>
            We implement appropriate security measures to protect your personal information. However, no method of transmission over the internet is 100% secure.
          </Typography>
        </Box>

        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ color: colors.textPrimary, fontWeight: 600, mb: 2 }}>
            5. Your Rights
          </Typography>
          <Typography variant="body2" component="ul" sx={{ color: colors.textSecondary, pl: 3, mb: 2 }}>
            <li>Access your personal information</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Opt-out of marketing communications</li>
          </Typography>
        </Box>

        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ color: colors.textPrimary, fontWeight: 600, mb: 2 }}>
            6. Contact Us
          </Typography>
          <Typography variant="body1" sx={{ color: colors.textPrimary, mb: 2, lineHeight: 1.8 }}>
            If you have questions about this Privacy Policy, please contact us through our customer support channels.
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
};

export default PrivacyPolicy;


