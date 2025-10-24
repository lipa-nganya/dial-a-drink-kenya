import React, { useState, useEffect } from 'react';
import { Typography, Box } from '@mui/material';
import { api } from '../services/api';

const CountdownTimer = () => {
  const [countdown, setCountdown] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchCountdown = async () => {
    try {
      const response = await api.get('/countdown/current');
      setCountdown(response.data);
      if (response.data.active) {
        setTimeRemaining(response.data.timeRemaining);
      }
    } catch (error) {
      console.error('Error fetching countdown:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateCountdown = () => {
    if (countdown && countdown.active) {
      const now = new Date();
      const endDate = new Date(countdown.endDate);
      const remaining = endDate.getTime() - now.getTime();
      
      if (remaining <= 0) {
        setTimeRemaining(0);
        // Refresh countdown data when it expires
        fetchCountdown();
      } else {
        setTimeRemaining(remaining);
      }
    }
  };

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
    return (
      <Typography 
        variant="h2" 
        component="h1" 
        gutterBottom
        sx={{ 
          fontSize: { xs: '2rem', sm: '3rem', md: '3.75rem' },
          lineHeight: 1.2,
          pt: 4,
          pb: 2
        }}
      >
        Dial A Drink Kenya
      </Typography>
    );
  }

  if (!countdown || !countdown.active) {
    return (
      <Typography 
        variant="h2" 
        component="h1" 
        gutterBottom
        sx={{ 
          fontSize: { xs: '2rem', sm: '3rem', md: '3.75rem' },
          lineHeight: 1.2,
          pt: 4,
          pb: 2
        }}
      >
        Dial A Drink Kenya
      </Typography>
    );
  }

  const time = formatTime(timeRemaining);

  return (
    <Box sx={{ pt: 4, pb: 2 }}>
      <Typography 
        variant="h4" 
        component="h2" 
        gutterBottom
        sx={{ 
          fontSize: { xs: '1.5rem', sm: '2rem', md: '2.5rem' },
          lineHeight: 1.2,
          mb: 3,
          color: '#00E0B8'
        }}
      >
        Offer Ends in
      </Typography>
      
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: { xs: 1, sm: 2 },
          flexWrap: 'wrap'
        }}
      >
        <Box sx={{ textAlign: 'center' }}>
          <Typography 
            variant="h2" 
            sx={{ 
              fontSize: { xs: '2rem', sm: '3rem', md: '4rem' },
              fontWeight: 'bold',
              color: '#FF3366',
              lineHeight: 1
            }}
          >
            {time.days}
          </Typography>
          <Typography variant="body2" sx={{ color: '#B0B0B0' }}>Days</Typography>
        </Box>
        
        <Typography 
          variant="h2" 
          sx={{ 
            fontSize: { xs: '2rem', sm: '3rem', md: '4rem' },
            fontWeight: 'bold',
            color: '#F5F5F5',
            lineHeight: 1
          }}
        >
          :
        </Typography>
        
        <Box sx={{ textAlign: 'center' }}>
          <Typography 
            variant="h2" 
            sx={{ 
              fontSize: { xs: '2rem', sm: '3rem', md: '4rem' },
              fontWeight: 'bold',
              color: '#FF3366',
              lineHeight: 1
            }}
          >
            {time.hours}
          </Typography>
          <Typography variant="body2" sx={{ color: '#B0B0B0' }}>Hours</Typography>
        </Box>
        
        <Typography 
          variant="h2" 
          sx={{ 
            fontSize: { xs: '2rem', sm: '3rem', md: '4rem' },
            fontWeight: 'bold',
            color: '#F5F5F5',
            lineHeight: 1
          }}
        >
          :
        </Typography>
        
        <Box sx={{ textAlign: 'center' }}>
          <Typography 
            variant="h2" 
            sx={{ 
              fontSize: { xs: '2rem', sm: '3rem', md: '4rem' },
              fontWeight: 'bold',
              color: '#FF3366',
              lineHeight: 1
            }}
          >
            {time.minutes}
          </Typography>
          <Typography variant="body2" sx={{ color: '#B0B0B0' }}>Minutes</Typography>
        </Box>
        
        <Typography 
          variant="h2" 
          sx={{ 
            fontSize: { xs: '2rem', sm: '3rem', md: '4rem' },
            fontWeight: 'bold',
            color: '#F5F5F5',
            lineHeight: 1
          }}
        >
          :
        </Typography>
        
        <Box sx={{ textAlign: 'center' }}>
          <Typography 
            variant="h2" 
            sx={{ 
              fontSize: { xs: '2rem', sm: '3rem', md: '4rem' },
              fontWeight: 'bold',
              color: '#FF3366',
              lineHeight: 1
            }}
          >
            {time.seconds}
          </Typography>
          <Typography variant="body2" sx={{ color: '#B0B0B0' }}>Seconds</Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default CountdownTimer;
