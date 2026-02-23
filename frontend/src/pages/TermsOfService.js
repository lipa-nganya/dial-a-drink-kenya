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

        <Typography variant="body1" sx={{ color: colors.textPrimary, mb: 3, lineHeight: 1.8, textAlign: 'left' }}>
          <strong>Last Updated:</strong> {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </Typography>

        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ color: colors.textPrimary, fontWeight: 600, mb: 2, textAlign: 'left' }}>
            1. Acceptance of Terms
          </Typography>
          <Typography variant="body1" sx={{ color: colors.textPrimary, mb: 2, lineHeight: 1.8, textAlign: 'left' }}>
            By accessing and using Dial a Drink Kenya's services, you agree to be bound by these Terms of Service. If you do not agree, please do not use our services.
          </Typography>
        </Box>

        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ color: colors.textPrimary, fontWeight: 600, mb: 2, textAlign: 'left' }}>
            2. Service Description
          </Typography>
          <Typography variant="body1" sx={{ color: colors.textPrimary, mb: 2, lineHeight: 1.8, textAlign: 'left' }}>
            Dial a Drink Kenya provides an online platform for ordering beverages and having them delivered to your location. We reserve the right to modify or discontinue services at any time.
          </Typography>
        </Box>

        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ color: colors.textPrimary, fontWeight: 600, mb: 2, textAlign: 'left' }}>
            3. Age Restrictions and Alcohol Sales
          </Typography>
          <Typography variant="body1" sx={{ color: colors.textPrimary, mb: 2, lineHeight: 1.8, textAlign: 'left' }}>
            You must be at least 18 years old to use our services and purchase alcoholic beverages. By placing an order, you confirm that you meet the legal age requirement for purchasing alcoholic beverages in Kenya. We reserve the right to request proof of age at the time of delivery.
          </Typography>
          <Typography variant="body2" component="ul" sx={{ color: colors.textSecondary, pl: 3, mb: 2, textAlign: 'left' }}>
            <li>Valid government-issued ID may be required upon delivery</li>
            <li>We will not deliver alcohol to individuals under the age of 18</li>
            <li>If the recipient appears intoxicated, we reserve the right to refuse delivery</li>
            <li>Alcohol must be consumed responsibly and in accordance with local laws</li>
            <li>We do not condone excessive consumption or underage drinking</li>
          </Typography>
        </Box>

        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ color: colors.textPrimary, fontWeight: 600, mb: 2, textAlign: 'left' }}>
            4. Orders and Payment
          </Typography>
          <Typography variant="body2" component="ul" sx={{ color: colors.textSecondary, pl: 3, mb: 2, textAlign: 'left' }}>
            <li>All orders are subject to availability of alcoholic beverages</li>
            <li>Prices are subject to change without notice</li>
            <li>Payment must be completed before or upon delivery</li>
            <li>We accept cash on delivery, M-Pesa, Visa, and MasterCard</li>
            <li>Refunds are processed according to our refund policy (unopened items only)</li>
            <li>All sales of alcoholic beverages are final once delivered and opened</li>
            <li>We reserve the right to limit quantities purchased per customer</li>
          </Typography>
        </Box>

        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ color: colors.textPrimary, fontWeight: 600, mb: 2, textAlign: 'left' }}>
            5. Delivery and Receipt of Alcohol
          </Typography>
          <Typography variant="body2" component="ul" sx={{ color: colors.textSecondary, pl: 3, mb: 2, textAlign: 'left' }}>
            <li>Delivery times are estimates and not guaranteed</li>
            <li>You must provide accurate delivery address</li>
            <li>Someone 18 years or older must be available to receive the order and provide valid ID</li>
            <li>Delivery fees may apply and will be displayed at checkout</li>
            <li>We are not responsible for delays due to circumstances beyond our control</li>
            <li>We reserve the right to refuse delivery if the recipient cannot provide valid age verification</li>
            <li>Alcohol will not be left unattended or delivered to visibly intoxicated individuals</li>
            <li>We comply with all local regulations regarding alcohol delivery hours</li>
          </Typography>
        </Box>

        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ color: colors.textPrimary, fontWeight: 600, mb: 2, textAlign: 'left' }}>
            6. User Responsibilities and Responsible Consumption
          </Typography>
          <Typography variant="body2" component="ul" sx={{ color: colors.textSecondary, pl: 3, mb: 2, textAlign: 'left' }}>
            <li>Provide accurate and complete information</li>
            <li>Maintain the security of your account</li>
            <li>Use our services legally and responsibly</li>
            <li>Not use our services for any unlawful purpose</li>
            <li>Consume alcohol responsibly and in moderation</li>
            <li>Do not drive under the influence of alcohol</li>
            <li>Do not provide alcohol to minors</li>
            <li>Comply with all local laws and regulations regarding alcohol consumption</li>
          </Typography>
        </Box>

        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ color: colors.textPrimary, fontWeight: 600, mb: 2, textAlign: 'left' }}>
            7. Limitation of Liability
          </Typography>
          <Typography variant="body1" sx={{ color: colors.textPrimary, mb: 2, lineHeight: 1.8, textAlign: 'left' }}>
            Dial a Drink Kenya shall not be liable for any indirect, incidental, special, or consequential damages arising from the use of our services.
          </Typography>
        </Box>

        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ color: colors.textPrimary, fontWeight: 600, mb: 2, textAlign: 'left' }}>
            8. Changes to Terms
          </Typography>
          <Typography variant="body1" sx={{ color: colors.textPrimary, mb: 2, lineHeight: 1.8, textAlign: 'left' }}>
            We reserve the right to modify these terms at any time. Continued use of our services after changes constitutes acceptance of the new terms.
          </Typography>
        </Box>

        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ color: colors.textPrimary, fontWeight: 600, mb: 2, textAlign: 'left' }}>
            9. Contact Information
          </Typography>
          <Typography variant="body1" sx={{ color: colors.textPrimary, mb: 2, lineHeight: 1.8, textAlign: 'left' }}>
            For questions about these Terms of Service, please contact us through our customer support channels.
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
};

export default TermsOfService;


