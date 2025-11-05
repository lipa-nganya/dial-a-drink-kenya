#!/usr/bin/env node

const axios = require('axios');

const API_BASE_URL = 'http://localhost:4001/api';

async function importAllData() {
  console.log('🚀 Starting Dial A Drink Kenya data import...\n');

  try {
    // Step 1: Import Categories
    console.log('📁 Step 1: Importing Categories...');
    const categoriesResponse = await axios.post(`${API_BASE_URL}/import/import-categories`);
    console.log(`✅ Categories imported: ${categoriesResponse.data.totalCreated} new categories`);
    console.log(`📋 Categories: ${categoriesResponse.data.categories.map(c => c.name).join(', ')}\n`);

    // Step 2: Import Subcategories
    console.log('📂 Step 2: Importing Subcategories...');
    const subcategoriesResponse = await axios.post(`${API_BASE_URL}/import/import-subcategories`);
    console.log(`✅ Subcategories imported: ${subcategoriesResponse.data.totalCreated} new subcategories\n`);

    // Step 3: Import Drinks
    console.log('🍷 Step 3: Importing Drinks...');
    const drinksResponse = await axios.post(`${API_BASE_URL}/import-drinks/import-drinks`);
    console.log(`✅ Drinks imported: ${drinksResponse.data.totalCreated} new drinks`);
    console.log(`🍺 Drinks: ${drinksResponse.data.drinks.map(d => d.name).join(', ')}\n`);

    // Summary
    console.log('🎉 IMPORT COMPLETE!');
    console.log('='.repeat(50));
    console.log(`📁 Categories: ${categoriesResponse.data.totalCreated}`);
    console.log(`📂 Subcategories: ${subcategoriesResponse.data.totalCreated}`);
    console.log(`🍷 Drinks: ${drinksResponse.data.totalCreated}`);
    console.log('='.repeat(50));
    console.log('🌐 Your Dial A Drink Kenya database is now populated!');
    console.log('🔗 Visit: http://localhost:3002 to see your inventory');

  } catch (error) {
    console.error('❌ Import failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

// Run the import
importAllData();

