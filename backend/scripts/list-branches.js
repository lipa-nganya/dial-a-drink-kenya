/**
 * List all branches
 */
const db = require('../models');

async function listBranches() {
  try {
    const branches = await db.Branch.findAll({
      order: [['id', 'ASC']]
    });
    
    console.log(`\n📋 Found ${branches.length} branches:\n`);
    branches.forEach(branch => {
      console.log(`ID: ${branch.id} | Name: ${branch.name} | Active: ${branch.isActive}`);
    });
    console.log();
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

listBranches();
