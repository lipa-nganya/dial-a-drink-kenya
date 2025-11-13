import React, { useState, useEffect, useCallback } from 'react';
import { Typography, Box } from '@mui/material';
import { api } from '../services/api';

const CountdownTimer = () => {
  const [countdown, setCountdown] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchCountdown = async () => {
    try {
      console.log('Fetching current countdown...');
      const response = await api.get('/countdown/current');
      console.log('Countdown response:', response.data);
      setCountdown(response.data);
      if (response.data.active) {
        // Calculate time remaining on frontend for real-time updates
        const now = new Date();
        const endDate = new Date(response.data.endDate);
        const remaining = endDate.getTime() - now.getTime();
        setTimeRemaining(Math.max(0, remaining));
      }
    } catch (error) {
      console.error('Error fetching countdown:', error);
      console.error('Error details:', error.response?.data || error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateCountdown = useCallback(() => {
    if (countdown && countdown.active) {
      const now = new Date();
      const endDate = new Date(countdown.endDate);
      const remaining = endDate.getTime() - now.getTime();
      
      console.log('Countdown update:', {
        now: now.toISOString(),
        endDate: endDate.toISOString(),
        remaining: remaining,
        remainingHours: Math.floor(remaining / (1000 * 60 * 60))
      });
      
      if (remaining <= 0) {
        setTimeRemaining(0);
        // Refresh countdown data when it expires
        fetchCountdown();
      } else {
        setTimeRemaining(remaining);
      }
    }
  }, [countdown]);

  useEffect(() => {
    fetchCountdown();
  }, []);

  useEffect(() => {
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [updateCountdown]);

  const formatTime = (milliseconds) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const days = Math.floor(totalSeconds / (24 * 60 * 60));
    const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
    const seconds = totalSeconds % 60;

    return {
      days: days.toString().padStart(2, '0'),
      hours: hours.toString().padStart(2, '0'),
      minutes: minutes.toString().padStart(2, '0'),
      seconds: seconds.toString().padStart(2, '0')
    };
  };

  if (loading) {
    return null;
  }

  if (!countdown || !countdown.active) {
    return null;
  }

  const time = formatTime(timeRemaining);

  return (
    <Box sx={{ pt: 4, pb: 3 }}>
      {/* Countdown Title */}
      <Typography 
        variant="h3" 
        component="h2" 
        gutterBottom
        sx={{ 
          fontSize: { xs: '1.75rem', sm: '2.25rem', md: '2.75rem' },
          lineHeight: 1.2,
          mb: 2,
          color: '#00E0B8',
          fontWeight: 700,
          textShadow: '0 0 10px rgba(0, 224, 184, 0.3)'
        }}
      >
        {countdown.title} Ends in
      </Typography>
      
      {/* Countdown Display */}
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: { xs: 1, sm: 2, md: 3 },
          flexWrap: 'wrap',
          mb: 2
        }}
      >
        <Box sx={{ textAlign: 'center', minWidth: { xs: '60px', sm: '80px' } }}>
          <Typography 
            variant="h1" 
            sx={{ 
              fontSize: { xs: '2.5rem', sm: '3.5rem', md: '4.5rem' },
              fontWeight: 'bold',
              color: '#FF3366',
              lineHeight: 1,
              textShadow: '0 0 15px rgba(255, 51, 102, 0.4)',
              fontFamily: 'monospace'
            }}
          >
            {time.days}
          </Typography>
          <Typography 
            variant="body1" 
            sx={{ 
              color: '#B0B0B0',
              fontSize: { xs: '0.75rem', sm: '0.875rem' },
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            Days
          </Typography>
        </Box>
        
        <Typography 
          variant="h1" 
          sx={{ 
            fontSize: { xs: '2.5rem', sm: '3.5rem', md: '4.5rem' },
            fontWeight: 'bold',
            color: '#F5F5F5',
            lineHeight: 1,
            opacity: 0.8
          }}
        >
          :
        </Typography>
        
        <Box sx={{ textAlign: 'center', minWidth: { xs: '60px', sm: '80px' } }}>
          <Typography 
            variant="h1" 
            sx={{ 
              fontSize: { xs: '2.5rem', sm: '3.5rem', md: '4.5rem' },
              fontWeight: 'bold',
              color: '#FF3366',
              lineHeight: 1,
              textShadow: '0 0 15px rgba(255, 51, 102, 0.4)',
              fontFamily: 'monospace'
            }}
          >
            {time.hours}
          </Typography>
          <Typography 
            variant="body1" 
            sx={{ 
              color: '#B0B0B0',
              fontSize: { xs: '0.75rem', sm: '0.875rem' },
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            Hours
          </Typography>
        </Box>
        
        <Typography 
          variant="h1" 
          sx={{ 
            fontSize: { xs: '2.5rem', sm: '3.5rem', md: '4.5rem' },
            fontWeight: 'bold',
            color: '#F5F5F5',
            lineHeight: 1,
            opacity: 0.8
          }}
        >
          :
        </Typography>
        
        <Box sx={{ textAlign: 'center', minWidth: { xs: '60px', sm: '80px' } }}>
          <Typography 
            variant="h1" 
            sx={{ 
              fontSize: { xs: '2.5rem', sm: '3.5rem', md: '4.5rem' },
              fontWeight: 'bold',
              color: '#FF3366',
              lineHeight: 1,
              textShadow: '0 0 15px rgba(255, 51, 102, 0.4)',
              fontFamily: 'monospace'
            }}
          >
            {time.minutes}
          </Typography>
          <Typography 
            variant="body1" 
            sx={{ 
              color: '#B0B0B0',
              fontSize: { xs: '0.75rem', sm: '0.875rem' },
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            Minutes
          </Typography>
        </Box>
        
        <Typography 
          variant="h1" 
          sx={{ 
            fontSize: { xs: '2.5rem', sm: '3.5rem', md: '4.5rem' },
            fontWeight: 'bold',
            color: '#F5F5F5',
            lineHeight: 1,
            opacity: 0.8
          }}
        >
          :
        </Typography>
        
        <Box sx={{ textAlign: 'center', minWidth: { xs: '60px', sm: '80px' } }}>
          <Typography 
            variant="h1" 
            sx={{ 
              fontSize: { xs: '2.5rem', sm: '3.5rem', md: '4.5rem' },
              fontWeight: 'bold',
              color: '#FF3366',
              lineHeight: 1,
              textShadow: '0 0 15px rgba(255, 51, 102, 0.4)',
              fontFamily: 'monospace'
            }}
          >
            {time.seconds}
          </Typography>
          <Typography 
            variant="body1" 
            sx={{ 
              color: '#B0B0B0',
              fontSize: { xs: '0.75rem', sm: '0.875rem' },
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            Seconds
          </Typography>
        </Box>
      </Box>
      
      {/* Urgency Message */}
      <Typography 
        variant="h6" 
        sx={{ 
          color: '#00E0B8',
          fontSize: { xs: '1rem', sm: '1.25rem' },
          fontWeight: 600,
          textShadow: '0 0 8px rgba(0, 224, 184, 0.3)',
          mb: 2
        }}
      >
        Don't Miss Out! Limited Time Offer
      </Typography>
    </Box>
  );
};

export default CountdownTimer;
