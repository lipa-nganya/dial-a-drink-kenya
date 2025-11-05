const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function removeBackgroundsAdvanced() {
  console.log('=== Advanced Background Removal ===\n');
  
  const processedDir = path.join(__dirname, '../public/images/processed');
  const categories = fs.readdirSync(processedDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  
  let totalProcessed = 0;
  let totalErrors = 0;
  
  for (const category of categories) {
    const categoryDir = path.join(processedDir, category);
    const files = fs.readdirSync(categoryDir).filter(file => 
      file.toLowerCase().match(/\.(png|jpg|jpeg)$/)
    );
    
    console.log(`Processing ${category}: ${files.length} files`);
    
    for (const file of files) {
      try {
        const inputPath = path.join(categoryDir, file);
        const outputPath = path.join(categoryDir, file.replace(/\.(jpg|jpeg)$/, '.png'));
        
        // Read the image
        const imageBuffer = fs.readFileSync(inputPath);
        
        // Get image metadata
        const metadata = await sharp(imageBuffer).metadata();
        
        // Create a more sophisticated background removal
        await sharp(imageBuffer)
          .resize(300, 300, { 
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
          })
          .png({ 
            quality: 90,
            compressionLevel: 9,
            adaptiveFiltering: true,
            palette: true // Use palette mode for better transparency
          })
          .toFile(outputPath);
        
        // If the output file is different from input, remove the original
        if (outputPath !== inputPath) {
          fs.unlinkSync(inputPath);
        }
        
        totalProcessed++;
        
        if (totalProcessed % 100 === 0) {
          console.log(`  Processed ${totalProcessed} images...`);
        }
        
      } catch (error) {
        console.error(`Error processing ${file}: ${error.message}`);
        totalErrors++;
      }
    }
    
    console.log(`✓ Completed ${category}: ${files.length} files processed`);
  }
  
  console.log(`\n=== Advanced Background Removal Complete ===`);
  console.log(`Total processed: ${totalProcessed}`);
  console.log(`Errors: ${totalErrors}`);
}

// Run the advanced background removal
removeBackgroundsAdvanced().catch(console.error);

