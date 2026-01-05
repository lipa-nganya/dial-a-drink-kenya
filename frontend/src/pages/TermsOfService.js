import React from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Button
} from '@mui/material';
import { Description, ArrowBack } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';

const TermsOfService = () => {
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
          Terms of Service
        </Typography>
      </Box>

      <Paper sx={{ p: 4, backgroundColor: colors.paper }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
          <Description sx={{ fontSize: 40, color: colors.accent }} />
          <Typography variant="h5" sx={{ color: colors.textPrimary, fontWeight: 600 }}>
            Terms and Conditions
          </Typography>
        </Box>

        <Typography variant="body1" sx={{ color: colors.textPrimary, mb: 3, lineHeight: 1.8 }}>
          <strong>Last Updated:</strong> {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </Typography>

        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ color: colors.textPrimary, fontWeight: 600, mb: 2 }}>
            1. Acceptance of Terms
          </Typography>
          <Typography variant="body1" sx={{ color: colors.textPrimary, mb: 2, lineHeight: 1.8 }}>
            By accessing and using Dial a Drink Kenya's services, you agree to be bound by these Terms of Service. If you do not agree, please do not use our services.
          </Typography>
        </Box>

        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ color: colors.textPrimary, fontWeight: 600, mb: 2 }}>
            2. Service Description
          </Typography>
          <Typography variant="body1" sx={{ color: colors.textPrimary, mb: 2, lineHeight: 1.8 }}>
            Dial a Drink Kenya provides an online platform for ordering beverages and having them delivered to your location. We reserve the right to modify or discontinue services at any time.
          </Typography>
        </Box>

        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ color: colors.textPrimary, fontWeight: 600, mb: 2 }}>
            3. Age Restrictions
          </Typography>
          <Typography variant="body1" sx={{ color: colors.textPrimary, mb: 2, lineHeight: 1.8 }}>
            You must be at least 18 years old to use our services. By placing an order, you confirm that you meet the legal age requirement for purchasing alcoholic beverages in your jurisdiction.
          </Typography>
        </Box>

        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ color: colors.textPrimary, fontWeight: 600, mb: 2 }}>
            4. Orders and Payment
          </Typography>
          <Typography variant="body2" component="ul" sx={{ color: colors.textSecondary, pl: 3, mb: 2 }}>
            <li>All orders are subject to availability</li>
            <li>Prices are subject to change without notice</li>
            <li>Payment must be completed before or upon delivery</li>
            <li>We accept various payment methods as displayed on our platform</li>
            <li>Refunds are processed according to our refund policy</li>
          </Typography>
        </Box>

        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ color: colors.textPrimary, fontWeight: 600, mb: 2 }}>
            5. Delivery
          </Typography>
          <Typography variant="body2" component="ul" sx={{ color: colors.textSecondary, pl: 3, mb: 2 }}>
            <li>Delivery times are estimates and not guaranteed</li>
            <li>You must provide accurate delivery address</li>
            <li>Someone must be available to receive the order</li>
            <li>Delivery fees may apply and will be displayed at checkout</li>
            <li>We are not responsible for delays due to circumstances beyond our control</li>
          </Typography>
        </Box>

        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ color: colors.textPrimary, fontWeight: 600, mb: 2 }}>
            6. User Responsibilities
          </Typography>
          <Typography variant="body2" component="ul" sx={{ color: colors.textSecondary, pl: 3, mb: 2 }}>
            <li>Provide accurate and complete information</li>
            <li>Maintain the security of your account</li>
            <li>Use our services legally and responsibly</li>
            <li>Not use our services for any unlawful purpose</li>
          </Typography>
        </Box>

        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ color: colors.textPrimary, fontWeight: 600, mb: 2 }}>
            7. Limitation of Liability
          </Typography>
          <Typography variant="body1" sx={{ color: colors.textPrimary, mb: 2, lineHeight: 1.8 }}>
            Dial a Drink Kenya shall not be liable for any indirect, incidental, special, or consequential damages arising from the use of our services.
          </Typography>
        </Box>

        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ color: colors.textPrimary, fontWeight: 600, mb: 2 }}>
            8. Changes to Terms
          </Typography>
          <Typography variant="body1" sx={{ color: colors.textPrimary, mb: 2, lineHeight: 1.8 }}>
            We reserve the right to modify these terms at any time. Continued use of our services after changes constitutes acceptance of the new terms.
          </Typography>
        </Box>

        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ color: colors.textPrimary, fontWeight: 600, mb: 2 }}>
            9. Contact Information
          </Typography>
          <Typography variant="body1" sx={{ color: colors.textPrimary, mb: 2, lineHeight: 1.8 }}>
            For questions about these Terms of Service, please contact us through our customer support channels.
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
};

export default TermsOfService;


