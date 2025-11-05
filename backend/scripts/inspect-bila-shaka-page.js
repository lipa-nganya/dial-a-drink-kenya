const axios = require('axios');
const cheerio = require('cheerio');

async function inspectBilaShakaPage() {
  try {
    console.log('Inspecting Bila Shaka Chez Guerrilla page for images...');
    
    const url = 'https://www.bilashaka.ke/products/chez-guerrilla';
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    
    console.log('All images found on the page:');
    $('img').each((i, img) => {
      const src = $(img).attr('src');
      const alt = $(img).attr('alt');
      const classAttr = $(img).attr('class');
      console.log(`Image ${i + 1}:`);
      console.log(`  src: ${src}`);
      console.log(`  alt: ${alt}`);
      console.log(`  class: ${classAttr}`);
      console.log('---');
    });

  } catch (error) {
    console.error('Error inspecting page:', error.message);
  }
}

inspectBilaShakaPage();

