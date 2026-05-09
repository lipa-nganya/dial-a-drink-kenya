const express = require('express');

const router = express.Router();

const DISCONTINUED = {
  success: false,
  message:
    'The developer/partner sandbox API is no longer available. Contact support if you need integration access.'
};

router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Developers route is working' });
});

router.post('/sandbox/signup', (req, res) => {
  res.status(410).json(DISCONTINUED);
});

module.exports = router;
