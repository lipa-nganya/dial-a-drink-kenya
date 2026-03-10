import React from 'react';
import {
  Box,
  Typography,
  Paper
} from '@mui/material';
import TwoWheeler from '@mui/icons-material/TwoWheeler';
import TrendingUp from '@mui/icons-material/TrendingUp';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';

const formatDashboardDate = () => {
  const d = new Date();
  const day = d.getDate();
  const suffix =
    day === 1 || day === 21 || day === 31
      ? 'st'
      : day === 2 || day === 22
      ? 'nd'
      : day === 3 || day === 23
      ? 'rd'
      : 'th';
  return d
    .toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
    .replace(/(\d+)/, (_, num) => num + suffix)
    .replace(', ', ' ');
};

const Sales = () => {
  const navigate = useNavigate();
  const { colors, isDarkMode } = useTheme();

  const cards = [
    {
      id: 'rider-profits',
      label: 'Rider Profits',
      icon: <TwoWheeler sx={{ fontSize: 40 }} />,
      description: 'View profits by rider',
      onClick: () => navigate('/sales/rider-profits'),
      bg: isDarkMode ? 'rgba(0, 224, 184, 0.2)' : 'rgba(0, 224, 184, 0.12)',
      borderColor: colors.accent,
      iconColor: colors.accent
    },
    {
      id: 'sales-summary',
      label: 'Sales Summary',
      icon: <TrendingUp sx={{ fontSize: 40 }} />,
      description: 'Overview of sales performance',
      onClick: () => navigate('/sales/summary'),
      bg: isDarkMode ? 'rgba(33, 150, 243, 0.2)' : 'rgba(33, 150, 243, 0.1)',
      borderColor: '#2196F3',
      iconColor: '#2196F3'
    }
  ];

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ mb: 3, textAlign: 'center' }}>
        <Typography
          variant="h4"
          sx={{
            color: colors.textPrimary,
            fontWeight: 700,
            letterSpacing: '-0.02em'
          }}
        >
          SALES
        </Typography>
        <Typography variant="body2" sx={{ color: colors.textSecondary, mt: 0.5 }}>
          {formatDashboardDate()}
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(2, 1fr)' },
          gap: 2
        }}
      >
        {cards.map((card) => (
          <Paper
            key={card.id}
            onClick={card.onClick}
            sx={{
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: 120,
              cursor: 'pointer',
              backgroundColor: card.bg,
              borderRadius: 2,
              border: `1px solid ${card.borderColor}`,
              boxShadow: 'none',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 4px 10px rgba(0,0,0,0.15)'
              }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Box
                sx={{
                  mr: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 56,
                  height: 56,
                  borderRadius: 2,
                  backgroundColor: '#ffffff20',
                  color: card.iconColor
                }}
              >
                {card.icon}
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: colors.textPrimary }}>
                {card.label}
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: colors.textSecondary }}>
              {card.description}
            </Typography>
          </Paper>
        ))}
      </Box>
    </Box>
  );
};

export default Sales;
