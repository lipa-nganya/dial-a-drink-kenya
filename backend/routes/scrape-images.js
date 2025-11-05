const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const router = express.Router();

// Scrape images for all categories
router.post('/scrape-all-images', async (req, res) => {
  try {
    console.log('Starting image scraping process...');
    
    // Run the universal scraper script
    const scraperPath = path.join(__dirname, '../scripts/universal-image-scraper.js');
    const scraper = spawn('node', [scraperPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: path.join(__dirname, '..')
    });
    
    let output = '';
    let errorOutput = '';
    
    scraper.stdout.on('data', (data) => {
      output += data.toString();
      console.log(data.toString());
    });
    
    scraper.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error(data.toString());
    });
    
    scraper.on('close', (code) => {
      if (code === 0) {
        res.status(200).json({
          success: true,
          message: 'Image scraping completed successfully',
          output: output
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Image scraping failed',
          error: errorOutput,
          output: output
        });
      }
    });
    
    // Handle timeout
    setTimeout(() => {
      scraper.kill();
      res.status(408).json({
        success: false,
        message: 'Image scraping timed out'
      });
    }, 300000); // 5 minutes timeout
    
  } catch (error) {
    console.error('Error starting image scraper:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start image scraper',
      error: error.message
    });
  }
});

// Scrape images for a specific category
router.post('/scrape-category-images/:category', async (req, res) => {
  try {
    const { category } = req.params;
    console.log(`Starting image scraping for ${category}...`);
    
    // Run the simple scraper for specific category
    const scraperPath = path.join(__dirname, '../scripts/simple-whisky-scraper.js');
    const scraper = spawn('node', [scraperPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: path.join(__dirname, '..')
    });
    
    let output = '';
    let errorOutput = '';
    
    scraper.stdout.on('data', (data) => {
      output += data.toString();
      console.log(data.toString());
    });
    
    scraper.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error(data.toString());
    });
    
    scraper.on('close', (code) => {
      if (code === 0) {
        res.status(200).json({
          success: true,
          message: `Image scraping for ${category} completed successfully`,
          output: output
        });
      } else {
        res.status(500).json({
          success: false,
          message: `Image scraping for ${category} failed`,
          error: errorOutput,
          output: output
        });
      }
    });
    
    // Handle timeout
    setTimeout(() => {
      scraper.kill();
      res.status(408).json({
        success: false,
        message: `Image scraping for ${category} timed out`
      });
    }, 120000); // 2 minutes timeout
    
  } catch (error) {
    console.error(`Error starting image scraper for ${category}:`, error);
    res.status(500).json({
      success: false,
      message: `Failed to start image scraper for ${category}`,
      error: error.message
    });
  }
});

module.exports = router;

