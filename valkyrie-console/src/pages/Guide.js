import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Tabs,
  Tab,
  LinearProgress,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Alert,
  Button,
  Stepper,
  Step,
  StepLabel,
  StepContent
} from '@mui/material';
import {
  CheckCircle,
  RadioButtonUnchecked,
  Lock,
  Api,
  Map,
  Settings,
  VerifiedUser,
  Code,
  CloudUpload,
  Assessment
} from '@mui/icons-material';
import { api } from '../services/valkyrieApi';

const Guide = () => {
  const [tabValue, setTabValue] = useState(0);
  const [partnerInfo, setPartnerInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sandboxProgress, setSandboxProgress] = useState(0);
  const [productionProgress, setProductionProgress] = useState(0);

  useEffect(() => {
    fetchPartnerInfo();
  }, []);

  useEffect(() => {
    if (partnerInfo) {
      calculateProgress();
    }
  }, [partnerInfo, tabValue]);

  const fetchPartnerInfo = async () => {
    try {
      const response = await api.get('/partner');
      const partner = response.data.partner || {};
      
      // Also fetch geofences count
      try {
        const zonesResponse = await api.get('/zones');
        partner.geofenceCount = zonesResponse.data.zones?.length || 0;
      } catch (zonesErr) {
        console.error('Failed to fetch zones:', zonesErr);
        partner.geofenceCount = 0;
      }
      
      // Check if user has created any orders
      try {
        const ordersResponse = await api.get('/orders?limit=1');
        partner.hasOrders = (ordersResponse.data.orders?.length || 0) > 0;
      } catch (ordersErr) {
        console.error('Failed to fetch orders:', ordersErr);
        partner.hasOrders = false;
      }
      
      // Get environment and production status from localStorage or API
      const storedPartner = JSON.parse(localStorage.getItem('valkyriePartner') || '{}');
      partner.environment = storedPartner.environment || 'sandbox';
      partner.productionEnabled = storedPartner.productionEnabled || false;
      partner.billingPlan = storedPartner.billingPlan || 'sandbox';
      
      setPartnerInfo(partner);
    } catch (err) {
      console.error('Failed to fetch partner info:', err);
      // Set default values if fetch fails
      setPartnerInfo({});
    } finally {
      setLoading(false);
    }
  };

  const calculateProgress = () => {
    if (!partnerInfo) return;

    // Sandbox checklist
    const sandboxChecks = [
      { key: 'hasApiKey', label: 'API Key Generated', value: partnerInfo.hasApiKey || !!partnerInfo.apiKey },
      { key: 'hasUsers', label: 'User Account Created', value: true }, // User is logged in
      { key: 'hasGeofence', label: 'Delivery Zone Configured', value: (partnerInfo.geofenceCount || 0) > 0 },
      { key: 'testOrder', label: 'Test Order Created', value: partnerInfo.hasOrders || false }
    ];
    const sandboxCompleted = sandboxChecks.filter(check => check.value).length;
    setSandboxProgress((sandboxCompleted / sandboxChecks.length) * 100);

    // Production checklist
    const productionChecks = [
      { key: 'sandboxComplete', label: 'Sandbox Testing Complete', value: sandboxProgress >= 100 },
      { key: 'productionEnabled', label: 'Production Access Enabled', value: partnerInfo.productionEnabled || false },
      { key: 'billingSetup', label: 'Billing Information Verified', value: partnerInfo.billingPlan && partnerInfo.billingPlan !== 'sandbox' },
      { key: 'geofenceApproved', label: 'Delivery Zones Approved', value: (partnerInfo.geofenceCount || 0) > 0 },
      { key: 'apiDocumentation', label: 'API Documentation Reviewed', value: true }, // Always true if they're on this page
      { key: 'supportContact', label: 'Support Contact Established', value: true } // Would need to check
    ];
    const productionCompleted = productionChecks.filter(check => check.value).length;
    setProductionProgress((productionCompleted / productionChecks.length) * 100);
  };

  const sandboxSteps = [
    {
      title: 'Get Your API Key',
      description: 'Generate your sandbox API key to start making test requests',
      icon: <Api />,
      completed: partnerInfo?.hasApiKey || !!partnerInfo?.apiKey,
      action: (partnerInfo?.hasApiKey || partnerInfo?.apiKey) ? 'View API Key' : 'Generate API Key',
      link: '/api'
    },
    {
      title: 'Configure Delivery Zones',
      description: 'Upload or create geofences to define where you can deliver',
      icon: <Map />,
      completed: (partnerInfo?.geofenceCount || 0) > 0,
      action: 'Configure Zones',
      link: '/zones'
    },
    {
      title: 'Create Test Order',
      description: 'Make your first API call to create a test delivery order',
      icon: <Code />,
      completed: partnerInfo?.hasOrders || false,
      action: partnerInfo?.hasOrders ? 'View Orders' : 'View API Docs',
      link: partnerInfo?.hasOrders ? '/orders' : '/api'
    },
    {
      title: 'Test Driver Assignment',
      description: 'Request a driver for your test order and verify the flow',
      icon: <CloudUpload />,
      completed: false,
      action: 'View Orders',
      link: '/orders'
    },
    {
      title: 'Review Webhooks',
      description: 'Set up webhook endpoints to receive real-time order updates',
      icon: <Settings />,
      completed: false,
      action: 'Configure Webhooks',
      link: '/api'
    }
  ];

  const productionSteps = [
    {
      title: 'Complete Sandbox Testing',
      description: 'Ensure all sandbox features are tested and working correctly',
      icon: <VerifiedUser />,
      completed: sandboxProgress >= 100,
      action: 'Review Sandbox',
      link: '#sandbox'
    },
    {
      title: 'Request Production Access',
      description: 'Contact support to enable production API access',
      icon: <Lock />,
      completed: partnerInfo?.productionEnabled || false,
      action: partnerInfo?.productionEnabled ? 'Production Active' : 'Contact Support',
      link: null
    },
    {
      title: 'Verify Billing Information',
      description: 'Ensure your billing plan and payment method are set up',
      icon: <Assessment />,
      completed: partnerInfo?.billingPlan && partnerInfo.billingPlan !== 'sandbox',
      action: 'View Billing',
      link: '/billing'
    },
    {
      title: 'Finalize Delivery Zones',
      description: 'Ensure all production delivery zones are approved and active',
      icon: <Map />,
      completed: (partnerInfo?.geofenceCount || 0) > 0,
      action: 'Manage Zones',
      link: '/zones'
    },
    {
      title: 'Review Production API',
      description: 'Review production API endpoints and rate limits',
      icon: <Api />,
      completed: true,
      action: 'View API Docs',
      link: '/api'
    }
  ];

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleStepAction = (step) => {
    if (step.link && step.link.startsWith('/')) {
      window.location.href = step.link;
    } else if (step.link === '#sandbox') {
      setTabValue(0);
    }
  };

  if (loading) {
    return (
      <Container>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <Typography>Loading guide...</Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
        Getting Started Guide
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph sx={{ mb: 4 }}>
        Follow these steps to set up and launch your integration with DeliveryOS Valkyrie API
      </Typography>

      <Paper sx={{ mb: 4 }}>
        <Tabs value={tabValue} onChange={handleTabChange} variant="fullWidth">
          <Tab label="Sandbox Setup" />
          <Tab label="Production Ready" />
        </Tabs>

        {/* Sandbox Tab */}
        {tabValue === 0 && (
          <Box sx={{ p: 4 }}>
            <Box sx={{ mb: 4 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Sandbox Progress
                </Typography>
                <Chip 
                  label={`${Math.round(sandboxProgress)}% Complete`} 
                  color={sandboxProgress === 100 ? 'success' : 'primary'}
                />
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={sandboxProgress} 
                sx={{ height: 10, borderRadius: 5 }}
                color={sandboxProgress === 100 ? 'success' : 'primary'}
              />
            </Box>

            <Alert severity="info" sx={{ mb: 4 }}>
              <Typography variant="body2">
                <strong>Sandbox Environment:</strong> Use the sandbox to test your integration without affecting real orders. 
                All sandbox orders are for testing purposes only.
              </Typography>
            </Alert>

            <Stepper orientation="vertical">
              {sandboxSteps.map((step, index) => (
                <Step key={index} active={!step.completed} completed={step.completed}>
                  <StepLabel
                    StepIconComponent={() => (
                      <Box sx={{ color: step.completed ? 'success.main' : 'action.disabled' }}>
                        {step.completed ? <CheckCircle /> : <RadioButtonUnchecked />}
                      </Box>
                    )}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      {step.icon}
                      <Typography variant="h6">{step.title}</Typography>
                    </Box>
                  </StepLabel>
                  <StepContent>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      {step.description}
                    </Typography>
                    <Button
                      variant={step.completed ? "outlined" : "contained"}
                      size="small"
                      onClick={() => handleStepAction(step)}
                      sx={{ mt: 1 }}
                    >
                      {step.action}
                    </Button>
                  </StepContent>
                </Step>
              ))}
            </Stepper>

            {sandboxProgress === 100 && (
              <Alert severity="success" sx={{ mt: 4 }}>
                <Typography variant="body2">
                  <strong>Congratulations!</strong> You've completed all sandbox setup steps. 
                  You're now ready to request production access.
                </Typography>
              </Alert>
            )}
          </Box>
        )}

        {/* Production Tab */}
        {tabValue === 1 && (
          <Box sx={{ p: 4 }}>
            <Box sx={{ mb: 4 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Production Readiness
                </Typography>
                <Chip 
                  label={`${Math.round(productionProgress)}% Ready`} 
                  color={productionProgress === 100 ? 'success' : productionProgress >= 80 ? 'warning' : 'default'}
                />
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={productionProgress} 
                sx={{ height: 10, borderRadius: 5 }}
                color={productionProgress === 100 ? 'success' : productionProgress >= 80 ? 'warning' : 'primary'}
              />
            </Box>

            <Alert severity="warning" sx={{ mb: 4 }}>
              <Typography variant="body2">
                <strong>Production Environment:</strong> Production access allows you to process real orders and deliveries. 
                Ensure all testing is complete before requesting production access.
              </Typography>
            </Alert>

            <Stepper orientation="vertical">
              {productionSteps.map((step, index) => (
                <Step key={index} active={!step.completed} completed={step.completed}>
                  <StepLabel
                    StepIconComponent={() => (
                      <Box sx={{ color: step.completed ? 'success.main' : 'action.disabled' }}>
                        {step.completed ? <CheckCircle /> : <RadioButtonUnchecked />}
                      </Box>
                    )}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      {step.icon}
                      <Typography variant="h6">{step.title}</Typography>
                    </Box>
                  </StepLabel>
                  <StepContent>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      {step.description}
                    </Typography>
                    {step.link && (
                      <Button
                        variant={step.completed ? "outlined" : "contained"}
                        size="small"
                        onClick={() => handleStepAction(step)}
                        sx={{ mt: 1 }}
                      >
                        {step.action}
                      </Button>
                    )}
                    {!step.link && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: 'italic' }}>
                        Contact support at valkyrie-support@deliveryos.com
                      </Typography>
                    )}
                  </StepContent>
                </Step>
              ))}
            </Stepper>

            {productionProgress === 100 && (
              <Alert severity="success" sx={{ mt: 4 }}>
                <Typography variant="body2">
                  <strong>You're Production Ready!</strong> All requirements have been met. 
                  Contact support to activate your production API access.
                </Typography>
              </Alert>
            )}

            {productionProgress < 100 && productionProgress >= 80 && (
              <Alert severity="info" sx={{ mt: 4 }}>
                <Typography variant="body2">
                  <strong>Almost There!</strong> Complete the remaining steps to be production ready.
                </Typography>
              </Alert>
            )}
          </Box>
        )}
      </Paper>

      {/* Quick Links */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" gutterBottom>
          Quick Links
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Button variant="outlined" href="/api" startIcon={<Api />}>
            API Documentation
          </Button>
          <Button variant="outlined" href="/zones" startIcon={<Map />}>
            Delivery Zones
          </Button>
          <Button variant="outlined" href="/orders" startIcon={<Assessment />}>
            View Orders
          </Button>
          <Button variant="outlined" href="/billing" startIcon={<Assessment />}>
            Billing
          </Button>
        </Box>
      </Box>
    </Container>
  );
};

export default Guide;

