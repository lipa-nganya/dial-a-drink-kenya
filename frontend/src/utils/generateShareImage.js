/**
 * Get full image URL for a product
 */
const getFullImageUrl = (imagePath) => {
  if (!imagePath) return '';
  
  if (imagePath.startsWith('data:')) {
    return imagePath;
  }
  
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  
  // For relative paths, construct URL from current origin
  const origin = window.location.origin;
  const needsEncoding = /[\s%]/.test(imagePath);
  const finalPath = needsEncoding ? encodeURI(imagePath) : imagePath;
  
  // Remove /api from origin if present, or use default backend port
  let baseUrl = origin;
  if (origin.includes('localhost')) {
    baseUrl = 'http://localhost:5001';
  } else {
    baseUrl = origin.replace('/api', '');
  }
  
  return `${baseUrl}${finalPath}`;
};

/**
 * Generate a shareable image for a product
 * @param {Object} product - Product object with image, name, price, etc.
 * @returns {Promise<string>} - Data URL of the generated image
 */
export const generateShareImage = async (product) => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size (ideal for social media sharing)
    const width = 1200;
    const height = 1200;
    canvas.width = width;
    canvas.height = height;
    
    // Background color
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    
    // Helper function to load image
    const loadImage = (url) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });
    };
    
    // Get product details
    const productName = product.name || 'Product';
    const productPrice = product.price || 0;
    const productImageUrl = getFullImageUrl(product.image);
    
    // Helper to get price text for canvas
    const getPriceTextForCanvas = () => {
      if (Array.isArray(product.capacityPricing) && product.capacityPricing.length > 0) {
        const prices = product.capacityPricing.map(p => {
          const price = parseFloat(p.currentPrice) || 0;
          const capacity = p.capacity;
          return `${capacity}: KES ${Math.round(price)}`;
        });
        return prices.join('\n');
      }
      return `KES ${Math.round(Number(productPrice))}`;
    };
    
    // Draw the image
    const drawImage = async () => {
      try {
        // Try to load product image
        let productImg = null;
        if (productImageUrl) {
          try {
            productImg = await loadImage(productImageUrl);
          } catch (error) {
            console.log('Failed to load product image, using placeholder');
          }
        }
        
        // Draw product image (top section) - constrained size to prevent overlap
        const imageHeight = 400;
        const imageY = 50;
        
        if (productImg) {
          // Use maximum constraints to keep image small
          const maxImageHeight = 280; // Maximum height for the image
          const maxImageWidth = width - 120; // Leave padding on sides
          
          const imgAspect = productImg.width / productImg.height;
          
          let drawWidth, drawHeight, drawX, drawY;
          
          // Calculate dimensions to fit within max constraints
          if (imgAspect > 1) {
            // Image is wider (landscape)
            drawWidth = Math.min(maxImageWidth, maxImageHeight * imgAspect);
            drawHeight = drawWidth / imgAspect;
          } else {
            // Image is taller (portrait) or square
            drawHeight = Math.min(maxImageHeight, maxImageWidth / imgAspect);
            drawWidth = drawHeight * imgAspect;
          }
          
          // Center the image within the allocated space
          drawX = (width - drawWidth) / 2;
          drawY = imageY + (imageHeight - drawHeight) / 2;
          
          // Draw white background for image area
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, imageY, width, imageHeight);
          
          // Draw product image (centered and constrained size)
          ctx.drawImage(productImg, drawX, drawY, drawWidth, drawHeight);
        } else {
          // Draw placeholder if no image
          ctx.fillStyle = '#F5F5F5';
          ctx.fillRect(0, imageY, width, imageHeight);
          
          // Draw placeholder icon
          ctx.fillStyle = '#CCCCCC';
          ctx.font = 'bold 80px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🍷', width / 2, imageY + imageHeight / 2);
        }
        
        // Draw bottom section with text - more spacing after image to prevent overlap
        const textY = imageHeight + imageY + 120;
        const padding = 60;
        
        // Product name
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 56px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        
        // Word wrap for product name
        const maxWidth = width - (padding * 2);
        const words = productName.split(' ');
        let line = '';
        let y = textY;
        
        for (let n = 0; n < words.length; n++) {
          const testLine = line + words[n] + ' ';
          const metrics = ctx.measureText(testLine);
          const testWidth = metrics.width;
          
          if (testWidth > maxWidth && n > 0) {
            ctx.fillText(line, width / 2, y);
            line = words[n] + ' ';
            y += 70;
          } else {
            line = testLine;
          }
        }
        ctx.fillText(line, width / 2, y);
        
        // Price section
        y += 100;
        ctx.fillStyle = '#FF6B6B';
        ctx.font = 'bold 72px Arial';
        ctx.textAlign = 'center';
        
        const priceText = getPriceTextForCanvas();
        const priceLines = priceText.split('\n');
        priceLines.forEach((line, index) => {
          ctx.fillText(line, width / 2, y + (index * 90));
        });
        
        // Draw border
        ctx.strokeStyle = '#E0E0E0';
        ctx.lineWidth = 4;
        ctx.strokeRect(0, 0, width, height);
        
        // Convert to data URL
        const dataURL = canvas.toDataURL('image/png');
        resolve(dataURL);
      } catch (error) {
        console.error('Error generating share image:', error);
        reject(error);
      }
    };
    
    drawImage();
  });
};

const getPriceText = (product) => {
  if (Array.isArray(product.capacityPricing) && product.capacityPricing.length > 0) {
    const prices = product.capacityPricing.map(p => {
      const price = parseFloat(p.currentPrice) || 0;
      const capacity = p.capacity;
      return `${capacity}: KES ${Math.round(price)}`;
    });
    return prices.join(', ');
  }
  return `KES ${Math.round(Number(product.price || 0))}`;
};

/**
 * Share product on social media
 * @param {Object} product - Product object
 * @param {Function} generateImage - Function to generate image (optional)
 */
export const shareProduct = async (product) => {
  try {
    // Generate share image
    const imageDataUrl = await generateShareImage(product);
    
    // Convert data URL to blob
    const blob = await (await fetch(imageDataUrl)).blob();
    const file = new File([blob], `${product.name}-share.png`, { type: 'image/png' });
    
    // Check if Web Share API is available and supports files
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: `${product.name} - Dial A Drink Kenya`,
          text: `Check out ${product.name} at Dial A Drink Kenya! ${getPriceText(product)}`,
          files: [file],
          url: `${window.location.origin}/product/${product.id}`
        });
        return;
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Error sharing:', error);
        }
      }
    }
    
    // Fallback: Copy image to clipboard or download
    if (navigator.clipboard && navigator.clipboard.write) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        alert('Image copied to clipboard! You can now paste it to share.');
        return;
      } catch (error) {
        console.error('Error copying to clipboard:', error);
      }
    }
    
    // Final fallback: Download the image
    const link = document.createElement('a');
    link.download = `${product.name.replace(/\s+/g, '-')}-share.png`;
    link.href = imageDataUrl;
    link.click();
    
    alert('Share image downloaded! You can now share it on social media.');
  } catch (error) {
    console.error('Error sharing product:', error);
    alert('Failed to generate share image. Please try again.');
  }
};

