import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Paper,
  Chip,
  Alert
} from '@mui/material';
import {
  TrendingUp,
  Warning,
  CheckCircle,
  Info
} from '@mui/icons-material';
import { useTheme } from '../../contexts/ThemeContext';

const Predictions = () => {
  const { isDarkMode, colors } = useTheme();

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600, color: colors.textPrimary, mb: 1 }}>
          Predictions & Forecasting
        </Typography>
        <Typography variant="body2" sx={{ color: colors.textSecondary }}>
          AI-powered predictions for sales, inventory, and business trends
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Alert
            severity="info"
            icon={<Info />}
            sx={{
              backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.1)' : 'rgba(0, 224, 184, 0.1)',
              color: colors.textPrimary,
              border: `1px solid ${colors.accentText}`
            }}
          >
            Predictions are based on historical data and machine learning models. Results will be displayed here.
          </Alert>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ backgroundColor: colors.paper, height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <TrendingUp sx={{ color: colors.accentText, mr: 1 }} />
                <Typography variant="h6" sx={{ color: colors.textPrimary }}>
                  Sales Forecast
                </Typography>
              </Box>
              <Box sx={{ mt: 2 }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: colors.accentText, mb: 1 }}>
                  Next 30 Days
                </Typography>
                <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 2 }}>
                  Predicted sales volume
                </Typography>
                <Chip
                  label="Coming Soon"
                  size="small"
                  sx={{
                    backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.2)' : 'rgba(0, 224, 184, 0.1)',
                    color: colors.accentText
                  }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ backgroundColor: colors.paper, height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Warning sx={{ color: colors.error, mr: 1 }} />
                <Typography variant="h6" sx={{ color: colors.textPrimary }}>
                  Inventory Predictions
                </Typography>
              </Box>
              <Box sx={{ mt: 2 }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: colors.error, mb: 1 }}>
                  Stock Levels
                </Typography>
                <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 2 }}>
                  Predicted inventory needs
                </Typography>
                <Chip
                  label="Coming Soon"
                  size="small"
                  sx={{
                    backgroundColor: isDarkMode ? 'rgba(255, 51, 102, 0.2)' : 'rgba(255, 51, 102, 0.1)',
                    color: colors.error
                  }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ backgroundColor: colors.paper, height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <CheckCircle sx={{ color: colors.accentText, mr: 1 }} />
                <Typography variant="h6" sx={{ color: colors.textPrimary }}>
                  Demand Forecast
                </Typography>
              </Box>
              <Box sx={{ mt: 2 }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: colors.accentText, mb: 1 }}>
                  Product Demand
                </Typography>
                <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 2 }}>
                  Predicted customer demand
                </Typography>
                <Chip
                  label="Coming Soon"
                  size="small"
                  sx={{
                    backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.2)' : 'rgba(0, 224, 184, 0.1)',
                    color: colors.accentText
                  }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ backgroundColor: colors.paper, p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2, color: colors.textPrimary }}>
              Prediction Models
            </Typography>
            <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 2 }}>
              Advanced machine learning models will analyze your data and provide accurate predictions for:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Chip label="Sales Forecasting" size="small" />
              <Chip label="Inventory Optimization" size="small" />
              <Chip label="Demand Planning" size="small" />
              <Chip label="Revenue Projections" size="small" />
              <Chip label="Seasonal Trends" size="small" />
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Predictions;



