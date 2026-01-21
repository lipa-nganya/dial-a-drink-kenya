import React, { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  TextField,
  Button,
  Alert
} from '@mui/material';
import { Lightbulb, ArrowBack } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';

const SuggestDrink = () => {
  const navigate = useNavigate();
  const { colors } = useTheme();
  const [drinkName, setDrinkName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // TODO: Create API endpoint for drink suggestions
      // For now, just show success message
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSubmitted(true);
      setDrinkName('');
    } catch (err) {
      setError('Failed to submit suggestion. Please try again.');
      console.error('Error submitting drink suggestion:', err);
    } finally {
      setLoading(false);
    }
  };

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
          Suggest a Drink
        </Typography>
      </Box>

      <Paper sx={{ p: 4, backgroundColor: colors.paper }}>
        {submitted ? (
          <Alert severity="success" sx={{ mb: 3 }}>
            Thank you for your suggestion! We'll review it and consider adding it to our menu.
          </Alert>
        ) : (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <Lightbulb sx={{ fontSize: 40, color: colors.accent }} />
              <Typography variant="h6" sx={{ color: colors.textPrimary }}>
                Found everything you need? Tell us what's missing!
              </Typography>
            </Box>

            <form onSubmit={handleSubmit}>
              <TextField
                fullWidth
                label="Drink Name"
                value={drinkName}
                onChange={(e) => setDrinkName(e.target.value)}
                required
                sx={{ mb: 3 }}
                placeholder="e.g., Mango Mojito"
              />

              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  onClick={() => navigate(-1)}
                  sx={{ color: colors.textPrimary, borderColor: colors.textSecondary }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading}
                  sx={{
                    backgroundColor: colors.accent,
                    color: colors.accentText,
                    '&:hover': {
                      backgroundColor: colors.accent,
                      opacity: 0.9
                    }
                  }}
                >
                  {loading ? 'Submitting...' : 'Submit Suggestion'}
                </Button>
              </Box>
            </form>
          </>
        )}
      </Paper>
    </Container>
  );
};

export default SuggestDrink;


