import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Paper,
  LinearProgress,
  Chip,
  Alert
} from '@mui/material';
import {
  Search,
  CheckCircle,
  TrendingUp,
  Visibility
} from '@mui/icons-material';
import { useTheme } from '../../contexts/ThemeContext';

const SEO = () => {
  const { isDarkMode, colors } = useTheme();

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600, color: colors.textPrimary, mb: 1 }}>
          SEO Analysis & Optimization
        </Typography>
        <Typography variant="body2" sx={{ color: colors.textSecondary }}>
          Improve your online visibility and search engine rankings
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card sx={{ backgroundColor: colors.paper, height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Search sx={{ color: colors.accentText, mr: 1 }} />
                <Typography variant="h6" sx={{ color: colors.textPrimary }}>
                  SEO Score
                </Typography>
              </Box>
              <Box sx={{ mt: 3, mb: 2 }}>
                <Typography variant="h3" sx={{ fontWeight: 700, color: colors.accentText, mb: 2, textAlign: 'center' }}>
                  0/100
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={0}
                  sx={{
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: colors.accentText
                    }
                  }}
                />
              </Box>
              <Typography variant="body2" sx={{ color: colors.textSecondary, textAlign: 'center', mt: 2 }}>
                SEO analysis will be calculated here
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ backgroundColor: colors.paper, height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Visibility sx={{ color: colors.accentText, mr: 1 }} />
                <Typography variant="h6" sx={{ color: colors.textPrimary }}>
                  Visibility Metrics
                </Typography>
              </Box>
              <Box sx={{ mt: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                    Organic Traffic
                  </Typography>
                  <Typography variant="body2" sx={{ color: colors.textPrimary, fontWeight: 600 }}>
                    N/A
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                    Backlinks
                  </Typography>
                  <Typography variant="body2" sx={{ color: colors.textPrimary, fontWeight: 600 }}>
                    N/A
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                    Domain Authority
                  </Typography>
                  <Typography variant="body2" sx={{ color: colors.textPrimary, fontWeight: 600 }}>
                    N/A
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ backgroundColor: colors.paper, height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <CheckCircle sx={{ color: colors.accentText, mr: 1 }} />
                <Typography variant="h6" sx={{ color: colors.textPrimary }}>
                  Recommendations
                </Typography>
              </Box>
              <Box sx={{ mt: 2 }}>
                <Alert severity="info" sx={{ mb: 2, backgroundColor: colors.paper }}>
                  SEO recommendations will be displayed here
                </Alert>
                <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                  • Optimize page titles and meta descriptions
                  <br />
                  • Improve site speed and mobile responsiveness
                  <br />
                  • Create quality content regularly
                  <br />
                  • Build quality backlinks
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ backgroundColor: colors.paper, height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <TrendingUp sx={{ color: colors.accentText, mr: 1 }} />
                <Typography variant="h6" sx={{ color: colors.textPrimary }}>
                  Keyword Performance
                </Typography>
              </Box>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 2 }}>
                  Top performing keywords will be displayed here
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  <Chip label="Keyword 1" size="small" />
                  <Chip label="Keyword 2" size="small" />
                  <Chip label="Keyword 3" size="small" />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ backgroundColor: colors.paper, p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2, color: colors.textPrimary }}>
              SEO Audit Report
            </Typography>
            <Typography variant="body2" sx={{ color: colors.textSecondary }}>
              Comprehensive SEO audit and optimization suggestions will be generated here.
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SEO;



