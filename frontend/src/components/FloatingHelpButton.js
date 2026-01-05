import React, { useState } from 'react';
import {
  Fab,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  useMediaQuery,
  useTheme as useMUITheme
} from '@mui/material';
import {
  HelpOutline,
  Lightbulb,
  ReportProblem,
  PrivacyTip,
  Description
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';

const FloatingHelpButton = () => {
  const navigate = useNavigate();
  const { colors } = useTheme();
  const [helpMenuAnchor, setHelpMenuAnchor] = useState(null);
  const muiTheme = useMUITheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));

  const handleHelpMenuOpen = (event) => {
    setHelpMenuAnchor(event.currentTarget);
  };

  const handleHelpMenuClose = () => {
    setHelpMenuAnchor(null);
  };

  const handleNavigation = (path) => {
    navigate(path);
    handleHelpMenuClose();
  };

  return (
    <>
      <Tooltip title="Help & Support" placement="left">
        <Fab
          color="primary"
          aria-label="help"
          onClick={handleHelpMenuOpen}
          onMouseEnter={!isMobile ? handleHelpMenuOpen : undefined}
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            backgroundColor: colors.accent,
            color: colors.accentText,
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            '&:hover': {
              backgroundColor: colors.accent,
              opacity: 0.9,
              boxShadow: '0 6px 16px rgba(0, 0, 0, 0.2)',
            },
          }}
        >
          <HelpOutline />
        </Fab>
      </Tooltip>
      <Menu
        anchorEl={helpMenuAnchor}
        open={Boolean(helpMenuAnchor)}
        onClose={handleHelpMenuClose}
        MenuListProps={{
          onMouseLeave: !isMobile ? handleHelpMenuClose : undefined,
        }}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        sx={{
          '& .MuiPaper-root': {
            backgroundColor: colors.paper,
            color: colors.textPrimary,
            minWidth: 200,
            mt: -1,
            mr: 1,
          },
        }}
      >
        <MenuItem onClick={() => handleNavigation('/suggest-drink')} sx={{ color: colors.textPrimary }}>
          <ListItemIcon>
            <Lightbulb fontSize="small" sx={{ color: colors.textPrimary }} />
          </ListItemIcon>
          <ListItemText>Suggest a Drink</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleNavigation('/report-problem')} sx={{ color: colors.textPrimary }}>
          <ListItemIcon>
            <ReportProblem fontSize="small" sx={{ color: colors.textPrimary }} />
          </ListItemIcon>
          <ListItemText>Report a Problem</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleNavigation('/privacy-policy')} sx={{ color: colors.textPrimary }}>
          <ListItemIcon>
            <PrivacyTip fontSize="small" sx={{ color: colors.textPrimary }} />
          </ListItemIcon>
          <ListItemText>Privacy Policy</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleNavigation('/terms-of-service')} sx={{ color: colors.textPrimary }}>
          <ListItemIcon>
            <Description fontSize="small" sx={{ color: colors.textPrimary }} />
          </ListItemIcon>
          <ListItemText>Terms of Service</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
};

export default FloatingHelpButton;


