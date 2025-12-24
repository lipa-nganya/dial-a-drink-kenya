// Script to create placeholder assets for Expo
const fs = require('fs');
const path = require('path');

// Create a simple placeholder image (1x1 pixel PNG)
const createPlaceholderPNG = () => {
  // Base64 encoded 1x1 transparent PNG
  const base64PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  return Buffer.from(base64PNG, 'base64');
};

const assetsDir = path.join(__dirname, 'assets');

// Ensure assets directory exists
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Create placeholder images
const images = [
  { name: 'icon.png', size: 1024 },
  { name: 'splash.png', size: 2048 },
  { name: 'adaptive-icon.png', size: 1024 },
  { name: 'favicon.png', size: 32 }
];

images.forEach(img => {
  const filePath = path.join(assetsDir, img.name);
  // For now, create a minimal valid PNG
  // In production, you'd want actual images
  const placeholder = createPlaceholderPNG();
  fs.writeFileSync(filePath, placeholder);
  console.log(`✅ Created ${img.name}`);
});

console.log('\n✅ All placeholder assets created!');
console.log('💡 Replace these with actual images before production builds.');

























