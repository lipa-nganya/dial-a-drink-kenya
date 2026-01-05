import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Alert,
  TextField,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper
} from '@mui/material';
import {
  ShoppingCart,
  Api,
  DirectionsCar,
  People
} from '@mui/icons-material';
import { api } from '../services/zeusApi';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const Usage = () => {
  const [partners, setPartners] = useState([]);
  const [selectedPartner, setSelectedPartner] = useState('');
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPartners();
  }, []);

  useEffect(() => {
    if (selectedPartner) {
      fetchUsage();
    }
  }, [selectedPartner]);

  const fetchPartners = async () => {
    try {
      const response = await api.get('/partners');
      setPartners(response.data.partners || []);
      if (response.data.partners.length > 0) {
        setSelectedPartner(response.data.partners[0].id.toString());
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load partners');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsage = async () => {
    try {
      const response = await api.get(`/usage/${selectedPartner}?period=monthly`);
      setUsage(response.data.stats);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load usage data');
    }
  };

  if (loading) {
    return (
      <Container>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  const statCards = [
    {
      title: 'Total Orders',
      value: usage?.orders || 0,
      icon: <ShoppingCart />,
      color: '#1976d2'
    },
    {
      title: 'API Calls',
      value: usage?.api_calls || 0,
      icon: <Api />,
      color: '#2e7d32'
    },
    {
      title: 'Distance (km)',
      value: usage?.km || 0,
      icon: <DirectionsCar />,
      color: '#ed6c02'
    },
    {
      title: 'Drivers Used',
      value: usage?.drivers || 0,
      icon: <People />,
      color: '#9c27b0'
    }
  ];

  return (
    <Container>
      <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 3 }}>
        Usage & Monitoring
      </Typography>

      <Box sx={{ mb: 3 }}>
        <TextField
          select
          label="Select Partner"
          value={selectedPartner}
          onChange={(e) => setSelectedPartner(e.target.value)}
          sx={{ minWidth: 300 }}
        >
          {partners.map((partner) => (
            <MenuItem key={partner.id} value={partner.id.toString()}>
              {partner.name}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      {usage && (
        <>
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {statCards.map((card, index) => (
              <Grid item xs={12} sm={6} md={3} key={index}>
                <Card>
                  <CardContent>
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <Box>
                        <Typography color="textSecondary" gutterBottom variant="body2">
                          {card.title}
                        </Typography>
                        <Typography variant="h5" component="div">
                          {card.value.toLocaleString()}
                        </Typography>
                      </Box>
                      <Box sx={{ color: card.color, fontSize: 40 }}>
                        {card.icon}
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {usage.breakdown && Object.keys(usage.breakdown).length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Usage Breakdown
              </Typography>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Metric</TableCell>
                      <TableCell>Period</TableCell>
                      <TableCell>Value</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.entries(usage.breakdown).map(([metric, records]) =>
                      records.map((record, idx) => (
                        <TableRow key={`${metric}-${idx}`}>
                          <TableCell>{metric}</TableCell>
                          <TableCell>{new Date(record.period).toLocaleDateString()}</TableCell>
                          <TableCell>{record.value.toLocaleString()}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </>
      )}
    </Container>
  );
};

export default Usage;














