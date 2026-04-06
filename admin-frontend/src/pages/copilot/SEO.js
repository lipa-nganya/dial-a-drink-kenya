import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Save,
  Cancel
} from '@mui/icons-material';
import { useTheme } from '../../contexts/ThemeContext';
import { api } from '../../services/api';
import { useAdmin } from '../../contexts/AdminContext';

const SEO = () => {
  const { colors } = useTheme();
  const { user: admin } = useAdmin();
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [originalMetaTitle, setOriginalMetaTitle] = useState('');
  const [originalMetaDescription, setOriginalMetaDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const canEdit = admin?.role === 'super_admin' || admin?.role === 'super_super_admin';
  
  // Check if there are unsaved changes
  const hasChanges = metaTitle !== originalMetaTitle || metaDescription !== originalMetaDescription;

  useEffect(() => {
    fetchSeoSettings();
  }, []);

  const fetchSeoSettings = async () => {
    try {
      setLoading(true);
      setError('');

      const [titleRes, descRes] = await Promise.all([
        api.get('/settings/seoMetaTitle'),
        api.get('/settings/seoMetaDescription')
      ]);

      const title = titleRes.data?.value || 'Alcohol Delivery Nairobi - Dial A Drink Kenya - 24 hours Fast Delivery';
      const description = descRes.data?.value || 'Alcohol delivery in Nairobi and its environs in under 30 minutes! Wide variety of whisky, wine, cognacs, gin etc Call 0723688108 to order.';

      setMetaTitle(title);
      setMetaDescription(description);
      setOriginalMetaTitle(title);
      setOriginalMetaDescription(description);
    } catch (err) {
      console.error('Error fetching SEO settings:', err);
      setError('Failed to load SEO settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      await Promise.all([
        api.put('/settings/seoMetaTitle', { value: metaTitle }),
        api.put('/settings/seoMetaDescription', { value: metaDescription })
      ]);

      setOriginalMetaTitle(metaTitle);
      setOriginalMetaDescription(metaDescription);
      setSuccess('SEO settings updated successfully! Changes will be reflected after the next deployment.');
      setIsEditing(false);
    } catch (err) {
      console.error('Error saving SEO settings:', err);
      setError('Failed to save SEO settings');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setMetaTitle(originalMetaTitle);
    setMetaDescription(originalMetaDescription);
    setIsEditing(false);
    setError('');
    setSuccess('');
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress sx={{ color: colors.accentText }} />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600, color: colors.textPrimary, mb: 1 }}>
          SEO Meta Tags
        </Typography>
        <Typography variant="body2" sx={{ color: colors.textSecondary }}>
          Manage your website's meta title and description for search engines
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {!canEdit && (
        <Alert severity="info" sx={{ mb: 3 }}>
          You can view SEO settings, but only Super Admins can edit them.
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Card sx={{ backgroundColor: colors.paper, width: '100%' }}>
          <CardContent>
            <Box>
              <Typography variant="h6" sx={{ color: colors.textPrimary, mb: 3 }}>
                Meta Title
              </Typography>

              <TextField
                fullWidth
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                onClick={() => canEdit && !isEditing && setIsEditing(true)}
                disabled={!isEditing && !canEdit}
                multiline
                rows={1}
                placeholder="Enter meta title"
                sx={{
                  mb: 1,
                  cursor: canEdit && !isEditing ? 'pointer' : 'default',
                  '& .MuiInputBase-root': {
                    backgroundColor: colors.background,
                    color: colors.textPrimary,
                    cursor: canEdit && !isEditing ? 'pointer' : 'default'
                  },
                  '& .MuiInputBase-input.Mui-disabled': {
                    WebkitTextFillColor: colors.textPrimary,
                    cursor: canEdit ? 'pointer' : 'default'
                  }
                }}
              />
              <Typography variant="caption" sx={{ color: colors.textSecondary, display: 'block' }}>
                {metaTitle.length} characters (recommended: 50-60 characters)
              </Typography>
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ backgroundColor: colors.paper, width: '100%' }}>
          <CardContent>
            <Box>
              <Typography variant="h6" sx={{ color: colors.textPrimary, mb: 3 }}>
                Meta Description
              </Typography>

              <TextField
                fullWidth
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                onClick={() => canEdit && !isEditing && setIsEditing(true)}
                disabled={!isEditing && !canEdit}
                multiline
                rows={2}
                placeholder="Enter meta description"
                sx={{
                  mb: 1,
                  cursor: canEdit && !isEditing ? 'pointer' : 'default',
                  '& .MuiInputBase-root': {
                    backgroundColor: colors.background,
                    color: colors.textPrimary,
                    cursor: canEdit && !isEditing ? 'pointer' : 'default'
                  },
                  '& .MuiInputBase-input.Mui-disabled': {
                    WebkitTextFillColor: colors.textPrimary,
                    cursor: canEdit ? 'pointer' : 'default'
                  }
                }}
              />
              <Typography variant="caption" sx={{ color: colors.textSecondary, display: 'block' }}>
                {metaDescription.length} characters (recommended: 150-160 characters)
              </Typography>
            </Box>
          </CardContent>
        </Card>

        {isEditing && (
          <Card sx={{ backgroundColor: colors.paper, width: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  startIcon={<Cancel />}
                  onClick={handleCancel}
                  disabled={saving}
                  sx={{
                    borderColor: colors.textSecondary,
                    color: colors.textPrimary,
                    '&:hover': {
                      borderColor: colors.textPrimary,
                      backgroundColor: 'rgba(0, 0, 0, 0.04)'
                    }
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  startIcon={saving ? <CircularProgress size={20} sx={{ color: '#FFFFFF' }} /> : <Save />}
                  onClick={handleSave}
                  disabled={saving || !hasChanges}
                  sx={{
                    backgroundColor: colors.accent,
                    color: '#FFFFFF',
                    '&:hover': { 
                      backgroundColor: colors.accentHover || '#00c9a0'
                    },
                    '&:disabled': {
                      backgroundColor: '#cccccc',
                      color: '#666666'
                    }
                  }}
                >
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        )}

        <Alert severity="warning" sx={{ width: '100%' }}>
          Note: Changes to meta tags will be reflected after the next deployment of the customer-facing website.
        </Alert>
      </Box>
    </Box>
  );
};

export default SEO;



