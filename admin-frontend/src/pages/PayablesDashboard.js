import React from 'react';
import {
  Box,
  Typography,
  Paper
} from '@mui/material';
import PersonAdd from '@mui/icons-material/PersonAdd';
import ListAlt from '@mui/icons-material/ListAlt';
import ReceiptLong from '@mui/icons-material/ReceiptLong';
import ChevronRight from '@mui/icons-material/ChevronRight';
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

const PayablesDashboard = () => {
  const navigate = useNavigate();
  const { colors, isDarkMode } = useTheme();

  const cards = [
    {
      id: 'add-supplier',
      label: 'Add Supplier',
      icon: <PersonAdd sx={{ fontSize: 40 }} />,
      description: 'Create a new supplier',
      onClick: () => navigate('/payables/purchases', { state: { action: 'add-supplier' } }),
      bg: isDarkMode ? 'rgba(76, 175, 80, 0.25)' : 'rgba(76, 175, 80, 0.12)',
      borderColor: '#4CAF50',
      iconColor: '#4CAF50'
    },
    {
      id: 'list-suppliers',
      label: 'List Suppliers',
      icon: <ListAlt sx={{ fontSize: 40 }} />,
      description: 'View and manage suppliers',
      onClick: () => navigate('/payables/purchases', { state: { tab: 1 } }),
      bg: isDarkMode ? 'rgba(0, 224, 184, 0.2)' : 'rgba(0, 224, 184, 0.12)',
      borderColor: colors.accent,
      iconColor: colors.accent
    },
    {
      id: 'payables-list',
      label: 'Payables List',
      icon: <ReceiptLong sx={{ fontSize: 40 }} />,
      description: 'See outstanding payables',
      onClick: () => navigate('/payables/manage', { state: { tab: 0 } }),
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
          PAYABLES
        </Typography>
        <Typography variant="body2" sx={{ color: colors.textSecondary, mt: 0.5 }}>
          {formatDashboardDate()}
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          gap: 2
        }}
      >
        {cards.map((card) => (
          <Paper
            key={card.id}
            component="button"
            type="button"
            onClick={card.onClick}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 160,
              p: 3,
              textAlign: 'center',
              cursor: 'pointer',
              backgroundColor: card.bg,
              border: `2px solid transparent`,
              borderRadius: 3,
              boxShadow: isDarkMode ? '0 4px 14px rgba(0,0,0,0.25)' : '0 2px 12px rgba(0,0,0,0.08)',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: isDarkMode ? '0 8px 24px rgba(0,0,0,0.35)' : '0 6px 20px rgba(0,0,0,0.12)',
                borderColor: card.borderColor,
                backgroundColor: card.id === 'add-supplier'
                  ? (isDarkMode ? 'rgba(76, 175, 80, 0.35)' : 'rgba(76, 175, 80, 0.22)')
                  : (isDarkMode ? 'rgba(0, 224, 184, 0.28)' : 'rgba(0, 224, 184, 0.18)')
              }
              ,
              '&:focus-visible': {
                outline: `2px solid ${card.borderColor}`,
                outlineOffset: 2
              }
            }}
          >
            <Box sx={{ color: card.iconColor, mb: 1.5 }}>{card.icon}</Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: colors.textPrimary }}>
              {card.label}
            </Typography>
            <Typography variant="body2" sx={{ color: colors.textSecondary, mt: 0.5 }}>
              {card.description}
            </Typography>
            <ChevronRight sx={{ mt: 1.5, color: colors.textSecondary, fontSize: 28 }} />
          </Paper>
        ))}
      </Box>
    </Box>
  );
};

export default PayablesDashboard;

