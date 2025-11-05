const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function removeWhiteBackgroundsProperly() {
  console.log('=== Properly Removing White Backgrounds ===\n');
  
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
        
        // Read the image and get raw data
        const { data, info } = await sharp(inputPath)
          .resize(300, 300, { fit: 'contain' })
          .raw()
          .toBuffer({ resolveWithObject: true });
        
        // Create new image data with alpha channel
        const newData = Buffer.alloc(info.width * info.height * 4);
        
        for (let i = 0; i < data.length; i += info.channels) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          // Calculate alpha based on how close to white the pixel is
          const whiteThreshold = 240; // Adjust this value as needed
          const isWhite = r > whiteThreshold && g > whiteThreshold && b > whiteThreshold;
          const alpha = isWhite ? 0 : 255; // Transparent for white, opaque for others
          
          const pixelIndex = (i / info.channels) * 4;
          newData[pixelIndex] = r;     // R
          newData[pixelIndex + 1] = g; // G
          newData[pixelIndex + 2] = b; // B
          newData[pixelIndex + 3] = alpha; // A
        }
        
        // Create new image with alpha channel
        await sharp(newData, {
          raw: {
            width: info.width,
            height: info.height,
            channels: 4
          }
        })
        .png({ 
          quality: 90,
          compressionLevel: 9,
          adaptiveFiltering: true
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
  
  console.log(`\n=== White Background Removal Complete ===`);
  console.log(`Total processed: ${totalProcessed}`);
  console.log(`Errors: ${totalErrors}`);
}

// Run the white background removal
removeWhiteBackgroundsProperly().catch(console.error);

