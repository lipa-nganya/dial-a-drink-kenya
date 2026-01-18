/**
 * Update branch 4 address to match actual location
 * Run with: node backend/scripts/update-branch-4-address.js
 */
const db = require('../models');

async function updateBranch4Address() {
  try {
    console.log('🔄 Updating branch 4 address...');
    
    // Get branch 4
    const branch = await db.Branch.findByPk(4);
    
    if (!branch) {
      console.error('❌ Error: Branch ID 4 does not exist!');
      process.exit(1);
    }
    
    console.log(`📋 Current branch 4:`);
    console.log(`   ID: ${branch.id}`);
    console.log(`   Name: ${branch.name}`);
    console.log(`   Address: ${branch.address}`);
    console.log(`   Latitude: ${branch.latitude}`);
    console.log(`   Longitude: ${branch.longitude}`);
    
    // Update address to match Google Maps location
    // From: "Taveta Shopping Mall - Stall G1" 
    // To: "Taveta Shopping Mall - M 48, Taveta Shopping Mall, Taveta Road, Nairobi"
    const newAddress = 'Taveta Shopping Mall - M 48, Taveta Shopping Mall, Taveta Road, Nairobi';
    
    await branch.update({
      address: newAddress
    });
    
    console.log(`\n✅ Updated branch 4 address:`);
    console.log(`   Old: ${branch.address}`);
    console.log(`   New: ${newAddress}`);
    
    // Reload to verify
    const updatedBranch = await db.Branch.findByPk(4);
    console.log(`\n✅ Verification - Branch 4 address: ${updatedBranch.address}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating branch 4 address:', error);
    process.exit(1);
  }
}

updateBranch4Address();
