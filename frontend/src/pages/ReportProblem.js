import React, { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  TextField,
  Button,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import { ReportProblem as ReportProblemIcon, ArrowBack } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';

const ReportProblem = () => {
  const navigate = useNavigate();
  const { colors } = useTheme();
  const [problemType, setProblemType] = useState('');
  const [description, setDescription] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // TODO: Create API endpoint for problem reports
      // For now, just show success message
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSubmitted(true);
      setProblemType('');
      setDescription('');
      setContactInfo('');
    } catch (err) {
      setError('Failed to submit report. Please try again.');
      console.error('Error submitting problem report:', err);
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
          Report a Problem
        </Typography>
      </Box>

      <Paper sx={{ p: 4, backgroundColor: colors.paper }}>
        {submitted ? (
          <Alert severity="success" sx={{ mb: 3 }}>
            Thank you for reporting this issue. We'll look into it and get back to you as soon as possible.
          </Alert>
        ) : (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <ReportProblemIcon sx={{ fontSize: 40, color: colors.error }} />
              <Typography variant="h6" sx={{ color: colors.textPrimary }}>
                Help us improve by reporting any issues you've encountered
              </Typography>
            </Box>

            <form onSubmit={handleSubmit}>
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>Problem Type</InputLabel>
                <Select
                  value={problemType}
                  onChange={(e) => setProblemType(e.target.value)}
                  required
                  label="Problem Type"
                >
                  <MenuItem value="order">Order Issue</MenuItem>
                  <MenuItem value="delivery">Delivery Problem</MenuItem>
                  <MenuItem value="payment">Payment Issue</MenuItem>
                  <MenuItem value="website">Website/App Bug</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </Select>
              </FormControl>

              <TextField
                fullWidth
                label="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                multiline
                rows={6}
                sx={{ mb: 3 }}
                placeholder="Please describe the problem in detail..."
              />

              <TextField
                fullWidth
                label="Contact Information (Optional)"
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                sx={{ mb: 3 }}
                placeholder="Phone or email if you'd like us to follow up"
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
                    backgroundColor: colors.error,
                    color: '#fff',
                    '&:hover': {
                      backgroundColor: colors.error,
                      opacity: 0.9
                    }
                  }}
                >
                  {loading ? 'Submitting...' : 'Submit Report'}
                </Button>
              </Box>
            </form>
          </>
        )}
      </Paper>
    </Container>
  );
};

export default ReportProblem;


