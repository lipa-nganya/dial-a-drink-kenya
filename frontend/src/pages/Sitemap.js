import React from 'react';
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Link as MuiLink,
  List,
  ListItem,
  ListItemText
} from '@mui/material';
import { Map, Home, LocalBar, ShoppingCart, Person, Description } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';

const Sitemap = () => {
  const navigate = useNavigate();
  const { colors } = useTheme();

  const handleLinkClick = (path) => {
    navigate(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const sitemapSections = [
    {
      title: 'Main Pages',
      icon: <Home />,
      links: [
        { name: 'Home', path: '/' },
        { name: 'Menu', path: '/menu' },
        { name: 'Offers', path: '/offers' },
        { name: 'Cart', path: '/cart' }
      ]
    },
    {
      title: 'Products & Brands',
      icon: <LocalBar />,
      links: [
        { name: 'All Brands', path: '/brands' },
        { name: 'Pricelist', path: '/pricelist' }
      ]
    },
    {
      title: 'Services',
      icon: <ShoppingCart />,
      links: [
        { name: 'Delivery Locations', path: '/delivery-locations' },
        { name: 'Order Tracking', path: '/order-tracking' },
        { name: 'My Orders', path: '/orders' }
      ]
    },
    {
      title: 'Account',
      icon: <Person />,
      links: [
        { name: 'Login', path: '/login' },
        { name: 'Profile', path: '/profile' }
      ]
    },
    {
      title: 'Information',
      icon: <Description />,
      links: [
        { name: 'Terms and Conditions', path: '/terms-of-service' },
        { name: 'Privacy Policy', path: '/privacy-policy' },
        { name: 'Sitemap', path: '/sitemap' }
      ]
    }
  ];

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Map sx={{ fontSize: 40, color: colors.accentText }} />
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700, color: colors.textPrimary }}>
            Sitemap
          </Typography>
        </Box>
        <Typography variant="body1" sx={{ color: colors.textSecondary, mb: 3 }}>
          Navigate through all pages and sections of Dial a Drink Kenya. Find what you're looking for quickly and easily.
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {sitemapSections.map((section, index) => (
          <Grid item xs={12} sm={6} md={4} key={index}>
            <Card
              sx={{
                height: '100%',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 4
                }
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Box sx={{ color: colors.accentText }}>
                    {section.icon}
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 600, color: colors.textPrimary }}>
                    {section.title}
                  </Typography>
                </Box>
                <List dense>
                  {section.links.map((link, linkIndex) => (
                    <ListItem
                      key={linkIndex}
                      sx={{
                        px: 0,
                        cursor: 'pointer',
                        '&:hover': {
                          backgroundColor: 'rgba(0, 0, 0, 0.04)'
                        }
                      }}
                      onClick={() => handleLinkClick(link.path)}
                    >
                      <ListItemText
                        primary={
                          <MuiLink
                            component="button"
                            onClick={(e) => {
                              e.preventDefault();
                              handleLinkClick(link.path);
                            }}
                            sx={{
                              color: colors.textSecondary,
                              textDecoration: 'none',
                              cursor: 'pointer',
                              '&:hover': {
                                color: colors.accentText,
                                textDecoration: 'underline'
                              }
                            }}
                          >
                            {link.name}
                          </MuiLink>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ mt: 4, p: 3, backgroundColor: colors.paper, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, color: colors.textPrimary, mb: 2 }}>
          SEO Information
        </Typography>
        <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 1 }}>
          This sitemap helps search engines index all pages on our website, improving visibility and search rankings.
        </Typography>
        <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 1 }}>
          All pages are optimized for search engines with relevant keywords and meta descriptions.
        </Typography>
        <Typography variant="body2" sx={{ color: colors.textSecondary }}>
          For questions or feedback, please contact us at +254 723 688 108
        </Typography>
      </Box>
    </Container>
  );
};

export default Sitemap;
