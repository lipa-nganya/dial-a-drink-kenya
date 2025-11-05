const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Configuration for image processing
const CONFIG = {
  // Target dimensions for product images
  TARGET_WIDTH: 300,
  TARGET_HEIGHT: 300,
  
  // Background removal settings
  BACKGROUND_COLOR: '#FFFFFF', // White background
  TOLERANCE: 10, // Color tolerance for background removal
  
  // Image quality settings
  QUALITY: 90,
  FORMAT: 'jpeg'
};

async function processImage(inputPath, outputPath) {
  try {
    console.log(`Processing: ${path.basename(inputPath)}`);
    
    // Read the image
    let image = sharp(inputPath);
    const metadata = await image.metadata();
    
    // Resize image to fit target dimensions while maintaining aspect ratio
    image = image.resize(CONFIG.TARGET_WIDTH, CONFIG.TARGET_HEIGHT, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 0 } // Transparent background
    });
    
    // Convert to PNG to preserve transparency
    image = image.png({
      quality: CONFIG.QUALITY,
      compressionLevel: 9
    });
    
    // Write the processed image
    await image.toFile(outputPath);
    
    console.log(`✓ Processed: ${path.basename(outputPath)}`);
    return true;
    
  } catch (error) {
    console.error(`✗ Error processing ${inputPath}:`, error.message);
    return false;
  }
}

async function processDirectory(inputDir, outputDir) {
  try {
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Get all image files
    const files = fs.readdirSync(inputDir);
    const imageFiles = files.filter(file => 
      /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(file)
    );
    
    console.log(`Found ${imageFiles.length} images in ${inputDir}`);
    
    let processedCount = 0;
    let errorCount = 0;
    
    for (const file of imageFiles) {
      const inputPath = path.join(inputDir, file);
      const outputPath = path.join(outputDir, file.replace(/\.[^.]+$/, '.png'));
      
      const success = await processImage(inputPath, outputPath);
      if (success) {
        processedCount++;
      } else {
        errorCount++;
      }
    }
    
    console.log(`\nDirectory ${inputDir} completed:`);
    console.log(`  Processed: ${processedCount}`);
    console.log(`  Errors: ${errorCount}`);
    
    return { processed: processedCount, errors: errorCount };
    
  } catch (error) {
    console.error(`Error processing directory ${inputDir}:`, error.message);
    return { processed: 0, errors: 1 };
  }
}

async function processAllImages() {
  console.log('=== Starting Image Processing ===\n');
  
  const baseDir = path.join(__dirname, '../public/images/drinks');
  const processedDir = path.join(__dirname, '../public/images/processed');
  
  // Get all category directories
  const categories = fs.readdirSync(baseDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  
  console.log(`Found ${categories.length} categories to process`);
  
  let totalProcessed = 0;
  let totalErrors = 0;
  
  for (const category of categories) {
    console.log(`\n--- Processing ${category} ---`);
    
    const inputDir = path.join(baseDir, category);
    const outputDir = path.join(processedDir, category);
    
    const result = await processDirectory(inputDir, outputDir);
    totalProcessed += result.processed;
    totalErrors += result.errors;
  }
  
  console.log('\n=== Image Processing Complete ===');
  console.log(`Total processed: ${totalProcessed}`);
  console.log(`Total errors: ${totalErrors}`);
  console.log(`Processed images saved to: ${processedDir}`);
  
  return { totalProcessed, totalErrors };
}

// Run the image processing
processAllImages().then((result) => {
  console.log('\n=== Final Results ===');
  console.log(`Successfully processed ${result.totalProcessed} images`);
  if (result.totalErrors > 0) {
    console.log(`Encountered ${result.totalErrors} errors`);
  }
  process.exit(0);
}).catch(error => {
  console.error('Image processing failed:', error);
  process.exit(1);
});

